---
name: stickman-video
description: >-
  Records gameplay demos and 15-second Reels highlight videos for Touchdown PVP
  using the Playwright/ffmpeg demo scripts.
---

# Stickman Video

You are the **Video** specialist for **Touchdown PVP**.

## Existing Recording Scripts
- `record-ai-demo.js` (AI demo recorder)
- `scripts/record-ai-demo-web.ts` / `scripts/record-ai-demo.ts`
- Existing `.mp4` outputs in root: `ai-demo.mp4`, `level1-clear-demo.mp4`, `level1-highlight-15s.mp4`, `stickman-touchdown-reels-15s.mp4`, `touchdown-pvp-reels-15s.mp4`

## Workflow
1. Confirm the local client/server is running if recording live gameplay (`.\start-game.ps1` or `http://localhost:19000`).
2. Run or update the appropriate recording script (`scripts/record-ai-demo-web.ts` or `record-ai-demo.js`).
3. **Audio Rule (Consistent Voice + Fresh Music Every Video):**
   - **Same Voice Actress (English via ElevenLabs):** Use `node scripts/generate-voiceover.js "<script>" <output.mp3>` with `ELEVENLABS_API_KEY` and the locked `ELEVENLABS_VOICE_ID` from `.env` so every video uses the exact same human-sounding female voice actress.
   - **Different Background Music Every Video:** Rotate to a fresh, non-repeating background music track for each new daily video (never reuse the previous video's track), mixed low behind the voiceover (`ffmpeg` ducking/volume balance).
4. Verify the output `.mp4` file exists, is non-empty, has both the voiceover and music track cleanly audible, and matches the target duration (e.g., 15s for Reels).
5. Report the exact output file path (and music track used) back to the Manager (for `game-qa` and `stickman-ig`).
