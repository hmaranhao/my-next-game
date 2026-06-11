import type { Page, Route } from "@playwright/test";
import type { NormalizedGame } from "../../src/types/game";
import type { NormalizedUserProfile } from "../../src/types/profile";

export const EMBEDDING_DIM = 128;

export function mockVector(seed = 0.1): number[] {
  return Array.from({ length: EMBEDDING_DIM }, (_, i) =>
    Math.min(1, seed + (i % 7) * 0.01),
  );
}

export const recommendedGame: NormalizedGame = {
  id: "1245620",
  steamAppId: 1245620,
  name: "ELDEN RING",
  genre: "Action, RPG",
  platform: "PC",
  year: 2022,
  rating: 9.3,
  tags: ["Souls-like", "Open World", "RPG"],
  price: 59.99,
  publisher: "FromSoftware Inc.",
  popularityScore: 0.92,
  positiveReviews: 500_000,
  recommendations: 400_000,
  shortDescription: "Souls-like em mundo aberto.",
  headerImage:
    "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1245620/header.jpg",
  screenshots: [],
  developers: ["FromSoftware Inc."],
  raw: { positive: 500_000, recommendations: 400_000 },
};

export const mockSteamProfile: NormalizedUserProfile = {
  source: "STEAM",
  steamId: "e2eplayer",
  displayName: "E2E Player",
  profileUrl: "https://steamcommunity.com/id/e2eplayer",
  avatarUrl: null,
  countryCode: "BR",
  accountCreatedAt: "2016-01-01T00:00:00Z",
  accountAgeYears: 9,
  isPublic: true,
  inferredGenres: ["RPG", "Action"],
  steamTags: ["RPG", "Open World"],
  lastPlayedGame: {
    appId: 292030,
    name: "The Witcher 3: Wild Hunt",
    playtimeMinutes: 3600,
    playtimeHours: 60,
    lastPlayedAt: "2026-06-01T00:00:00Z",
    iconUrl: null,
  },
  topGames: [
    {
      appId: 292030,
      name: "The Witcher 3: Wild Hunt",
      playtimeMinutes: 3600,
      playtimeHours: 60,
      lastPlayedAt: "2026-06-01T00:00:00Z",
      iconUrl: null,
    },
  ],
  recentGames: [
    {
      appId: 292030,
      name: "The Witcher 3: Wild Hunt",
      playtimeMinutes: 3600,
      playtimeHours: 60,
      lastPlayedAt: "2026-06-01T00:00:00Z",
      iconUrl: null,
    },
  ],
  libraryGames: [
    {
      appId: 292030,
      name: "The Witcher 3: Wild Hunt",
      playtimeMinutes: 3600,
      playtimeHours: 60,
      lastPlayedAt: "2026-06-01T00:00:00Z",
      iconUrl: null,
    },
  ],
  playedAppIds: [292030],
  playedGameNames: [],
  totalPlaytimeMinutes: 7200,
  achievementSample: null,
};

export const mockManualProfile: NormalizedUserProfile = {
  source: "MANUAL",
  steamId: null,
  displayName: "Manual Tester",
  profileUrl: null,
  avatarUrl: null,
  countryCode: "BR",
  accountCreatedAt: null,
  accountAgeYears: null,
  isPublic: false,
  inferredGenres: ["RPG", "Indie"],
  topGames: [],
  recentGames: [],
  playedAppIds: [],
  playedGameNames: ["Hades"],
  totalPlaytimeMinutes: 600,
  achievementSample: null,
};

function candidatesPayload(snapshotId: string) {
  const queryVector = mockVector(0.2);
  const gameVector = mockVector(0.35);

  return {
    ok: true,
    sessionId: "e2e-session",
    metric: "cosine",
    queryVector,
    playedGameWeightedVector: queryVector,
    candidates: [
      {
        rank: 1,
        gameId: recommendedGame.id,
        name: recommendedGame.name,
        genre: recommendedGame.genre,
        platform: recommendedGame.platform,
        rating: recommendedGame.rating,
        score: 0.91,
        vectorScore: 0.88,
        popularityScore: 0.85,
        anchorAffinity: 0.72,
        distance: 0.12,
        gameVector,
        metadata: recommendedGame,
      },
    ],
    elapsedMs: 42,
    catalogGameCount: 3,
    candidatePoolSize: 3,
    rankedCandidateCount: 1,
    searchBackend: "memory",
    useSampleCatalog: true,
    finalPickTopN: 30,
    rejectedGameIds: [],
    profileTags: ["RPG", "Action"],
    anchorTier: "AAA",
    anchorGames: [{ name: "The Witcher 3: Wild Hunt", playtimeHours: 60, tier: "AAA" }],
    embedding: { dimension: EMBEDDING_DIM, layout: "128-dim", vocabSizes: {} },
    snapshotId,
  };
}

async function fulfillJson(route: Route, body: unknown) {
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

export async function mockConsent(page: Page) {
  await page.route("**/api/consent", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    await fulfillJson(route, { ok: true, consentId: "e2e-consent-id" });
  });
}

export async function mockTrainingData(page: Page) {
  await page.route("**/api/games/training-data", async (route) => {
    await fulfillJson(route, {
      ok: true,
      pairs: [
        {
          sourceGameId: "292030",
          targetGameId: recommendedGame.id,
          weight: 1,
        },
      ],
      gameVectors: {
        "292030": mockVector(0.25),
        [recommendedGame.id]: mockVector(0.35),
      },
      dimension: EMBEDDING_DIM,
      pairCount: 1,
      gameCount: 2,
    });
  });
}

export async function mockCandidates(page: Page) {
  await page.route("**/api/recommendations/candidates", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    const body = route.request().postDataJSON() as { snapshotId?: string } | null;
    await fulfillJson(route, candidatesPayload(body?.snapshotId ?? "e2e-snapshot"));
  });
}

export async function mockSteamHappyPath(page: Page) {
  await mockConsent(page);
  await mockTrainingData(page);
  await mockCandidates(page);
  await page.route("**/api/profile/steam", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    await fulfillJson(route, {
      ok: true,
      snapshotId: "e2e-steam-snapshot",
      profile: mockSteamProfile,
    });
  });
}

export async function mockSteamPrivateProfile(page: Page) {
  await mockConsent(page);
  await page.route("**/api/profile/steam", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    await route.fulfill({
      status: 403,
      contentType: "application/json",
      body: JSON.stringify({
        ok: false,
        code: "PROFILE_PRIVATE",
        message: "Profile is private",
      }),
    });
  });
}

export async function mockManualHappyPath(page: Page) {
  await mockConsent(page);
  await mockTrainingData(page);
  await mockCandidates(page);
  await page.route("**/api/profile/manual", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    await fulfillJson(route, {
      ok: true,
      snapshotId: "e2e-manual-snapshot",
      profile: mockManualProfile,
    });
  });
}
