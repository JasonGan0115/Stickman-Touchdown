/**
 * Per-troop leveling system (Levels 1 to 100).
 *
 * Playing a troop in a match awards 1 XP per second of match play time.
 * Cumulative XP to reach Level 100 is 364,320 XP (~101.2 hours of play time),
 * guaranteeing at least 100 hours of playing time to max out any troop.
 */

export const MIN_TROOP_LEVEL = 1;
export const MAX_TROOP_LEVEL = 100;
export const TROOP_XP_PER_SECOND = 1;
export const MIN_HOURS_FOR_MAX_LEVEL = 100;

const BASE_XP_PER_LEVEL = 180;
const XP_STEP_PER_LEVEL = 70;
const STAT_BONUS_PER_LEVEL = 0.002; // +0.2% HP & damage per level above 1 (max +19.8% at Lv.100)

/** XP required to advance from `level` to `level + 1`. Returns 0 at max level. */
export function xpToNextTroopLevel(level: number): number {
  const clamped = Math.floor(level);
  if (clamped < MIN_TROOP_LEVEL || clamped >= MAX_TROOP_LEVEL) return 0;
  return BASE_XP_PER_LEVEL + XP_STEP_PER_LEVEL * clamped;
}

/** Total cumulative XP required to reach `level` (Level 1 = 0 XP, Level 100 = 364,320 XP). */
export function getCumulativeXpForLevel(level: number): number {
  const target = Math.min(MAX_TROOP_LEVEL, Math.max(MIN_TROOP_LEVEL, Math.floor(level)));
  let total = 0;
  for (let l = MIN_TROOP_LEVEL; l < target; l++) {
    total += xpToNextTroopLevel(l);
  }
  return total;
}

/** Computes the troop level (1..100) for a given total XP. */
export function getTroopLevelFromXp(xp: number): number {
  const safeXp = Math.max(0, Math.floor(xp));
  let level = MIN_TROOP_LEVEL;
  let remaining = safeXp;
  while (level < MAX_TROOP_LEVEL) {
    const needed = xpToNextTroopLevel(level);
    if (remaining < needed) break;
    remaining -= needed;
    level++;
  }
  return level;
}

export interface TroopLevelProgress {
  level: number;
  xp: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  hoursPlayed: number;
}

/** Detailed progress breakdown for UI display and rewards. */
export function getTroopLevelProgress(xp: number): TroopLevelProgress {
  const safeXp = Math.max(0, Math.floor(xp));
  const level = getTroopLevelFromXp(safeXp);
  const currentFloor = getCumulativeXpForLevel(level);
  const xpForNextLevel = xpToNextTroopLevel(level);
  const xpIntoLevel = level >= MAX_TROOP_LEVEL ? 0 : safeXp - currentFloor;
  return {
    level,
    xp: safeXp,
    xpIntoLevel,
    xpForNextLevel,
    hoursPlayed: Number((safeXp / (TROOP_XP_PER_SECOND * 3600)).toFixed(2)),
  };
}

/** Stat multiplier (HP & damage) for a troop at `level` (1.0 at Lv.1, 1.198 at Lv.100). */
export function getTroopStatMultiplier(level: number): number {
  const clamped = Math.min(MAX_TROOP_LEVEL, Math.max(MIN_TROOP_LEVEL, Math.floor(level)));
  return 1 + (clamped - 1) * STAT_BONUS_PER_LEVEL;
}
