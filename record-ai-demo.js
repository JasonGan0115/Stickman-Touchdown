// Auto-generated JS version of record-ai-demo.ts
const { spawn } = require('child_process');
const { chromium } = require('playwright');

async function startExpo() {
  console.log('🚀 Skipping Expo start (assume already running)');
  return { kill: () => {} };
}

async function launchEmulator() {
  console.log('🚫 Skipping Android emulator launch (not available)');
}

async function startRecording(duration) {
  console.log(`📹 Recording ${duration}s to ai-demo.mp4 …`);
  const ffmpeg = spawn('C:\\Program Files\\SteelSeries\\GG\\apps\\moments\\ffmpeg.exe', [
    '-y',
    '-f', 'gdigrab',
    '-framerate', '30',
    '-i', 'title=Pixel_5_API_33',
    '-t', `${duration}`,
    'ai-demo.mp4'
  ], { stdio: 'inherit' });
  return ffmpeg;
}

async function runDemo(difficulty = 50, duration = 15) {
  const expo = await startExpo();
  await launchEmulator();

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('http://localhost:19000');
  await page.waitForTimeout(5000);

  await page.click('text=Play vs AI Bot');
  const slider = await page.$('[data-testid="ai-difficulty"]');
  if (slider) {
    const width = await slider.evaluate(el => el.offsetWidth);
    const targetX = (difficulty / 100) * width;
    const box = await slider.boundingBox();
    if (box) {
      await page.mouse.move(box.x + 5, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + targetX, box.y + box.height / 2);
      await page.mouse.up();
    }
  }
  await page.click('text=Start');

  const ffmpeg = await startRecording(duration);
  await new Promise(resolve => ffmpeg.on('close', resolve));

  await browser.close();
  expo.kill();
  console.log('✅ Video saved as ai-demo.mp4');
}

const args = process.argv.slice(2);
const difficulty = parseInt(args[0] ?? '50', 10);
const duration = parseInt(args[1] ?? '15', 10);
runDemo(difficulty, duration).catch(e => {
  console.error('❌ Demo failed:', e);
  process.exit(1);
});
