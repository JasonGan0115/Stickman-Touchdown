// Record a short video of the VS‑AI practice mode.
// Prerequisites: expo-cli, ffmpeg (in PATH), playwright (npm i -D playwright).
// Usage: npx ts-node scripts/record-ai-demo.ts [difficulty] [durationSec]

import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import { chromium } from "playwright";

async function startExpo(): Promise<ChildProcessWithoutNullStreams> {
  console.log("🚀 Starting Expo dev server …");
  const expo = spawn("expo", ["start", "--clear"], { cwd: "client", stdio: "inherit" });
  await new Promise((r) => setTimeout(r, 8000));
  return expo;
}

async function launchEmulator(): Promise<void> {
  console.log("📱 Launching Android emulator …");
  await new Promise((resolve, reject) => {
    const avd = spawn("emulator", ["-avd", "Pixel_5_API_33"], { stdio: "inherit" });
    avd.on("error", reject);
    setTimeout(resolve, 20000);
  });
}

async function startRecording(duration: number): Promise<ChildProcessWithoutNullStreams> {
  console.log(`📹 Recording ${duration}s to ai-demo.mp4 …`);
  const ffmpeg = spawn(
    "ffmpeg",
    [
      "-y",
      "-f",
      "gdigrab",
      "-framerate",
      "30",
      "-i",
      "title=Pixel_5_API_33",
      "-t",
      `${duration}`,
      "ai-demo.mp4",
    ],
    { stdio: "inherit" }
  );
  return ffmpeg;
}

async function runDemo(difficulty = 50, duration = 15) {
  const expo = await startExpo();
  await launchEmulator();

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("http://localhost:19000");
  await page.waitForTimeout(5000);

  await page.click("text=Play vs AI Bot");
  const slider = await page.$('[data-testid="ai-difficulty"]');
  if (slider) {
    const width = await slider.evaluate((el) => (el as HTMLElement).offsetWidth);
    const targetX = (difficulty / 100) * width;
    const box = await slider.boundingBox();
    if (box) {
      await page.mouse.move(box.x + 5, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + targetX, box.y + box.height / 2);
      await page.mouse.up();
    }
  }
  await page.click("text=Start");

  const ffmpeg = await startRecording(duration);
  await new Promise((resolve) => ffmpeg.on("close", resolve));

  await browser.close();
  expo.kill();
  console.log("✅ Video saved as ai-demo.mp4");
}

const args = process.argv.slice(2);
const difficulty = parseInt(args[0] ?? "50", 10);
const duration = parseInt(args[1] ?? "15", 10);
runDemo(difficulty, duration).catch((e) => {
  console.error("❌ Demo failed:", e);
  process.exit(1);
});
