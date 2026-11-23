// Gameplay tuning. The client keeps copies of FIELD_WIDTH, FIELD_HEIGHT,
// ENDZONE_DEPTH, MAX_MANA and SPAWN_COST in client/src/game/constants.ts — keep them in sync.

// --- Loop ---
export const TICK_RATE = 30; // ticks per second
export const TICK_MS = 1000 / TICK_RATE;
export const MAX_CATCH_UP_TICKS = 5; // after a long stall, skip ahead rather than burst

// --- Match ---
// 3 minutes by default; MATCH_DURATION_SECONDS can shorten it for local testing
export const MATCH_DURATION_MS = (Number(process.env.MATCH_DURATION_SECONDS) || 180) * 1000;
export const WINNING_SCORE = 3;

// --- Field ---
// World units, seen from Player 1's side (9:16, roughly a phone in portrait):
//   x: 0 = left edge  .. FIELD_WIDTH  = right edge
//   y: 0 = top edge (Player 2's endzone) .. FIELD_HEIGHT = bottom edge (Player 1's endzone)
// Player 2's client rotates the board 180° so each player sees their own endzone at the bottom.
export const FIELD_WIDTH = 360;
export const FIELD_HEIGHT = 640;
export const ENDZONE_DEPTH = FIELD_HEIGHT * 0.15; // 96: each endzone is 15% of the field

// --- Mana ---
export const MAX_MANA = 10;
export const STARTING_MANA = 0;
export const MANA_PER_SECOND = 1;
export const MANA_PER_TICK = MANA_PER_SECOND / TICK_RATE;

// --- Units ---
export const SPAWN_COST = 3;
export const RUNNER_SPEED_PER_SECOND = FIELD_HEIGHT * 0.1; // 64 units/s (~7s endzone to endzone)
export const RUNNER_SPEED = RUNNER_SPEED_PER_SECOND / TICK_RATE; // per tick

// --- Combat ---
export const UNIT_HEALTH = 100;
export const UNIT_DAMAGE = 10;
export const UNIT_ATTACK_RANGE = 40; // world units, centre to centre
export const ATTACK_INTERVAL_TICKS = TICK_RATE; // one hit per second

// --- Loadouts ---
export const LOADOUT_UNIT_SLOTS = 4;
export const LOADOUT_AUGMENT_SLOTS = 8;

// --- Rewards ("Robin Hood": the loser gets the better augment) ---
export const WINNER_XP = 100;
export const LOSER_XP = 0;
export const AUGMENT_DURATION_MS = 24 * 60 * 60 * 1000; // minted augments last 24 hours
