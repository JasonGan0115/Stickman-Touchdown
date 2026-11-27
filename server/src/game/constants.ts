// Gameplay tuning. The client keeps copies of FIELD_WIDTH, FIELD_HEIGHT,
// ENDZONE_DEPTH and MAX_MANA in client/src/game/constants.ts — keep them in sync.
// Card costs are sent to the client in 'match_found', so they need no copy.

// --- Loop ---
export const TICK_RATE = 30; // ticks per second
export const TICK_MS = 1000 / TICK_RATE;
export const MAX_CATCH_UP_TICKS = 5; // after a long stall, skip ahead rather than burst

// --- Match ---
// 3 minutes by default; MATCH_DURATION_SECONDS can shorten it for local testing
export const MATCH_DURATION_MS = (Number(process.env.MATCH_DURATION_SECONDS) || 180) * 1000;
export const OVERTIME_DURATION_MS = 60_000; // 60s sudden-death overtime on a tied clock
export const OVERTIME_MANA_MULTIPLIER = 1.5; // 1.5x Sticky Liquid regen during overtime
export const KICKOFF_DRAFT_MS = 3000; // 3s pre-match window to pick starting Silver augment
export const COMEBACK_DRAFT_TIMEOUT_MS = 10000; // max pause for post-round comeback augment draft
export const WINNING_SCORE = 3;

// --- Field ---
// World units, seen from Player 1's side (9:16, roughly a phone in portrait):
//   x: 0 = left edge  .. FIELD_WIDTH  = right edge
//   y: 0 = top edge (Player 2's endzone) .. FIELD_HEIGHT = bottom edge (Player 1's endzone)
// Player 2's client rotates the board 180° so each player sees their own endzone at the bottom.
export const FIELD_WIDTH = 360;
export const FIELD_HEIGHT = 640;
export const ENDZONE_DEPTH = FIELD_HEIGHT * 0.15; // 96: each endzone is 15% of the field

// --- Mana / Sticky Liquid ---
export const MAX_MANA = 10;
export const STARTING_MANA = 3; // Starts with 3 sticky liquid
export const RESET_MANA_ON_SCORE = 5; // Reset to 5 sticky liquid after touchdown
export const MANA_PER_SECOND = 0.5;
export const MANA_PER_TICK = MANA_PER_SECOND / TICK_RATE;

// --- Cooldowns ---
export const SPAWN_COOLDOWN_SECONDS = 1; // 1s delay between dropping cards
export const SPAWN_COOLDOWN_TICKS = Math.round(SPAWN_COOLDOWN_SECONDS * TICK_RATE);

// --- Units ---
// Each card's cost, health, damage, range and speed live in ./units.ts

// --- Loadouts ---
export const LOADOUT_UNIT_SLOTS = 8; // 8 sticky troops in deck
export const ACTIVE_HAND_SIZE = 4; // 4 active sticky troops in hand
export const LOADOUT_AUGMENT_SLOTS = 8;

// --- Rewards ("Robin Hood": the loser gets the better augment) ---
export const WINNER_XP = 100;
export const LOSER_XP = 0;
export const AUGMENT_DURATION_MS = 24 * 60 * 60 * 1000; // minted augments last 24 hours
