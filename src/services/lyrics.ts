export interface LyricsResult {
  plainLyrics?: string;
  syncedLyrics?: string;
}

interface LrcLibEntry {
  plainLyrics?: string;
  syncedLyrics?: string;
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/\(.*?\)/g, "")
    .replace(/\[.*?\]/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

/**
 * Fetch lyrics from LRCLIB. Prefers synced (LRC) lyrics, falling back to
 * plain text. Returns null when nothing is found.
 */
export async function fetchLyrics(
  artist: string,
  title: string
): Promise<LyricsResult | null> {
  const queries = [
    `https://lrclib.net/api/get?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(title)}`,
    `https://lrclib.net/api/get?track_name=${encodeURIComponent(title)}`,
  ];

  for (const query of queries) {
    try {
      const res = await fetch(query, { headers: { Accept: "application/json" } });
      if (!res.ok) continue;
      const data = (await res.json()) as LrcLibEntry;
      const synced = data.syncedLyrics?.trim();
      const plain = data.plainLyrics?.trim();
      if (synced || plain) {
        return { syncedLyrics: synced || undefined, plainLyrics: plain || undefined };
      }
    } catch {
      // try next query
    }
  }
  return null;
}

/**
 * Best-effort match: LRCLIB also exposes a search endpoint. This is used when
 * the exact match returns nothing, comparing normalized titles for closeness.
 */
export async function searchLyrics(
  artist: string,
  title: string
): Promise<LyricsResult | null> {
  try {
    const res = await fetch(
      `https://lrclib.net/api/search?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(title)}`,
      { headers: { Accept: "application/json" } }
    );
    if (!res.ok) return null;
    const list = (await res.json()) as LrcLibEntry[];
    if (!Array.isArray(list) || !list.length) return null;
    const target = normalize(title);
    const best = list.find((e) => normalize(e.syncedLyrics || e.plainLyrics || "").includes(target));
    const entry = best || list[0];
    const synced = entry.syncedLyrics?.trim();
    const plain = entry.plainLyrics?.trim();
    if (synced || plain) {
      return { syncedLyrics: synced || undefined, plainLyrics: plain || undefined };
    }
  } catch {
    // ignore
  }
  return null;
}
