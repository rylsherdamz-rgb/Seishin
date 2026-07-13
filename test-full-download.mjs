#!/usr/bin/env node
// Full end-to-end test: YouTube Music search → download → verify
// Usage: node test-full-download.mjs "search query"
//        node test-full-download.mjs "https://youtube.com/watch?v=..."

import { execSync } from "child_process";
import { existsSync, mkdirSync, writeFileSync, readFileSync, statSync } from "fs";
import { join } from "path";

const SEARCH_QUERY = process.argv[2] || "Saksi Ang Langit December Avenue";
const OUTPUT_DIR = join(process.cwd(), "test_download_output");

const YT_MUSIC_API = "https://music.youtube.com/youtubei/v1/search?key=AIzaSyC9XL3ZjWddXya6X74dJoCTL-WEYFDNX30";

function log(msg) {
  console.log(`  ${msg}`);
}

function extractVideoIdFromResponse(data) {
  try {
    const tabs = data?.contents?.tabbedSearchResultsRenderer?.tabs;
    if (!tabs?.length) return null;
    const sections = tabs[0]?.tabRenderer?.content?.sectionListRenderer?.contents;
    if (!sections?.length) return null;
    const card = sections[0]?.musicCardShelfRenderer;
    if (card?.onTap?.watchEndpoint?.videoId) {
      return { videoId: card.onTap.watchEndpoint.videoId, title: card.title?.runs?.[0]?.text || "" };
    }
    for (const section of sections) {
      const items = section?.itemSectionRenderer?.contents || [];
      for (const item of items) {
        const r = item?.musicResponsiveListItemRenderer;
        if (!r) continue;
        for (const col of r.flexColumn || []) {
          const runs = col?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || [];
          for (const run of runs) {
            const vid = run?.navigationEndpoint?.watchEndpoint?.videoId;
            if (vid) return { videoId: vid, title: r.flexColumn?.[0]
              ?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text || "" };
          }
        }
        const vid = r.playlistItemData?.videoId;
        if (vid) return { videoId: vid, title: "" };
      }
    }
  } catch {}
  return null;
}

function extractYouTubeId(url) {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  return m?.[1] || null;
}

