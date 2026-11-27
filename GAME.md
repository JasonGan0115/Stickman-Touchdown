# Stickman Touchdown (Touchdown PVP) — Final Game Design & Overview

**Play Live (Beta):** https://stickman-touchdown.netlify.app

**Stickman Touchdown (Touchdown PVP)** is a fast-paced, real-time 1v1 tactical gridiron PvP game for mobile and web, inspired by **Clash Royale’s Touchdown Mode**. There are no towers—both players deploy sticky troops onto a 9:16 portrait football field and battle to push a single troop across the opponent’s endzone line. **First to 3 touchdowns wins.**

---

## 1. Core Concept (Clash Royale Touchdown-Style)

- **No Towers, Pure Endzone Scoring:** Victory isn’t about destroying buildings—every push, counter-drop, and lane block is about getting a troop across the enemy goal line (`ENDZONE_DEPTH = 15%` of the field) or stopping your opponent at the last pixel.
- **First to 3 Touchdowns (`WINNING_SCORE = 3`):** Each touchdown scores 1 point and immediately resets the drive. Reaching 3 points wins the match on the spot.
- **3-Minute Match Clock (`180s`):** High-tempo rounds designed for quick 1–3 minute sessions.
- **Mirrored 9:16 Perspective:** The arena is `360 × 640` world units. Player 2’s view rotates `180°` so both players always defend the bottom endzone and attack upward.

---

## 2. Match Flow & Round Lifecycle

Every match follows a strict, responsive phase loop:

1. **Pre-Match Scouting:** Preview **4 random troops** from your opponent’s 8-troop deck before kickoff.
2. **3-Second Kickoff Draft (`KICKOFF_DRAFT_MS = 3000ms`):** Upon entering the arena, both players get a **3-second window** to pick a **Silver Augment** before any troops can be deployed.
3. **Active Combat (`playing`):**
   - **Sticky Liquid:** Start with **3 Sticky Liquid**, regenerate **0.5/sec** (max **10**).
   - **1-Second Global Summon Cooldown (`SPAWN_COOLDOWN_SECONDS = 1`):** After deploying a troop, a 1s global cooldown prevents mindless spam while keeping pacing snappy.
4. **Touchdown Line & Round Reset:**
   - The moment a troop crosses the enemy endzone line, **1 point** is awarded, all active field entities are cleared, and both players reset to **5 Sticky Liquid** (`RESET_MANA_ON_SCORE = 5`) with **`1s` spawn cooldown**.
   - If a player reaches **3 points**, the match ends immediately.
5. **Between-Round Augment Draft (`comeback_draft`):**
   - Between-round augments **only** trigger after a touchdown round reset—never as sudden pop-ups during live combat.
   - Combat pauses briefly (up to `10s`) while **the round winner picks a Gold augment** and **the round loser picks an Epic augment**, escalating up to **Legendary** on later rounds, then immediately resumes the next round with zero input delay.

---

### 3. Deck, Card Cycling & 64 Sticky Troops (+ Spells & Towers)

- **8-Card Deck & Clash-Style Hand Cycling:**
  - Players build an **8-card deck** (`LOADOUT_UNIT_SLOTS = 8`) mixing troops, **3 Tactical Spells**, and **2 Deployable Defensive Towers**.
  - **4 cards** are active in hand (`ACTIVE_HAND_SIZE = 4`) alongside a **NEXT** card preview.
  - Deploying a card puts the next card in queue into your hand and cycles the played card to the back of the 8-card rotation.
- **3 Tactical Spells (Cast Anywhere, Never Score):**
  - **Sticky Bomb (`card_sticky_bomb`, 3 Liquid):** Instant AoE blast (`55` dmg, `75` radius).
  - **Zap Shock (`card_zap_shock`, 2 Liquid):** Instant AoE shock (`25` dmg, `65` radius, `1.2s` stun).
  - **Glue Freeze (`card_glue_freeze`, 3 Liquid):** Instant AoE freeze (`12` dmg, `85` radius, `60%` slow for `3.0s`, gentle center pull clamped strictly outside both endzones).
