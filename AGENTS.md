# Touchdown PVP (Stickman Touchdown)

Real-time 9:16 mobile/web PvP & VS AI game built with React Native + Expo (`client/`) and Node.js + Express + Socket.IO + Prisma (`server/`).

## Project Map

- `client/` — React Native + Expo (`App.tsx`, `src/screens/`, `src/components/`, `src/store/useGameStore.ts`, `src/services/`, `src/game/`). Deployed to Netlify (`netlify.toml`).
- `server/` — Node.js, Express, Socket.IO, Prisma ORM (`src/index.ts`, `src/game/`, `src/routes/`, `prisma/schema.prisma`, `scripts/balanceSim.ts`). Deployed to Render (`render.yaml`).
- `scripts/` — Recording & media helpers (`record-ai-demo-web.ts`, `record-ai-demo.ts`, `generate-voiceover.js`).
- `.agents/` — Project rules (`.agents/rules/`) and specialist skills (`.agents/skills/`).
- Key docs: `README.md` (core gameplay rules), `VS_AI_BALANCE_GOALS.md` (VS AI Lv. 1–100 targets), `GAME.md` (single source of truth for game design, match-flow rules, and backlog).

## Key Commands

Run from the repo root (`c:\Users\User\Touchdown PVP`):

```powershell
# Start local server + client
.\start-game.ps1

# Server unit & regression tests
npm --prefix server test

# Headless AI balance simulation
npm --prefix server run sim

# Client lint & typecheck
npm --prefix client run lint
npx --prefix client tsc -p client/tsconfig.json --noEmit

# Client web export check (Netlify build)
npm --prefix client exec expo export -- -p web
```

## Agent Pipeline (`manager`)

For multi-step features, balance changes, or shipping to production, follow `.agents/skills/manager/SKILL.md`:

- **Core Game Pipeline:** `idea-validator` → `game-builder` / `game-balancer` → `game-testing` → `game-qa` → `stickman-git` → `stickman-autodeploy`
- **Optional Daily Video Track (only when preparing the 1 daily video or when requested):** `idea-validator` → `video-researcher` → `game-testing` / `game-qa` → `stickman-video` → `game-qa` → `stickman-ig`

### Rules to Remember
- **Always read `GAME.md` first:** Before planning, building, or fixing anything, read `GAME.md` so all work aligns with the current game design, match-flow rules, and active backlog.
- **Validate first:** Run `idea-validator` before implementing new mechanics, balance changes, or video ideas.
- **Verify before shipping:** Never push to `origin` (which triggers Netlify & Render production deploys) until `game-testing` and `game-qa` pass (or the user explicitly approves).
- **Stage intentionally:** Follow `.agents/rules/auto-push.md` and avoid blind `git add -A`.
