#!/usr/bin/env python3
"""
Download frankongames/steam-games-dataset from Kaggle and emit normalized JSON.

Prefers games.json (Steam AppID keys). The bundled CSV has a merged header column
and misaligned rows — JSON is the reliable source.

Requires: pip install kagglehub pandas
Credentials: ~/.kaggle/kaggle.json or KAGGLE_USERNAME + KAGGLE_KEY
"""

from __future__ import annotations

import json
import math
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
GAMES_OUT = DATA_DIR / "games.normalized.json"
PAIRS_OUT = DATA_DIR / "co-occurrence.pairs.json"
MANIFEST_OUT = DATA_DIR / "manifest.json"

DATASET = "fronkongames/steam-games-dataset"


def parse_year(release_date: str | None) -> int | None:
    if not release_date:
        return None
    match = re.search(r"(19|20)\d{2}", str(release_date))
    return int(match.group(0)) if match else None


def parse_steam_tags(tags_val, categories: list | None = None, limit: int = 20) -> list[str]:
    tags: list[str] = []

    if isinstance(tags_val, dict):
        ranked = sorted(tags_val.items(), key=lambda item: item[1], reverse=True)
        tags.extend(str(name).strip() for name, _ in ranked if str(name).strip())
    elif isinstance(tags_val, list):
        tags.extend(str(t).strip() for t in tags_val if str(t).strip())

    if categories:
        for cat in categories:
            c = str(cat).strip()
            if c and c not in tags:
                tags.append(c)

    return tags[:limit]


def platform_label(windows: bool, mac: bool, linux: bool) -> str:
    parts: list[str] = []
    if windows:
        parts.append("PC")
    if mac:
        parts.append("Mac")
    if linux:
        parts.append("Linux")
    return ", ".join(parts) if parts else "PC"


def owners_midpoint(estimated: str | None) -> int:
    if not estimated:
        return 0
    nums = [int(x.replace(",", "")) for x in re.findall(r"\d+", str(estimated))]
    if not nums:
        return 0
    if len(nums) >= 2:
        return (nums[0] + nums[1]) // 2
    return nums[0]


def truncate_text(text: str | None, limit: int = 600) -> str | None:
    if not text:
        return None
    clean = re.sub(r"<[^>]+>", " ", str(text))
    clean = re.sub(r"\s+", " ", clean).strip()
    if not clean:
        return None
    return clean[:limit] + ("…" if len(clean) > limit else "")


def popularity_score_01(positive: int, recommendations: int, owners_mid: int = 0) -> float:
    signal = positive + recommendations * 0.75 + owners_mid * 1e-7
    return round(min(1.0, math.log10(signal + 1) / 7.0), 4)


def parse_screenshots(value) -> list[str]:
    if not value or not isinstance(value, list):
        return []
    return [str(u).strip() for u in value if str(u).strip()][:4]


def parse_string_list(value) -> list[str]:
    if isinstance(value, list):
        return [str(v).strip() for v in value if str(v).strip()]
    if isinstance(value, str) and value.strip():
        return [value.strip()]
    return []


def steam_rating(game: dict) -> float | None:
    positive = int(game.get("positive") or 0)
    negative = int(game.get("negative") or 0)
    total = positive + negative
    if total >= 20:
        return round((positive / total) * 10, 2)

    meta = game.get("metacritic_score")
    if meta is not None and str(meta) not in ("", "0", "nan"):
        try:
            return round(float(meta) / 10, 2)
        except (ValueError, TypeError):
            pass
    return None


def normalize_steam_games(raw: dict[str, dict]) -> list[dict]:
    games: list[dict] = []

    for app_id, row in raw.items():
        if not isinstance(row, dict):
            continue

        name = str(row.get("name") or "").strip()
        if not name:
            continue

        try:
            steam_app_id = int(app_id)
        except (ValueError, TypeError):
            continue

        genres = row.get("genres") or []
        if isinstance(genres, str):
            genres = [g.strip() for g in genres.split(",") if g.strip()]

        categories = row.get("categories") or []
        if isinstance(categories, str):
            categories = [c.strip() for c in categories.split(",") if c.strip()]

        publishers = row.get("publishers") or []
        if isinstance(publishers, str):
            publishers = [publishers.strip()] if publishers.strip() else []
        publisher = str(publishers[0]).strip() if publishers else None

        tags = parse_steam_tags(row.get("tags"), categories)

        genre = ", ".join(genres) if genres else (tags[0] if tags else None)

        price = row.get("price")
        try:
            price_val = float(price) if price is not None and str(price) != "nan" else None
        except (ValueError, TypeError):
            price_val = None

        positive = int(row.get("positive") or 0)
        negative = int(row.get("negative") or 0)
        recommendations = int(row.get("recommendations") or 0)
        owners_label = str(row.get("estimated_owners") or "").strip() or None
        owners_mid = owners_midpoint(owners_label)
        developers = parse_string_list(row.get("developers"))
        short_desc = truncate_text(
            row.get("short_description") or row.get("about_the_game")
        )
        header_image = str(row.get("header_image") or "").strip() or None
        screenshots = parse_screenshots(row.get("screenshots"))

        games.append(
            {
                "id": str(steam_app_id),
                "steamAppId": steam_app_id,
                "name": name,
                "genre": genre,
                "platform": platform_label(
                    bool(row.get("windows")),
                    bool(row.get("mac")),
                    bool(row.get("linux")),
                ),
                "year": parse_year(row.get("release_date")),
                "rating": steam_rating(row),
                "tags": tags,
                "price": price_val,
                "publisher": publisher,
                "popularityScore": popularity_score_01(positive, recommendations, owners_mid),
                "positiveReviews": positive,
                "recommendations": recommendations,
                "estimatedOwners": owners_label,
                "estimatedOwnersMid": owners_mid,
                "shortDescription": short_desc,
                "headerImage": header_image,
                "screenshots": screenshots,
                "developers": developers,
                "raw": {
                    "recommendations": recommendations,
                    "positive": positive,
                    "negative": negative,
                    "peak_ccu": int(row.get("peak_ccu") or 0),
                    "ownersMid": owners_mid,
                    "genres": genres,
                    "categories": categories,
                },
            }
        )

    return games