- **2 Deployable Defensive Towers (Defensive Quarter-Zone Only):**
  - **Magnet Tower (`card_magnet_tower`, 3 Liquid):** `320` HP, `20s` lifetime, `135` range, `6` dmg, taunts/pulls nearby enemy ground & flying runners toward itself.
  - **Glue Cannon (`card_glue_cannon`, 4 Liquid):** `260` HP, `20s` lifetime, `150` range, `16` dmg, `35` splash, applies `30%` slow for `1.5s`, targets ground + flying.
  - Towers decay HP over `20s`, never move, never score, and clear on touchdown round reset.
- **Sudden-Death Overtime (`OVERTIME_DURATION_MS = 60s`):**
  - If the 3-minute clock expires while tied, **Sudden-Death Overtime** begins for `60s` with **1.5× Sticky Liquid regeneration**. The next touchdown wins immediately (skipping round reset & comeback draft); if still tied after `60s`, the match ends in a draw.
- **4 Movement Classes:**
  - **Walking** — Balanced frontline pace.
  - **Running** — High-speed endzone sprinters and breakaway threats.
  - **Sliding** — Low-friction swift skaters/gliders.
  - **Flying** — Aerial units that hover above ground combat; **ground melee and tanks cannot hit flying units**, requiring ranged or caster answers.
- **4 Combat Roles:**
  - **Melee** (single-target brawlers & runners)
  - **Ranged** (backline shooters & anti-air)
  - **Tank** (high-HP frontline blockers)
  - **Caster** (AOE / splash & crowd-control specialists)

---

## 4. Augment System

- **Kickoff Tier (Silver):** Small tactical boosts drafted at the start of every match (e.g., *Swift Boots, Iron Skin, Quick Hands, Heavy Impact, Eagle Sight, Spring Step, Slime Plating, Rapid Jab, Liquid Trickle*).
- **Round-Winner Tier (Gold):** Mid-tier upgrades offered to the player who just won the round (e.g., *Mana Surge, Berserker Rage, Eagle Eye, Iron Golem, Wind Stride, Frenzy Strike, Blast Flask, Liquid Overflow*).
- **Round-Loser Comeback Tier (Epic):** Strong comeback upgrades offered to the player who just lost the round, bridging Gold and Legendary.
- **Escalation Ceiling (Legendary):** Top-tier game-changers reached as rounds escalate (e.g., *Titan’s Blessing, Phoenix Heart, Colossus Might, Celestial Wings, Infinite Current, Sniper’s Perch*).
- **Testing Mode (All Augments Unlocked):** All augments are unlocked and available in the Deck Builder for testing; 24-hour expiration is deferred to post-deploy (**Futurista**).

---

## 5. Progression & Game Modes

### Per-Troop Leveling (Levels 1–100)
- Playing a troop in matches earns **1 XP/sec** of match play time (`TROOP_XP_PER_SECOND = 1`).
- **Front-Loaded Early Levels:** Fast early upgrades (`Lv. 1→2: 30 XP`, `2→3: 60 XP`, `3→4: 100 XP`, `4→5: 150 XP`), scaling smoothly thereafter (`195 + 70 × level` XP) up to **364,320 cumulative XP** at **Level 100** (~101.2 hours).
- **Stat Scaling:** Each level grants **+0.2% HP & damage** (up to **+19.8%** at Level 100).

### Game Modes (Current Beta)
- **VS AI Challenge (Levels 1–100) — Primary Active Mode:**
  - **Levels 1–10:** Beginner-friendly onboarding.
  - **Levels 11–49:** Smooth monotonic difficulty ramp.
  - **Levels 50–100:** High-challenge endgame starting at **20/80 odds** (~20% player / ~80% AI win rate at Lv. 50) and scaling through Level 100.
- **Coming Soon (Moved to Coming Soon Tab for Now):**
  - **1v1 Ranked Gridiron:** Real-time PvP matchmaking against live opponents.
  - **Weekly Mirror Tournament:** 8-player bracket championship with mirrored rules.

