// Test script for YouTube Music download flow
// Run: node test-music-download.mjs

const TESTS = [];

function test(name, fn) {
  TESTS.push({ name, fn });
}

let passed = 0;
let failed = 0;

const YT_MUSIC_API = "https://music.youtube.com/youtubei/v1/search?key=AIzaSyC9XL3ZjWddXya6X74dJoCTL-WEYFDNX30";

function extractVideoId(url) {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  return m?.[1] || null;
}

function extractPlaylistId(url) {
  const m = url.match(/[?&]list=([a-zA-Z0-9_-]+)/);
  return m?.[1] || null;
}

// ───────────── PARSER TESTS ─────────────

test("extracts video ID from YouTube URL", () => {
  const r = extractVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  if (r !== "dQw4w9WgXcQ") throw new Error(`Got ${r}`);
});

test("extracts video ID from youtu.be URL", () => {
  const r = extractVideoId("https://youtu.be/dQw4w9WgXcQ");
  if (r !== "dQw4w9WgXcQ") throw new Error(`Got ${r}`);
});

test("extracts playlist ID from URL", () => {
  const r = extractPlaylistId("https://www.youtube.com/watch?v=abc&list=PLtest123");
  if (r !== "PLtest123") throw new Error(`Got ${r}`);
});

test("returns null for non-YouTube input", () => {
  if (extractVideoId("some search query")) throw new Error("Should be null");
});

// Simulate the new searchTracks parsing logic
function parseSearchResults(data) {
  const results = [];
  const sections = data?.contents?.tabbedSearchResultsRenderer?.tabs?.[0]
    ?.tabRenderer?.content?.sectionListRenderer?.contents || [];

  for (const section of sections) {
    // Top card — suggested songs
    const card = section?.musicCardShelfRenderer;
    if (card) {
      for (const content of (card.contents || [])) {
        const r = content?.musicResponsiveListItemRenderer;
        if (!r) continue;
        const videoId = r.playlistItemData?.videoId;
        if (!videoId) continue;
        const flex = r.flexColumns || [];
        const title = flex[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text || "";
        results.push({ videoId, title, source: "card" });
      }
    }

    // Song results
    const items = section?.itemSectionRenderer?.contents || [];
    for (const item of items) {
      const r = item?.musicResponsiveListItemRenderer;
      if (!r) continue;
      const videoId = r.playlistItemData?.videoId;
      if (!videoId) continue;
      const flex = r.flexColumns || [];
      const title = flex[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text || "";
      const subRuns = flex[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || [];
      const sepIdx = subRuns.findIndex((run) => run.text === " • ");
      let artist = "";
      if (sepIdx >= 0) {
        artist = subRuns.slice(sepIdx + 1).map((run) => run.text).join("").trim();
      }
      results.push({ videoId, title, artist, source: "list" });
    }
  }
  return results;
}

test("extracts videoId from mock YouTube Music response", () => {
  const mock = {
    contents: {
      tabbedSearchResultsRenderer: {
        tabs: [{
          tabRenderer: {
            content: {
              sectionListRenderer: {
                contents: [{
                  musicCardShelfRenderer: {
                    title: { runs: [{ text: "December Avenue" }] },
                    subtitle: { runs: [{ text: "Artist" }] },
                    contents: [
                      { musicResponsiveListItemRenderer: { playlistItemData: { videoId: "9MmT13mCLOE" }, flexColumns: [{ musicResponsiveListItemFlexColumnRenderer: { text: { runs: [{ text: "Saksi Ang Langit" }] } } }] } },
                    ],
                  },
                }],
              },
            },
          },
        }],
      },
    },
  };
  const results = parseSearchResults(mock);
  if (results.length !== 1) throw new Error(`Expected 1, got ${results.length}`);
  if (results[0].videoId !== "9MmT13mCLOE") throw new Error(`Got ${results[0].videoId}`);
});

test("returns null from empty response", () => {
  if (parseSearchResults({}).length > 0) throw new Error("Should be empty");
});

// ───────────── RUN PARSER TESTS ─────────────
console.log("\n═══ Parser tests ═══\n");
for (const t of TESTS) {
  try {
    t.fn();
    console.log(`  ✓ ${t.name}`);
    passed++;
  } catch (e) {
    console.log(`  ✗ ${t.name}: ${e.message}`);
    failed++;
  }
}

// ───────────── RUN LIVE YOUTUBE MUSIC TESTS ─────────────
console.log("\n═══ Live YouTube Music search tests ═══\n");

const queries = [
  "Saksi Ang Langit December Avenue",
  "Lifetime Ben&Ben",
  "Bohemian Rhapsody Queen",
];

for (const query of queries) {
  console.log(`\n── "${query}" ──`);
  try {
    const res = await fetch(YT_MUSIC_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (compatible; Seishin/1.0)",
        Origin: "https://music.youtube.com",
      },
      body: JSON.stringify({
        context: { client: { clientName: "WEB_REMIX", clientVersion: "1.20250218.00.00" } },
        query,
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const results = parseSearchResults(data);

    if (results.length > 0) {
      console.log(`  Total results: ${results.length}`);
      console.log(`  Top: "${results[0].title}" — ${results[0].videoId}`);
      // Show first 5 results
      for (const r of results.slice(0, 5)) {
        console.log(`    ${r.source === "card" ? "★" : "·"} ${r.title}${r.artist ? ` — ${r.artist}` : ""}`);
      }
      if (results.length > 5) console.log(`    ... and ${results.length - 5} more`);
      passed++;
    } else {
      console.log(`  ✗ No results found`);
      failed++;
    }
  } catch (e) {
    console.log(`  ✗ ${e.message}`);
    failed++;
  }
}

console.log(`\n══════════════════════════`);
console.log(`  Passed: ${passed}  Failed: ${failed}`);
console.log(`══════════════════════════\n`);

process.exit(failed > 0 ? 1 : 0);
