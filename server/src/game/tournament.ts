import { errorSummary, prisma } from "../db";
import type { Loadout } from "./match";

export interface WeeklyTournamentConfig {
  id: string;
  name: string;
  loadout: Loadout; // forced on BOTH players, replacing their saved loadouts
  // Display names for the client's Mirror Match banner (looked up from the database)
  units: { id: string; name: string }[];
  augments: { id: string; name: string; rarity: string }[];
}

// This week's rules. Hardcoded for now; the ids match prisma/seed.ts.
// Later this could be loaded from a database table or remote config.
const WEEKLY_TOURNAMENT: { id: string; name: string; loadout: Loadout } = {
  id: "weekly_2026_w46",
  name: "Weekly Tournament: Mirror Match",
  loadout: {
    unitIds: ["card_footsoldier", "card_archer", "card_shield_bearer", "card_battle_mage"],
    augmentIds: [
      "aug_swift_boots",
      "aug_iron_skin",
      "aug_quick_hands",
      "aug_mana_surge",
      "aug_berserker_rage",
      "aug_eagle_eye",
      "aug_titans_blessing",
      "aug_phoenix_heart",
    ],
  },
};

/**
 * Returns this week's tournament config with display names filled in from the
 * database. If the database can't be reached the ids are still returned (and
 * still forced on both players); only the names fall back to the ids.
 */
export async function getWeeklyTournamentConfig(): Promise<WeeklyTournamentConfig> {
  const { unitIds, augmentIds } = WEEKLY_TOURNAMENT.loadout;
  let cardNames = new Map<string, string>();
  let augmentInfo = new Map<string, { name: string; rarity: string }>();

  try {
    const [cards, augments] = await Promise.all([
      prisma.card.findMany({ where: { id: { in: unitIds } } }),
      prisma.augment.findMany({ where: { id: { in: augmentIds } } }),
    ]);
    cardNames = new Map(cards.map((c) => [c.id, c.name]));
    augmentInfo = new Map(augments.map((a) => [a.id, { name: a.name, rarity: a.rarity }]));

    const missing = [...unitIds, ...augmentIds].filter((id) => !cardNames.has(id) && !augmentInfo.has(id));
    if (missing.length) console.warn(`[tournament] config ids not found in database (run the seed?): ${missing.join(", ")}`);
  } catch (err) {
    console.warn("[tournament] could not load names from database; using ids:", errorSummary(err));
  }

  return {
    id: WEEKLY_TOURNAMENT.id,
    name: WEEKLY_TOURNAMENT.name,
    loadout: { unitIds: [...unitIds], augmentIds: [...augmentIds] },
    units: unitIds.map((id) => ({ id, name: cardNames.get(id) ?? id })),
    augments: augmentIds.map((id) => ({ id, name: augmentInfo.get(id)?.name ?? id, rarity: augmentInfo.get(id)?.rarity ?? "Unknown" })),
  };
}