---

## 6. Client Navigation, UI & Tech Stack

- **Three-Tab Home Hub (Modernized Mobile UI via `agency-mobile-app-builder`, `agency-ux-researcher`, `agency-game-designer`):**
  - **Home:** Focused cleanly on **VS AI Challenge** at the top (no 1v1 Ranked / Weekly Tournament clutter, and **no tactical tips** section at the bottom) + active loadout summary.
  - **Deck:** 8-Card Deck Builder + Augment Vault (all augments unlocked for testing), featuring smooth scrolling across the full roster and category filters/sorting (*All, Ground, Flying, Spells, Towers*, plus cost/role).
  - **Coming Soon:** Houses **1v1 Ranked Gridiron** and **Weekly Mirror Tournament** previews while disabled in current beta.
- **Tech Stack:** React Native + Expo (`client/`, deployed on Netlify), Node.js + Express + Socket.IO + Prisma ORM (`server/`, deployed on Render), PostgreSQL (Supabase).

---

## 7. Match-Flow Rules & Active Backlog
> **Rule for all agents:** Read `GAME.md` first before planning, building, or fixing anything.

### Enforced Match-Flow Rules (Phase 7 Verified)
- [x] **Complete Level / Match Flow Stability:** Full match plays cleanly from kickoff to victory/defeat with no soft-locks or lingering modals.
- [x] **Touchdown Line Round Restart:** First unit crossing the endzone awards 1 point, clears all entities, resets liquid to `5` and cooldown to `1s`, and restarts the drive (or ends immediately at `WINNING_SCORE = 3`).
- [x] **Strict Augment Pop-Up Timing:** **3-second** pre-match kickoff draft before troop deployment; between-round augments appear **only** after a touchdown round reset (never mid-combat).
- [x] **Zero-Delay Mid-Round Augment Selection:** Combat pauses during between-round draft and resumes immediately upon selection.

### Upcoming / Active Implementation Backlog
- [ ] **Liquid & Round Reset Tuning:** Update Sticky Liquid regen to `0.5/sec` and post-touchdown spawn cooldown to `1s`.
- [ ] **Winner Gold / Loser Epic → Legendary Augment Progression:** Add **Epic** tier augments, give round winner **Gold** and round loser **Epic** (escalating up to **Legendary**), and unlock all augments for testing.
- [ ] **Home & Coming Soon UI Overhaul:** Focus Home page on **VS AI Challenge** only, remove bottom tactical tips, rename Tournament tab to **Coming Soon** (moving 1v1 Ranked & Weekly Tournament there), and upgrade Home & Deck UI with `agency-mobile-app-builder` + `agency-ux-researcher` + `agency-game-designer`.
- [ ] **Deck Builder Smooth Scroll & Category Filters:** Ensure the collection list scrolls smoothly to browse all troops/cards and supports filtering & sorting by category (**All, Ground, Flying, Spells, Towers**, plus cost/role).
- [ ] **Automated Testing & Balance:** Keep headless bot simulation (`npm --prefix server run sim`) and server regression suite (`npm --prefix server test`) green across all changes.
- [x] **Clash Royale Touchdown Parity:** Added 3 Tactical Spells (`Sticky Bomb`, `Zap Shock`, `Glue Freeze`), 2 Deployable Defensive Towers (`Magnet Tower`, `Glue Cannon`), and 60s Sudden-Death Overtime (`1.5x` Sticky Liquid).

---

## 8. Futurista (Post-Deploy Roadmap)
Features & systems to enable after real production deploy:
- **Re-enable 1v1 Ranked Gridiron** on the Home screen once live matchmaking traffic is ready.
- **Re-enable Weekly Mirror Tournament** in its dedicated tab with live 8-player brackets.
- **24-Hour Augment Vault Expiration (`AUGMENT_DURATION_MS = 24h`):** Re-enable time-limited augment grants once testing phase concludes.
