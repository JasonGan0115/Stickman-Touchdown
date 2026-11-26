# VS AI Auto-Balance Goals (Levels 1–100)

Target progression rules for the **vs AI** mode across **Levels 1 to 100**:

1. **Levels 1–10 (Beginner Friendly)**
   - Must be easily cleared by a beginner player.
   - No punishing AI reaction speeds, resource advantages, or heavy player damage debuffs.

2. **Levels 11–49 (Progressive Ramp)**
   - Difficulty increases smoothly and monotonically with each level.
   - Bridges the gap from beginner-friendly (Levels 1–10) to high-challenge (Level 50+).

3. **Levels 50–100 (20/80 Odds & Beyond)**
   - Starting from **Level 50**, the AI should win over the player at **20/80 odds** (~20% player win rate / ~80% AI win rate).
   - Difficulty continues to scale upward from Level 50 through Level 100.

## Key Files
- `server/src/game/ai.ts` (`getAIBonus` scaling for difficulty `1–100`)
- `server/src/game/bot.ts` (`createBot`, `botTick`)
- `server/scripts/balanceSim.ts`

## Verification
- `npm --prefix server test`
- `npm --prefix server run sim`