def popularity_score(game: dict) -> int:
    raw = game.get("raw") or {}
    return int(raw.get("recommendations") or 0) + int(raw.get("positive") or 0)


def build_co_occurrence_pairs(games: list[dict], max_pairs: int = 50_000) -> list[dict]:
    """Co-occurrence from shared Steam genres / tags / platform."""
    by_genre: dict[str, list[str]] = {}
    by_tag: dict[str, list[str]] = {}
    by_platform: dict[str, list[str]] = {}

    games_by_id = {g["id"]: g for g in games}

    for g in games:
        gid = g["id"]
        genre = g.get("genre")
        if genre:
            for part in str(genre).split(","):
                key = part.strip()
                if key:
                    by_genre.setdefault(key, []).append(gid)
        platform = g.get("platform")
        if platform:
            by_platform.setdefault(platform, []).append(gid)
        for tag in g.get("tags") or []:
            by_tag.setdefault(tag.lower(), []).append(gid)

    pair_weights: dict[tuple[str, str], float] = {}

    def add_pairs(ids: list[str], weight: float) -> None:
        if len(ids) < 2:
            return
        sorted_ids = sorted(ids, key=lambda gid: popularity_score(games_by_id.get(gid, {})), reverse=True)
        trimmed = sorted_ids[:40]
        for i, a in enumerate(trimmed):
            for b in trimmed[i + 1 :]:
                if a == b:
                    continue
                key = (a, b) if a < b else (b, a)
                pair_weights[key] = pair_weights.get(key, 0) + weight

    for ids in by_genre.values():
        add_pairs(ids, 1.0)
    for ids in by_platform.values():
        add_pairs(ids, 0.75)
    for ids in by_tag.values():
        add_pairs(ids, 0.85)

    pairs = [
        {"sourceGameId": a, "targetGameId": b, "weight": round(w, 4)}
        for (a, b), w in pair_weights.items()
    ]
    pairs.sort(key=lambda p: p["weight"], reverse=True)
    return pairs[:max_pairs]


def load_steam_dataset(root: Path) -> dict[str, dict]:
    json_path = root / "games.json"
    if json_path.exists():
        print(f"Loading {json_path} ...")
        with json_path.open(encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, dict):
            return data
        raise ValueError("games.json must be an object keyed by AppID")

    csv_files = list(root.rglob("*.csv"))
    if not csv_files:
        raise FileNotFoundError(f"No games.json or CSV under {root}")

    import pandas as pd

    csv_path = max(csv_files, key=lambda p: p.stat().st_size)
    print(f"WARNING: falling back to CSV {csv_path} — prefer games.json")
    df = pd.read_csv(csv_path)
    raise RuntimeError("CSV layout is unreliable for this dataset; games.json is required")


def main() -> int:
    try:
        import kagglehub
    except ImportError:
        print("Install deps: pip install kagglehub pandas", file=sys.stderr)
        return 1

    DATA_DIR.mkdir(parents=True, exist_ok=True)

    print(f"Downloading dataset {DATASET} ...")
    path = kagglehub.dataset_download(DATASET)
    root = Path(path)

    raw = load_steam_dataset(root)
    games = normalize_steam_games(raw)
    pairs = build_co_occurrence_pairs(games)

    GAMES_OUT.write_text(json.dumps(games, ensure_ascii=False, indent=2), encoding="utf-8")
    PAIRS_OUT.write_text(json.dumps(pairs, ensure_ascii=False, indent=2), encoding="utf-8")

    manifest = {
        "version": "2",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "source": f"kaggle:{DATASET}",
        "gameCount": len(games),
        "pairCount": len(pairs),
        "gamesPath": "data/games.normalized.json",
        "pairsPath": "data/co-occurrence.pairs.json",
    }
    MANIFEST_OUT.write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    print(f"Wrote {len(games)} games -> {GAMES_OUT}")
    print(f"Wrote {len(pairs)} pairs -> {PAIRS_OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
