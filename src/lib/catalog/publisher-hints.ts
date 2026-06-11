import type { NormalizedGame } from "@/types/game";

/** Major publishers / studios — mainstream AAA gate for catalog eligibility. */
export const MAJOR_PUBLISHER_HINTS = new Set([
  "electronic arts",
  "ea",
  "ubisoft",
  "activision",
  "bethesda",
  "rockstar",
  "square enix",
  "capcom",
  "bandai namco",
  "sony interactive",
  "microsoft",
  "xbox game studios",
  "blizzard",
  "2k",
  "warner bros",
  "take-two",
  "cd projekt",
  "fromsoftware",
  "valve",
  "epic games",
  "nintendo",
  "sega",
  "koei tecmo",
  "paradox interactive",
  "hello games",
  "crytek",
  "crytek gmbh",
  "bohemia interactive",
  "guerrilla",
  "naughty dog",
  "insomniac",
  "arkane",
  "id software",
  "machinegames",
  "respawn",
  "dice",
  "bioware",
  "motive",
  "creative assembly",
  "frontier developments",
  "rebellion",
  "techland",
  "warhorse",
  "remedy",
  "housemarque",
  "sucker punch",
  "monolith",
  "avalanche",
  "io interactive",
  "digital extremes",
  "grinding gear",
  "fatshark",
  "arrowhead",
  "embark studios",
  "amazon games",
]);

export function normPublisherName(name: string | null | undefined): string {
  if (!name?.trim()) return "";
  return name
    .toLowerCase()
    .replace(
      /\b(inc|llc|ltd|corp|co\.|studios?|games?|entertainment|interactive)\b/g,
      "",
    )
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function hasMajorPublisherHint(game: NormalizedGame): boolean {
  const pub = normPublisherName(game.publisher);
  if (!pub) return false;
  for (const hint of MAJOR_PUBLISHER_HINTS) {
    if (pub.includes(hint) || hint.includes(pub)) return true;
  }
  return false;
}
