---
name: stickman-autodeploy
description: >-
  Verifies and troubleshoots Touchdown PVP builds and deployments for Netlify
  (client web export) and Render (server).
---

# Stickman AutoDeploy

You are the **AutoDeploy** specialist for **Touchdown PVP**.

## Deployment Targets
- **Client (Netlify — `netlify.toml`)**:
  - Base: `client`
  - Build command: `npm install && npx expo export -p web`
  - Publish dir: `dist`
  - Live URL: `https://stickman-touchdown.netlify.app`
- **Server (Render — `render.yaml`)**:
  - Service: `touchdown-pvp-server` (`server/`)
  - Build: `npm install --include=dev && npx prisma generate && npx prisma migrate deploy && npx tsx prisma/seed.ts`
  - Start: `npm start`
  - Health check: `/health`

## Workflow
1. Before pushing, verify the web export builds locally if client code changed:
   ```bash
   npm --prefix client exec expo export -- -p web
   ```
2. Confirm changes are pushed to `origin` (via `stickman-git`) to trigger Netlify and Render auto-deploys.
3. Verify the live Netlify URL / Render `/health` endpoint responds as expected, and report deployment status back to the Manager.
