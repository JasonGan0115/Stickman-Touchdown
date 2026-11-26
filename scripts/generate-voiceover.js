/**
 * Generates a voiceover MP3 using the ElevenLabs API.
 * Usage: node scripts/generate-voiceover.js "Your script text" [outputPath]
 */
const fs = require("fs");
const path = require("path");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
}

async function main() {
  loadEnvFile(path.resolve(__dirname, "..", ".env"));

  const text = process.argv[2];
  const outputPath = path.resolve(process.argv[3] || "voiceover.mp3");
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID || "EXAVITQu4vr4xnSDxMaL";

  if (!text) {
    console.error('Usage: node scripts/generate-voiceover.js "Your script text" [outputPath]');
    process.exit(1);
  }
  if (!apiKey || apiKey === "your_elevenlabs_api_key_here") {
    console.error("Missing ELEVENLABS_API_KEY. Add it to .env in the project root.");
    process.exit(1);
  }

  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text,
      model_id: "eleven_multilingual_v2",
      voice_settings: {
        stability: 0.45,
        similarity_boost: 0.78,
        style: 0.35,
        use_speaker_boost: true,
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`ElevenLabs API error (${res.status}): ${errText}`);
    process.exit(1);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(outputPath, buffer);
  console.log(`Saved voiceover to ${outputPath} (${buffer.length} bytes)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
