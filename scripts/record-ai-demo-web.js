const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

async function runDemo(difficulty = 100, durationSec = 15) {
  // 1️⃣ Launch Chromium with video recording
  const videoDir = path.resolve('.'); // project root
  const context = await chromium.launchPersistentContext('./tmp_user_data', {
    headless: false,
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: videoDir, size: { width: 1280, height: 720 } },
  });
  const page = await context.newPage();

  // 2️⃣ Open the Expo web dev server (default port 8081)
  console.log('🔗 Opening http://localhost:8081 ...');
  await page.goto('http://localhost:8081', { waitUntil: 'networkidle' });

  // 3️⃣ Navigate to AI Practice – adjust selectors if needed
  await page.click('text=Play vs AI Bot');

  // 4️⃣ Set difficulty via slider (expects <input type="range" data-testid="ai-difficulty"/>)
  const slider = await page.$('[data-testid="ai-difficulty"]');
  if (slider) {
    await slider.evaluate((el, val) => { el.value = val.toString(); }, difficulty);
    await slider.dispatchEvent('input');
    await slider.dispatchEvent('change');
  } else {
    console.warn('⚠️ No difficulty slider found – proceeding with default level');
  }

  // 5️⃣ Start the match (button label may be "Start" if configured)
  const startBtn = await page.$('text=Start');
  if (startBtn) {
    await startBtn.click();
  }

  // Dismiss kickoff draft modal if present
  try {
    const draftPick = await page.waitForSelector('text=TAP TO PICK', { timeout: 3000 });
    if (draftPick) await draftPick.click();
  } catch {}

  // 6️⃣ Wait for the requested duration while Playwright records
  console.log(`⏱️ Recording for ${durationSec}s ...`);
  const recordStartTime = Date.now();
  while (Date.now() - recordStartTime < durationSec * 1000) {
    try {
      const card = await page.$('text=Footsoldier') || await page.$('text=Archer') || await page.$('text=Shield Bearer');
      if (card) await card.click();
      await page.mouse.click(640, 560);
    } catch {}
    await page.waitForTimeout(2200);
  }

  const video = page.video();
  const rawPath = video ? await video.path() : null;

  // 7️⃣ Close context – finalizes the video file
  await context.close();

  // 8️⃣ Locate the generated .webm file
  let finalRawPath = rawPath;
  if (!finalRawPath || !fs.existsSync(finalRawPath)) {
    const files = fs.readdirSync(videoDir)
      .filter(f => f.endsWith('.webm'))
      .map(f => ({ name: f, time: fs.statSync(path.join(videoDir, f)).mtimeMs }))
      .sort((a, b) => b.time - a.time);
    if (files.length === 0) {
      console.error('❌ No video file produced.');
      return;
    }
    finalRawPath = path.join(videoDir, files[0].name);
  }

  const destPath = path.resolve('ai-demo.mp4');

  // Convert .webm to .mp4 via ffmpeg (assumes ffmpeg in PATH)
  const ff = spawn('ffmpeg', ['-y', '-i', finalRawPath, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', destPath]);
  await new Promise((res, rej) => {
    ff.on('close', code => (code === 0 ? res() : rej(new Error(`ffmpeg exited with code ${code}`))));
  });

  if (fs.existsSync(finalRawPath) && finalRawPath !== destPath) {
    try { fs.unlinkSync(finalRawPath); } catch {}
  }

  console.log(`✅ Video saved as ${destPath}`);
}

const args = process.argv.slice(2);
const difficulty = parseInt(args[0] ?? '100', 10);
const duration = parseInt(args[1] ?? '15', 10);
runDemo(difficulty, duration).catch(e => {
  console.error('❌ Demo failed:', e);
  process.exit(1);
});
