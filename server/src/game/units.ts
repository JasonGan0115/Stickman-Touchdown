import { LOADOUT_UNIT_SLOTS, TICK_RATE } from "./constants";

// Combat stats for each card. Keys are the fixed Card ids; prisma/seed.ts
// writes the Card rows (name, type, manaCost) from this table. The database
// says which cards a player owns; the numbers that decide a fight live here.

export type UnitType = "Melee" | "Ranged" | "Tank" | "Caster";

export interface UnitStats {
  cardId: string;
  name: string;
  type: UnitType;
  cost: number; // mana
  health: number;
  damage: number; // per hit
  attackRange: number; // world units, centre to centre
  attackIntervalTicks: number; // ticks between hits
  speed: number; // world units per tick
  splashRadius: number; // 0 = single target; otherwise also hits enemies this close to the target
}

const perTick = (unitsPerSecond: number) => unitsPerSecond / TICK_RATE;
const ticks = (seconds: number) => Math.round(seconds * TICK_RATE);

// First-pass balance numbers. The field is 640 units long, so a speed of 64/s
// crosses it in about 10 seconds.
export const UNIT_STATS: Record<string, UnitStats> = {
  // Cheap and quick: good for sneaking a score, loses any fair fight
  card_footsoldier: {
    cardId: "card_footsoldier",
    name: "Footsoldier",
    type: "Melee",
    cost: 1,
    health: 60,
    damage: 8,
    attackRange: 30,
    attackIntervalTicks: ticks(0.8),
    speed: perTick(80),
    splashRadius: 0,
  },
  // Stops far from its target and shoots; dies quickly if reached
  card_archer: {
    cardId: "card_archer",
    name: "Archer",
    type: "Ranged",
    cost: 2,
    health: 50,
    damage: 12,
    attackRange: 130,
    attackIntervalTicks: ticks(1.2),
    speed: perTick(56),
    splashRadius: 0,
  },
  // Slow wall of health that soaks damage for units behind it
  card_shield_bearer: {
    cardId: "card_shield_bearer",
    name: "Shield Bearer",
    type: "Tank",
    cost: 3,
    health: 220,
    damage: 6,
    attackRange: 30,
    attackIntervalTicks: ticks(1),
    speed: perTick(40),
    splashRadius: 0,
  },
  // Big slow hits that also damage enemies bunched around the target
  card_battle_mage: {
    cardId: "card_battle_mage",
    name: "Battle Mage",
    type: "Caster",
    cost: 4,
    health: 80,
    damage: 20,
    attackRange: 90,
    attackIntervalTicks: ticks(1.5),
    speed: perTick(48),
    splashRadius: 45,
  },
};

/** Every new player owns these, so it's also the hand for anyone without a saved deck. */
export const DEFAULT_HAND = Object.keys(UNIT_STATS).slice(0, LOADOUT_UNIT_SLOTS);

export function getUnitStats(cardId: unknown): UnitStats | undefined {
  return typeof cardId === "string" && Object.hasOwn(UNIT_STATS, cardId) ? UNIT_STATS[cardId] : undefined;
}

/**
 * The cards a player can spawn this match: their loadout's units that have
 * stats, in order, without duplicates. An empty result (no saved deck, or the
 * database was down) falls back to DEFAULT_HAND so nobody enters a match unable to play.
 */
export function resolveHand(unitIds: string[]): string[] {
  const hand = [...new Set(unitIds)].filter((id) => getUnitStats(id)).slice(0, LOADOUT_UNIT_SLOTS);
  return hand.length ? hand : [...DEFAULT_HAND];
}

/** What the client needs to draw a card in the hand. */
export function handCardInfo(cardId: string) {
  const s = UNIT_STATS[cardId];
  return { cardId: s.cardId, name: s.name, type: s.type, cost: s.cost };
}
