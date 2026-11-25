// record-ai-demo-web.ts – Capture a short video of the VS‑AI mode via Playwright (web version)
// Prerequisites (install once):
//   npm i -D playwright
//   expo start --web   (starts the web dev server on port 8081)
//   Ensure the VS‑AI UI has a difficulty selector with data-testid="ai-difficulty"
//   This script will:
//     1. Launch Chromium (headless: false) with video recording enabled.
//     2. Open http://localhost:8081
//     3. Navigate to the Practice section, set difficulty, start match.
//     4. Record ~15 seconds of gameplay.
//     5. Save the video to project root as ai-demo.mp4.

import { chromium, BrowserContext } from "playwright";
import path from "path";
import fs from "fs";

async function runDemo(difficulty: number = 100, durationSec: number = 15) {
  // 1️⃣ Launch Chromium with video recording
  const videoDir = path.resolve("."); // project root
  const context: BrowserContext = await chromium.launchPersistentContext("./tmp_user_data", {
    headless: false,
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: videoDir, size: { width: 1280, height: 720 } },
  });
  const page = await context.newPage();

  // 2️⃣ Open the Expo web dev server
  console.log("🔗 Opening http://localhost:8081 …");
  await page.goto("http://localhost:8081", { waitUntil: "networkidle" });

  // 3️⃣ Navigate to AI Practice – the exact selector may vary
  // Adjust these selectors if your UI differs.
  await page.click("text=Play vs AI Bot");

  // 4️⃣ Set difficulty via slider (assuming <input type="range" data-testid="ai-difficulty"/>)
  const slider = await page.$('[data-testid="ai-difficulty"]');
  if (slider) {
    // set value directly
    await slider.evaluate((el, val) => ((el as HTMLInputElement).value = val.toString()), difficulty);
    // trigger input event
    await slider.dispatchEvent("input");
    await slider.dispatchEvent("change");
  } else {
    console.warn("⚠️ No difficulty slider found – proceeding with default level");
  }

  // 5️⃣ Start the match – button label may be "Start" or similar
  await page.click("text=Start");

  // 6️⃣ Wait for the requested duration while Playwright records
  console.log(`⏱️ Recording for ${durationSec}s …`);
  await page.waitForTimeout(durationSec * 1000);

  // 7️⃣ Close context – this finalizes the video file
  await context.close();

  // 8️⃣ Locate the generated .webm file (Playwright names it something like "video.webm")
  const files = fs.readdirSync(videoDir).filter((f) => f.endsWith(".webm"));
  if (files.length === 0) {
    console.error("❌ No video file produced.");
    return;
  }
  const rawPath = path.join(videoDir, files[0]);
  const destPath = path.resolve("ai-demo.mp4");
  // Convert .webm to .mp4 using ffmpeg (if available)
  const ffmpegPath = "ffmpeg"; // assumed in PATH
  const { spawn } = require("child_process");
  const ff = spawn(ffmpegPath, ["-y", "-i", rawPath, destPath]);
  await new Promise((res) => ff.on("close", res));
  console.log(`✅ Video saved as ${destPath}`);
}

const args = process.argv.slice(2);
const difficulty = parseInt(args[0] ?? "100", 10);
const duration = parseInt(args[1] ?? "15", 10);
runDemo(difficulty, duration).catch((e) => {
  console.error("❌ Demo failed:", e);
  process.exit(1);
});
