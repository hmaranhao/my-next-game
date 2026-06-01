#!/usr/bin/env python3
"""
Download mohamedhanyyy/video-games from Kaggle and emit normalized JSON for the app.

Requires: pip install kagglehub pandas
Credentials: ~/.kaggle/kaggle.json or KAGGLE_USERNAME + KAGGLE_KEY
"""

from __future__ import annotations

import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
GAMES_OUT = DATA_DIR / "games.normalized.json"
PAIRS_OUT = DATA_DIR / "co-occurrence.pairs.json"
MANIFEST_OUT = DATA_DIR / "manifest.json"


def slug_id(name: str, index: int) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", (name or f"game-{index}").lower()).strip("-")
    return base[:80] or f"game-{index}"


def parse_tags(value) -> list[str]:
    if value is None or (isinstance(value, float) and str(value) == "nan"):
        return []
    if isinstance(value, list):
        return [str(v).strip() for v in value if str(v).strip()]
    text = str(value)
    for sep in ["|", ";", ","]:
        if sep in text:
            return [p.strip() for p in text.split(sep) if p.strip()]
    return [text.strip()] if text.strip() else []


def pick_column(columns: list[str], candidates: list[str]) -> str | None:
    lower = {c.lower(): c for c in columns}
    for cand in candidates:
        if cand.lower() in lower:
            return lower[cand.lower()]
    return None


def normalize_games(df) -> list[dict]:
    columns = list(df.columns)
    col_name = pick_column(columns, ["name", "title", "game", "game_name"])
    col_genre = pick_column(columns, ["genre", "genres", "category"])
    col_platform = pick_column(columns, ["platform", "platforms"])
    col_year = pick_column(columns, ["year", "release_year", "release date"])
    col_rating = pick_column(columns, ["rating", "score", "user_score", "metascore"])
    col_tags = pick_column(columns, ["tags", "tag"])
    col_price = pick_column(columns, ["price", "cost"])
    col_publisher = pick_column(columns, ["publisher", "publishers", "developer"])

    games: list[dict] = []
    for i, row in df.iterrows():
        name = str(row[col_name]) if col_name else f"Game {i}"
        gid = slug_id(name, int(i))

        year = None
        if col_year:
            try:
                raw_year = row[col_year]
                if raw_year is not None and str(raw_year) != "nan":
                    year = int(float(str(raw_year)[:4]))
            except (ValueError, TypeError):
                year = None

        rating = None
        if col_rating:
            try:
                r = row[col_rating]
                if r is not None and str(r) != "nan":
                    rating = float(r)
            except (ValueError, TypeError):
                rating = None

        price = None
        if col_price:
            try:
                p = row[col_price]
                if p is not None and str(p) != "nan":
                    price = float(p)
            except (ValueError, TypeError):
                price = None

        raw = {}
        for c in columns:
            v = row[c]
            if v is None or (isinstance(v, float) and str(v) == "nan"):
                raw[c] = None
            elif isinstance(v, (int, float)):
                raw[c] = v
            else:
                raw[c] = str(v)

        games.append(
            {
                "id": gid,
                "name": name,
                "genre": str(row[col_genre]) if col_genre and str(row[col_genre]) != "nan" else None,
                "platform": str(row[col_platform]) if col_platform and str(row[col_platform]) != "nan" else None,
                "year": year,
                "rating": rating,
                "tags": parse_tags(row[col_tags]) if col_tags else [],
                "price": price,
                "publisher": str(row[col_publisher]) if col_publisher and str(row[col_publisher]) != "nan" else None,
                "raw": raw,
            }
        )
    return games


def build_co_occurrence_pairs(games: list[dict], max_pairs: int = 50_000) -> list[dict]:
    """Proxy co-occurrence from shared genre/tags (until Steam play history trains the model)."""
    by_genre: dict[str, list[str]] = {}
    by_tag: dict[str, list[str]] = {}

    for g in games:
        gid = g["id"]
        genre = g.get("genre")
        if genre:
            by_genre.setdefault(genre, []).append(gid)
        for tag in g.get("tags") or []:
            by_tag.setdefault(tag.lower(), []).append(gid)

    pair_weights: dict[tuple[str, str], float] = {}

    def add_pairs(ids: list[str], weight: float) -> None:
        if len(ids) < 2:
            return
        limit = min(len(ids), 40)
        trimmed = ids[:limit]
        for i, a in enumerate(trimmed):
            for b in trimmed[i + 1 :]:
                if a == b:
                    continue
                key = (a, b) if a < b else (b, a)
                pair_weights[key] = pair_weights.get(key, 0) + weight

    for ids in by_genre.values():
        add_pairs(ids, 1.0)
    for ids in by_tag.values():
        add_pairs(ids, 0.5)

    pairs = [
        {"sourceGameId": a, "targetGameId": b, "weight": round(w, 4)}
        for (a, b), w in pair_weights.items()
    ]
    pairs.sort(key=lambda p: p["weight"], reverse=True)
    return pairs[:max_pairs]


def main() -> int:
    try:
        import kagglehub
        import pandas as pd
    except ImportError:
        print("Install deps: pip install kagglehub pandas", file=sys.stderr)
        return 1

    DATA_DIR.mkdir(parents=True, exist_ok=True)

    print("Downloading dataset mohamedhanyyy/video-games ...")
    path = kagglehub.dataset_download("mohamedhanyyy/video-games")
    root = Path(path)
    csv_files = list(root.rglob("*.csv"))
    if not csv_files:
        print(f"No CSV found under {root}", file=sys.stderr)
        return 1

    csv_path = max(csv_files, key=lambda p: p.stat().st_size)
    print(f"Using {csv_path}")
    df = pd.read_csv(csv_path)
    games = normalize_games(df)
    pairs = build_co_occurrence_pairs(games)

    GAMES_OUT.write_text(json.dumps(games, ensure_ascii=False, indent=2), encoding="utf-8")
    PAIRS_OUT.write_text(json.dumps(pairs, ensure_ascii=False, indent=2), encoding="utf-8")

    manifest = {
        "version": "1",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "source": "kaggle:mohamedhanyyy/video-games",
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
