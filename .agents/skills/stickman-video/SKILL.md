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
3. Verify the output `.mp4` file exists, is non-empty, and matches the target duration (e.g., 15s for Reels).
4. Report the exact output file path back to the Manager (for `stickman-ig`).
