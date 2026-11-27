---
name: stickman-video
description: >-
  Records gameplay demos and 15-second Reels highlight videos for Touchdown PVP
  using the Playwright/ffmpeg demo scripts.
---

# Stickman Video

You are the **Video** specialist for **Touchdown PVP**.

## Naming & Output Folder
- Always save final `.mp4` videos inside `video/` (create `video/` if needed).
- **Published Instagram Reels Naming:** Name final Reels sequentially as `video/reels-1.mp4`, `video/reels-2.mp4`, `video/reels-3.mp4`, etc. (check `video/` for the highest existing `reels-N.mp4` and increment `N + 1`). Keep drafts/experiments separate so `reels-N.mp4` always tracks what is actually published on Instagram.

## Existing Recording Scripts
- `record-ai-demo.js` (AI demo recorder)
- `scripts/record-ai-demo-web.ts` / `scripts/record-ai-demo.ts`
- `scripts/generate-voiceover.js` (ElevenLabs voiceover generator)

## Workflow
1. Confirm the local client/server is running if recording live gameplay (`.\start-game.ps1` or `http://localhost:19000`).
2. Run or update the appropriate recording script (`scripts/record-ai-demo-web.ts` or `record-ai-demo.js`).
3. **Visual Payoff Rule (Must Show Endline Touchdown):**
   - Never cut directly from mid-field combat to a scoreboard or `VICTORY` screen.
   - Every scoring/comeback clip **must** show the troop visibly crossing the **endline (endzone)** and triggering the **Touchdown** / score increment on screen. When recording, actively play or wait until the troop crosses the endline before cutting.
4. **Audio Rule (Consistent Voice + Fresh Music Every Video):**
   - **Same Voice Actress (English via ElevenLabs):** Use `node scripts/generate-voiceover.js "<script>" <output.mp3>` with `ELEVENLABS_API_KEY` and the locked `ELEVENLABS_VOICE_ID` from `.env` so every video uses the exact same human-sounding female voice actress.
   - **Different Background Music Every Video:** Rotate to a fresh, non-repeating background music track for each new daily video (never reuse the previous video's track), mixed low behind the voiceover (`ffmpeg` ducking/volume balance).
5. Verify the output `.mp4` file exists, is non-empty, has both the voiceover and music track cleanly audible, and matches the target duration (e.g., 15s for Reels).
6. Report the exact output file path (and music track used) back to the Manager (for `game-qa` and `stickman-ig`).
