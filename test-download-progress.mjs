#!/usr/bin/env node
/**
 * Integration test: real download with progress tracking.
 *
 * Usage:
 *   node test-download-progress.mjs "https://example.com/file.mp3"
 *   node test-download-progress.mjs   # uses default test URL
 *
 * What it tests:
 *   1. HEAD request → Content-Length
 *   2. Streaming download with chunked progress reporting
 *   3. File write verification
 *   4. Same logic as File.downloadFileAsync + onProgress in the app
 */

const TEST_URL = process.argv[2] ||
  "https://www.learningcontainer.com/wp-content/uploads/2020/02/Kalimba.mp3";

import { writeFileSync, unlinkSync, existsSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const tmpFile = join(tmpdir(), `dl-progress-test-${Date.now()}.mp3`);

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function fmt(s) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}

async function main() {
  console.log("\n═══════════════════════════════════════════");
  console.log("  Download Progress Integration Test");
  console.log("═══════════════════════════════════════════\n");

  const startTime = Date.now();

  // ── Step 1: HEAD request ──
  console.log(`[1/5] HEAD → ${TEST_URL}`);
  let totalBytes = 0;
  try {
    const headRes = await fetch(TEST_URL, { method: "HEAD" });
    totalBytes = parseInt(headRes.headers.get("Content-Length") || "0", 10);
    console.log(`      Content-Length: ${totalBytes} (${formatBytes(totalBytes)})`);
    console.log(`      Content-Type:   ${headRes.headers.get("Content-Type") || "?"}`);
  } catch (e) {
    console.log(`      HEAD failed: ${e.message} (will use fallback estimate)`);
  }

  if (totalBytes === 0) {
    console.log(`      ⚠ No Content-Length — will show progress as estimated bytes`);
  }
  console.log("");

  // ── Step 2: Streaming download with progress ──
  console.log(`[2/5] Downloading...`);
  const res = await fetch(TEST_URL);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  const contentLen = parseInt(res.headers.get("Content-Length") || "0", 10);
  if (contentLen > 0) totalBytes = contentLen;

  const reader = res.body.getReader();
  const chunks = [];
  let received = 0;
  let lastPct = -1;
  let lastLog = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;

    const pct = totalBytes > 0
      ? Math.round((received / totalBytes) * 100)
      : received > 0
        ? Math.min(Math.round((received / (5 * 1024 * 1024)) * 100), 95)
        : 0;

    // Log every 5% or every 3 seconds
    const now = Date.now();
    if (pct !== lastPct || (now - lastLog > 3000 && pct > 0)) {
      const elapsed = ((now - startTime) / 1000).toFixed(1);
      const speed = received / ((now - startTime) / 1000);
      console.log(
        `      ${String(pct).padStart(3)}%  ` +
        `${formatBytes(received).padStart(9)} / ${formatBytes(totalBytes).padStart(9)}  ` +
        `[${fmt(elapsed)} @ ${formatBytes(speed)}/s]`
      );
      lastPct = pct;
      lastLog = now;
    }
  }

  const dlTime = (Date.now() - startTime) / 1000;
  const avgSpeed = received / dlTime;
  console.log(`      ✓ Download complete: ${formatBytes(received)} in ${fmt(dlTime)} (avg ${formatBytes(avgSpeed)}/s)`);
  console.log("");

  // ── Step 3: Write to file ──
  console.log(`[3/5] Writing to ${tmpFile}`);
  const buf = Buffer.concat(chunks);
  writeFileSync(tmpFile, buf);
  console.log(`      ✓ Wrote ${formatBytes(buf.length)}`);
  console.log("");

  // ── Step 4: Verification ──
  console.log(`[4/5] Verification`);
  const verified =
    buf.length > 0 &&
    (totalBytes === 0 || Math.abs(buf.length - totalBytes) < 100);
  console.log(`      File exists: ${existsSync(tmpFile)}`);
  console.log(`      File size:   ${formatBytes(buf.length)}`);
  console.log(`      Expected:    ${formatBytes(totalBytes)}`);
  console.log(`      Match:       ${verified ? "✓" : "✗"}`);
  console.log("");

  // ── Step 5: Cleanup ──
  console.log(`[5/5] Cleanup`);
  unlinkSync(tmpFile);
  console.log(`      ✓ Removed ${tmpFile}`);
  console.log("");

  // ── Summary ──
  const totalTime = (Date.now() - startTime) / 1000;
  console.log("═══════════════════════════════════════════");
  console.log("  RESULT: " + (verified ? "✓ ALL GOOD" : "✗ FAILED"));
  console.log(`  URL:       ${TEST_URL}`);
  console.log(`  Size:      ${formatBytes(received)}`);
  console.log(`  Time:      ${fmt(totalTime)}`);
  console.log(`  Avg Speed: ${formatBytes(avgSpeed)}/s`);
  console.log("═══════════════════════════════════════════\n");

  if (!verified) process.exit(1);
}

main().catch((e) => {
  console.error(`\n✗ Fatal: ${e.message}`);
  if (existsSync(tmpFile)) unlinkSync(tmpFile);
  process.exit(1);
});
