// AI scaling helper for VS‑AI mode
// Provides per‑difficulty bonuses used by the bot logic.
// Difficulty is an integer 1‑100 (higher = harder).

/** Result of the scaling calculation. */
export interface AIBonus {
  /** Starting sticky‑liquid amount for the AI player. */
  startingLiquid: number;
  /** Mana regeneration multiplier (applied to MANA_PER_TICK). */
  manaRegenMultiplier: number;
  /** Spawn‑cooldown factor (multiplied against SPAWN_COOLDOWN_TICKS). */
  cooldownFactor: number;
  /** Chance (0‑1) that the AI predicts the player's next lane. */
  predictionChance: number;
  /** Damage debuff applied to the human player (0‑1, where 0.5 = 50 % reduction). */
  damageDebuff: number;
}

/** Linear scaling helper – clamps the value between min and max. */
function lerp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Compute the AI bonuses for a given difficulty.
 * The formulas are intentionally simple and can be tweaked later.
 */
export function getAIBonus(difficulty: number): AIBonus {
  const d = lerp(difficulty, 1, 100);
  // Starting liquid grows slowly so the AI never has infinite resources.
  const startingLiquid = 5 + Math.floor(d * 0.1); // base 5 + 0‑10

  // Mana regen up to double at level 100.
  const manaRegenMultiplier = 1 + d * 0.01; // 1.01 – 2.00

  // Cooldown reduction – at 100 the cooldown is 50 % of default.
  const cooldownFactor = 1 - d * 0.005; // 0.995 – 0.5

  // Prediction chance up to 90 %.
  const predictionChance = Math.min(0.9, d * 0.009); // 0.009 – 0.9

  // Damage debuff applied to the human player – max 50 %.
  const damageDebuff = Math.min(0.5, d * 0.005); // 0.005 – 0.5

  return {
    startingLiquid,
    manaRegenMultiplier,
    cooldownFactor,
    predictionChance,
    damageDebuff,
  };
}
