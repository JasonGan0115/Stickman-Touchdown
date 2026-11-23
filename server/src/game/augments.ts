// What each augment does in a match. Keys are the fixed Augment ids that
// prisma/seed.ts writes to the database (the seed reads this table, so the
// two can't drift apart). Every augment in a player's loadout multiplies one
// stat for that whole match; copies of the same stat stack by multiplying.

export type AugmentRarity = "Common" | "Rare" | "Legendary";

/** Stats an augment can boost. `attackSpeed` shortens the time between hits. */
export type BoostedStat = "health" | "damage" | "attackSpeed" | "range" | "speed" | "manaRegen";

export interface AugmentDef {
  id: string;
  name: string;
  rarity: AugmentRarity;
  stat: BoostedStat;
  modifier: number; // 1.1 = +10%
}

export const AUGMENTS: Record<string, AugmentDef> = {
  aug_swift_boots: { id: "aug_swift_boots", name: "Swift Boots", rarity: "Common", stat: "speed", modifier: 1.05 },
  aug_iron_skin: { id: "aug_iron_skin", name: "Iron Skin", rarity: "Common", stat: "health", modifier: 1.1 },
  aug_quick_hands: { id: "aug_quick_hands", name: "Quick Hands", rarity: "Common", stat: "attackSpeed", modifier: 1.08 },
  aug_mana_surge: { id: "aug_mana_surge", name: "Mana Surge", rarity: "Rare", stat: "manaRegen", modifier: 1.2 },
  aug_berserker_rage: { id: "aug_berserker_rage", name: "Berserker Rage", rarity: "Rare", stat: "damage", modifier: 1.25 },
  aug_eagle_eye: { id: "aug_eagle_eye", name: "Eagle Eye", rarity: "Rare", stat: "range", modifier: 1.15 },
  aug_titans_blessing: { id: "aug_titans_blessing", name: "Titan's Blessing", rarity: "Legendary", stat: "health", modifier: 1.5 },
  aug_phoenix_heart: { id: "aug_phoenix_heart", name: "Phoenix Heart", rarity: "Legendary", stat: "attackSpeed", modifier: 1.4 },
};

const STAT_LABEL: Record<BoostedStat, string> = {
  health: "unit health",
  damage: "unit damage",
  attackSpeed: "attack speed",
  range: "attack range",
  speed: "move speed",
  manaRegen: "mana regen",
};

const BOOSTED_STATS = Object.keys(STAT_LABEL) as BoostedStat[];

export type Modifiers = Record<BoostedStat, number>;

export const NO_MODIFIERS: Readonly<Modifiers> = Object.freeze(
  Object.fromEntries(BOOSTED_STATS.map((s) => [s, 1])) as Modifiers,
);

export function getAugment(id: string): AugmentDef | undefined {
  return Object.hasOwn(AUGMENTS, id) ? AUGMENTS[id] : undefined;
}

/** Combined multipliers for a loadout's augments. Unknown ids are ignored. */
export function combineAugments(augmentIds: string[]): Modifiers {
  const mods: Modifiers = { ...NO_MODIFIERS };
  for (const id of augmentIds) {
    const aug = getAugment(id);
    if (aug) mods[aug.stat] *= aug.modifier;
  }
  return mods;
}

const percent = (modifier: number) => `+${Math.round((modifier - 1) * 100)}%`;

/** "+10% unit health" — for one augment, or for a combined stat. */
export function describeBoost(stat: BoostedStat, modifier: number): string {
  return `${percent(modifier)} ${STAT_LABEL[stat]}`;
}

/** Player-facing text for one augment, e.g. "+10% unit health". Undefined for unknown ids. */
export function describeAugment(id: string): string | undefined {
  const aug = getAugment(id);
  return aug && describeBoost(aug.stat, aug.modifier);
}

/** One line per boosted stat, e.g. ["+65% unit health", "+25% unit damage"]. */
export function describeModifiers(mods: Modifiers): string[] {
  return BOOSTED_STATS.filter((s) => mods[s] !== 1).map((s) => describeBoost(s, mods[s]));
}
