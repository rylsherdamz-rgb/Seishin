// Renders the widget promo video and screenshots from promo/src/scene.html.
//
//   node promo/render.mjs            # screens + video
//   node promo/render.mjs screens    # screens only
//
// Needs Playwright (Chromium) and ffmpeg on PATH. Output goes to promo/.
import { createRequire } from "node:module";
import { spawn, execSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
function loadPlaywright() {
  try {
    return require("playwright");
  } catch {
    const globalRoot = execSync("npm root -g").toString().trim();
    return require(join(globalRoot, "playwright"));
  }
}
const { chromium } = loadPlaywright();

const here = dirname(fileURLToPath(import.meta.url));
const scene = pathToFileURL(join(here, "src", "scene.html")).href;
const FPS = 30;
const only = process.argv[2];

const browser = await chromium.launch();

async function screens() {
  const dir = join(here, "screens");
  mkdirSync(dir, { recursive: true });
  const page = await browser.newPage({ viewport: { width: 2100, height: 1200 }, deviceScaleFactor: 3 });
  await page.goto(scene);
  await page.evaluate(() => document.fonts.ready);
  const shots = [
    ["today", "light"], ["today", "dark"],
    ["tasks", "light"], ["tasks", "dark"],
    ["month", "light"], ["month", "dark"],
    ["nextup", "light"], ["nextup", "dark"],
    ["quick", "light"], ["quick", "dark"],
    ["home", "light"], ["home", "dark"],
    ["themes", "light"],
  ];
  for (const [name, theme] of shots) {
    await page.evaluate(([n, t]) => window.renderStill(n, t), [name, theme]);
    const file = name === "themes" ? "widget-themes.png" : name === "home" ? `home-screen-${theme}.png` : `widget-${name}-${theme}.png`;
    await page.locator("#shot").screenshot({ path: join(dir, file), omitBackground: true });
    console.log("screen", file);
  }
  await page.close();
}

async function video() {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  await page.goto(scene);
  await page.evaluate(() => document.fonts.ready);
  const duration = await page.evaluate(() => window.DURATION);
  const frames = Math.round(duration * FPS);
  const outFile = join(here, "seishin-widgets-promo.mp4");
  const ff = spawn("ffmpeg", [
    "-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(FPS), "-i", "-",
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", "-preset", "slow", "-movflags", "+faststart", outFile,
  ], { stdio: ["pipe", "inherit", "inherit"] });
  for (let i = 0; i < frames; i++) {
    await page.evaluate((t) => window.render(t), i / FPS);
    const buf = await page.screenshot({ type: "png" });
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
    if (i % 60 === 0) console.log(`frame ${i}/${frames}`);
  }
  ff.stdin.end();
  await new Promise((res, rej) => ff.on("close", (c) => (c === 0 ? res() : rej(new Error(`ffmpeg exited ${c}`)))));
  // Poster frame for README / store listing.
  await page.evaluate(() => window.render(5.6));
  await page.screenshot({ path: join(here, "poster.png") });
  console.log("video", outFile);
  await page.close();
}

try {
  await screens();
  if (only !== "screens") await video();
} finally {
  await browser.close();
}
