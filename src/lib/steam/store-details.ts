export type SteamAppStoreMeta = {
  genres: string[];
  categories: string[];
};

type StoreAppDetails = {
  [appId: string]: {
    success: boolean;
    data?: {
      genres?: { description: string }[];
      categories?: { description: string }[];
    };
  };
};

/** Public Steam Store metadata (no API key). */
export async function fetchSteamAppStoreMeta(
  appId: number,
): Promise<SteamAppStoreMeta> {
  try {
    const res = await fetch(
      `https://store.steampowered.com/api/appdetails?appids=${appId}&filters=genres,categories&l=english`,
      { cache: "no-store" },
    );
    if (!res.ok) return { genres: [], categories: [] };
    const json = (await res.json()) as StoreAppDetails;
    const entry = json[String(appId)];
    if (!entry?.success || !entry.data) {
      return { genres: [], categories: [] };
    }
    return {
      genres: (entry.data.genres ?? []).map((g) => g.description).filter(Boolean),
      categories: (entry.data.categories ?? [])
        .map((c) => c.description)
        .filter(Boolean),
    };
  } catch {
    return { genres: [], categories: [] };
  }
}

/** Fetch store metadata for several AppIDs with limited concurrency. */
export async function fetchSteamAppStoreMetaBatch(
  appIds: number[],
  concurrency = 5,
): Promise<Map<number, SteamAppStoreMeta>> {
  const out = new Map<number, SteamAppStoreMeta>();
  const queue = [...new Set(appIds.filter((id) => id > 0))];

  async function worker() {
    while (queue.length) {
      const id = queue.shift();
      if (id == null) break;
      out.set(id, await fetchSteamAppStoreMeta(id));
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, queue.length || 1) }, () =>
      worker(),
    ),
  );

  return out;
}
