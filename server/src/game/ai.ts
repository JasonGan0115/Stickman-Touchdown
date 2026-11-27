import { STARTING_MANA } from "./constants";

// AI scaling helper for VS-AI mode
// Provides per-difficulty bonuses used by the bot logic.
// Difficulty is an integer 1-100 (higher = harder).

/** Result of the scaling calculation. */
export interface AIBonus {
  /** Starting sticky-liquid amount for the AI player. */
  startingLiquid: number;
  /** Mana regeneration multiplier (applied to MANA_PER_TICK). */
  manaRegenMultiplier: number;
  /** Spawn-cooldown factor (multiplied against SPAWN_COOLDOWN_TICKS). */
  cooldownFactor: number;
  /** Chance (0-1) that the AI predicts the player's next lane. */
  predictionChance: number;
  /** Damage debuff applied to the human player (0-1, where 0.5 = 50% reduction). */
  damageDebuff: number;
}

/** Clamp `value` between `min` and `max`. */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Compute the AI bonuses for a given difficulty (1-100), aligned with VS_AI_BALANCE_GOALS.md:
 * - Levels 1-10: Beginner-friendly (no resource advantage, no lane prediction, no player debuff).
 * - Levels 11-49: Progressive ramp from neutral to ~20/80 challenge.
 * - Levels 50-100: ~20% player / ~80% AI win-rate pressure at Lv.50, scaling harder to Lv.100.
 */
export function getAIBonus(difficulty: number): AIBonus {
  const d = clamp(difficulty, 1, 100);

  if (d <= 10) {
    return {
      startingLiquid: STARTING_MANA,
      manaRegenMultiplier: 1,
      cooldownFactor: 1,
      predictionChance: 0,
      damageDebuff: 0,
    };
  }

  if (d < 50) {
    const t = (d - 10) / 40; // 0..1 across 10->50
    return {
      startingLiquid: STARTING_MANA + Math.floor(t * 1.5), // 3 -> 4
      manaRegenMultiplier: Number((1 + t * 0.06).toFixed(4)), // 1.00 -> 1.06
      cooldownFactor: Number((1 - t * 0.1).toFixed(4)), // 1.00 -> 0.90
      predictionChance: Number((t * 0.25).toFixed(4)), // 0.00 -> 0.25
      damageDebuff: Number((t * 0.04).toFixed(4)), // 0.00 -> 0.04
    };
  }

  const u = (d - 50) / 50; // 0..1 across 50->100
  const s = Math.pow(u, 1.4); // smooth continuation past Lv.50 without an immediate cliff
  return {
    startingLiquid: 4 + Math.floor(u * 3), // 4 -> 7
    manaRegenMultiplier: Number((1.06 + s * 0.18).toFixed(4)), // 1.06 -> 1.24
    cooldownFactor: Number((0.9 - u * 0.22).toFixed(4)), // 0.90 -> 0.68
    predictionChance: Number((0.25 + u * 0.5).toFixed(4)), // 0.25 -> 0.75
    damageDebuff: Number((0.04 + s * 0.16).toFixed(4)), // 0.04 -> 0.20
  };
}