async function main() {
  console.log("\n═══════════════════════════════════════════");
  console.log("  Full Download Test — YouTube Music");
  console.log(`  Query: "${SEARCH_QUERY}"`);
  console.log("═══════════════════════════════════════════\n");

  // Clean output dir
  if (existsSync(OUTPUT_DIR)) {
    execSync(`rm -rf "${OUTPUT_DIR}"`);
  }
  mkdirSync(OUTPUT_DIR, { recursive: true });

  const results = { query: SEARCH_QUERY, videoId: null, title: "", artist: "", duration: 0, audioFile: null, coverFile: null, lyrics: null, audioVerified: false, coverVerified: false, errors: [] };

  // ── Step 1: Search YouTube Music ──
  console.log("── Step 1: Search YouTube Music ──");
  let videoId = extractYouTubeId(SEARCH_QUERY);

  if (videoId) {
    log(`✓ Direct video ID: ${videoId}`);
    results.videoId = videoId;
  } else {
    log("Searching...");
    const res = await fetch(YT_MUSIC_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (compatible; Seishin/1.0)",
        Origin: "https://music.youtube.com",
      },
      body: JSON.stringify({
        context: { client: { clientName: "WEB_REMIX", clientVersion: "1.20250218.00.00" } },
        query: SEARCH_QUERY,
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      results.errors.push(`YouTube Music search failed: HTTP ${res.status}`);
      console.log(`  ✗ HTTP ${res.status}`);
    } else {
      const data = await res.json();
      const found = extractVideoIdFromResponse(data);
      if (found) {
        videoId = found.videoId;
        results.videoId = videoId;
        results.title = found.title;
        log(`✓ Found: https://www.youtube.com/watch?v=${videoId}`);
        log(`  Title: "${found.title}"`);
      } else {
        results.errors.push("No results found on YouTube Music");
        log("✗ No results found");
      }
    }
  }

  if (!videoId) {
    console.log("\n✗ Cannot continue without a video ID\n");
    writeResults(results);
    process.exit(1);
  }

  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

  // ── Step 2: Get video metadata + download audio via yt-dlp ──
  console.log("\n── Step 2: Download audio via yt-dlp ──");
  try {
    const outputTemplate = join(OUTPUT_DIR, "%(id)s.%(ext)s");
    const metadataFile = join(OUTPUT_DIR, "yt_info.json");

    // Get metadata
    log("Fetching metadata...");
    const metaCmd = `yt-dlp --dump-json --no-download "${videoUrl}" 2>/dev/null`;
    const metaJson = execSync(metaCmd, { encoding: "utf-8", timeout: 15000 });
    const meta = JSON.parse(metaJson.trim().split("\n")[0]);
    writeFileSync(metadataFile, JSON.stringify(meta, null, 2));

    results.title = results.title || meta.title;
    results.artist = meta.artist || meta.uploader || "Unknown";
    results.duration = meta.duration || 0;

    log(`  Title: "${meta.title}"`);
    log(`  Artist: ${results.artist}`);
    log(`  Duration: ${Math.floor(results.duration / 60)}:${String(results.duration % 60).padStart(2, "0")}`);
    log(`  Uploader: ${meta.uploader}`);
    log(`  View count: ${meta.view_count?.toLocaleString() || "?"}`);
    if (meta.like_count) log(`  Likes: ${meta.like_count.toLocaleString()}`);

    // Download audio as mp3
    log("\nDownloading audio...");
    const audioOutput = join(OUTPUT_DIR, `${videoId}.%(ext)s`);
    execSync(`yt-dlp -x --audio-format mp3 --audio-quality 0 ` +
      `-o "${audioOutput}" --no-playlist "${videoUrl}" 2>&1`, { stdio: "pipe", timeout: 120000 });

    // Find the audio file
    const audioFiles = ["mp3", "m4a", "opus", "webm", "aac", "ogg"]
      .map(ext => join(OUTPUT_DIR, `${videoId}.${ext}`))
      .filter(f => existsSync(f));

    if (audioFiles.length > 0) {
      results.audioFile = audioFiles[0];
      const size = statSync(audioFiles[0]).size;
      results.audioVerified = size > 10000;
      log(`  ✓ Saved: ${audioFiles[0].split("/").pop()} (${(size / 1024 / 1024).toFixed(2)} MB)`);
    } else {
      results.errors.push("Audio file not found after download");
      log(`  ✗ Audio file not found`);
    }
  } catch (e) {
    results.errors.push(`yt-dlp error: ${e.message}`);
    log(`  ✗ ${e.message}`);
  }

  // ── Step 3: Download cover art ──
  console.log("\n── Step 3: Download cover art ──");
  try {
    const thumbPattern = join(OUTPUT_DIR, `${videoId}.*`);
    const thumbFiles = ["jpg", "png", "webp", "jpeg"]
      .map(ext => join(OUTPUT_DIR, `${videoId}.${ext}`))
      .filter(f => existsSync(f));

    if (thumbFiles.length > 0) {
      results.coverFile = thumbFiles[0];
      const size = statSync(thumbFiles[0]).size;
      results.coverVerified = size > 1000;
      log(`  ✓ Found: ${thumbFiles[0].split("/").pop()} (${(size / 1024).toFixed(1)} KB)`);
    } else {
      // Try to download thumbnail
      const cmd = `yt-dlp --skip-download --write-thumbnail --convert-thumbnails jpg ` +
        `-o "${join(OUTPUT_DIR, videoId)}" --no-playlist "${videoUrl}" 2>/dev/null`;
      execSync(cmd, { stdio: "pipe", timeout: 15000 });
      const retryFiles = ["jpg", "png", "webp", "jpeg"]
        .map(ext => join(OUTPUT_DIR, `${videoId}.${ext}`))
        .filter(f => existsSync(f));
      if (retryFiles.length > 0) {
        results.coverFile = retryFiles[0];
        const size = statSync(retryFiles[0]).size;
        results.coverVerified = size > 1000;
        log(`  ✓ Downloaded: ${retryFiles[0].split("/").pop()} (${(size / 1024).toFixed(1)} KB)`);
      } else {
        results.errors.push("Cover art not found after download attempt");
        log("  ✗ Not found");
      }
    }
  } catch (e) {
    results.errors.push(`Cover download error: ${e.message}`);
    log(`  ✗ ${e.message}`);
  }

  // ── Step 4: Fetch lyrics ──
  console.log("\n── Step 4: Fetch lyrics ──");
  try {
    const cleanTitle = results.title.replace(/\(.*?\)|\[.*?\]/g, "").trim();
    const artistName = results.artist;
    const lyricsUrl = `https://api.lyrics.ovh/v1/${encodeURIComponent(artistName)}/${encodeURIComponent(cleanTitle)}`;
    const cmd = `curl -s --max-time 5 "${lyricsUrl}" 2>/dev/null`;
    const output = execSync(cmd, { encoding: "utf-8", timeout: 10000 }).trim();

    if (output) {
      const data = JSON.parse(output);
      if (data.lyrics?.length > 20) {
        results.lyrics = data.lyrics;
        const lyricsFile = join(OUTPUT_DIR, "lyrics.txt");
        writeFileSync(lyricsFile, data.lyrics);
        log(`  ✓ Saved (${data.lyrics.length} chars)`);
        console.log(`  ── Preview ──`);
        const lines = data.lyrics.slice(0, 300).split("\n").slice(0, 6);
        console.log(`  ${lines.join("\n  ")}`);
        if (data.lyrics.length > 300) console.log(`  ...`);
      } else {
        log(`  - No lyrics found (API returned empty or error)`);
      }
    } else {
      log(`  - No lyrics found (empty response)`);
    }
  } catch (e) {
    log(`  - Lyrics not available: ${e.message}`);
  }

  // ── Step 5: Write manifest ──
  console.log("\n── Step 5: Write manifest ──");
  const manifest = {
    testDate: new Date().toISOString(),
    query: SEARCH_QUERY,
    videoId: results.videoId,
    youtubeUrl: `https://www.youtube.com/watch?v=${results.videoId}`,
    metadata: {
      title: results.title,
      artist: results.artist,
      duration: results.duration,
    },
    files: {
      audio: results.audioFile ? { path: results.audioFile, exists: existsSync(results.audioFile || ""), verified: results.audioVerified } : null,
      cover: results.coverFile ? { path: results.coverFile, exists: existsSync(results.coverFile || ""), verified: results.coverVerified } : null,
      lyrics: results.lyrics ? { saved: true, length: results.lyrics.length } : null,
    },
    errors: results.errors,
    success: results.audioVerified && results.coverVerified,
  };

  const manifestPath = join(OUTPUT_DIR, "manifest.json");
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  log(`✓ Saved: manifest.json`);

  // ── Summary ──
  console.log("\n═══════════════════════════════════════════");
  console.log("  RESULTS");
  console.log("═══════════════════════════════════════════");
  console.log(`  Title:   ${results.title ? "✓" : "✗"} ${results.title || "missing"}`);
  console.log(`  Artist:  ${results.artist ? "✓" : "✗"} ${results.artist || "missing"}`);
  console.log(`  Audio:   ${results.audioVerified ? "✓" : "✗"} ${results.audioFile ? (statSync(results.audioFile).size / 1024 / 1024).toFixed(2) + " MB" : "missing"}`);
  console.log(`  Cover:   ${results.coverVerified ? "✓" : "✗"} ${results.coverFile ? (statSync(results.coverFile).size / 1024).toFixed(1) + " KB" : "missing"}`);
  console.log(`  Lyrics:  ${results.lyrics ? "✓" : "✗"} ${results.lyrics ? results.lyrics.length + " chars" : "missing"}`);
  if (results.errors.length > 0) {
    console.log(`\n  Errors (${results.errors.length}):`);
    for (const err of results.errors) console.log(`    ✗ ${err}`);
  }
  console.log(`\n  Output: ${OUTPUT_DIR}`);
  console.log("\n═══════════════════════════════════════════\n");
}

function writeResults(results) {
  const manifestPath = join(OUTPUT_DIR, "manifest.json");
  writeFileSync(manifestPath, JSON.stringify(results, null, 2));
}

main().catch((e) => {
  console.error("\n✗ Fatal error:", e.message);
  process.exit(1);
});
