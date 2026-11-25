# Stickman Touchdown (Touchdown PVP)

**Play Live (Beta):** https://stickman-touchdown.netlify.app

A fast-paced, real-time 1v1 tactical football/PvP web & mobile game. Summon sticky troops onto a 9:16 gridiron, outmaneuver your opponent, and push into the enemy endzone—**first to 3 touchdowns wins**.

---

## Core Gameplay

- **First to 3 Touchdowns**: Each touchdown scores 1 point, clears the field, and resets both players to **5 Sticky Liquid** for the next drive.
- **Sticky Liquid & Cooldown**: Start with **3 Sticky Liquid** (regenerates **1/sec**, max **10**) with a **2-second global summon cooldown** between troop deployments.
- **8-Troop Deck & Card Cycling**: Build an 8-troop deck; **4 cards** are active in hand with a **NEXT** preview, and played cards cycle to the back of the queue.
- **64 Unique Sticky Troops**: Across **4 movement classes** (*Walking, Running, Sliding, Flying*) and **4 combat roles** (*Melee, Ranged, Tank, Caster*). Ground melee/tanks cannot hit flying units.
- **Scouting & 100 Augments**: Preview 4 random opponent troops pre-match, draft a **Silver** augment at kickoff, and unlock **Gold / Legendary** comeback augments when conceding a touchdown (augments expire 24 hours after acquisition).
- **Modes**: 1v1 Ranked Gridiron, 100-level VS AI Challenge, and Weekly Mirror Tournament.

---

## Tech Stack

- **Client (`client/`)**: React Native + Expo (Web / iOS / Android), Zustand, Socket.IO Client
- **Server (`server/`)**: Node.js, Express, Socket.IO, Prisma ORM, PostgreSQL (Supabase)
- **Hosting**: Netlify (`netlify.toml`) + Render (`render.yaml`)

---

## Local Development

### Prerequisites
- Node.js 20+
- PostgreSQL database (set `DATABASE_URL` in `server/.env`)

### Quick Start (Windows)
```powershell
.\start-game.ps1
```

### Manual Setup
```bash
# Server (runs on http://localhost:3100)
cd server
npm install
npx prisma generate
npx prisma migrate deploy
npx tsx prisma/seed.ts
npm run dev

# Client (in a separate terminal)
cd client
npm install
npx expo start --web
```

### Tests & Balance Simulation
```bash
npm --prefix server test      # Run server unit & regression tests
npm --prefix server run sim   # Run 400-match headless AI balance simulation
npm --prefix client run lint  # Run Expo ESLint checks
```
