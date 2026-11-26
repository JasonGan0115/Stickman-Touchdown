import { errorSummary, prisma } from "../db";
import { AUGMENTS } from "./augments";
import { seededRng } from "./bot";
import { LOADOUT_AUGMENT_SLOTS, LOADOUT_UNIT_SLOTS } from "./constants";
import type { Loadout } from "./match";
import { UNIT_STATS } from "./units";

export interface WeeklyTournamentConfig {
  id: string;
  name: string;
  loadout: Loadout; // forced on BOTH players, replacing their saved loadouts
  // Display names for the client's Mirror Match banner (looked up from the database)
  units: { id: string; name: string }[];
  augments: { id: string; name: string; rarity: string }[];
}

/** Returns ISO-8601 week year, week number (1-53), and tournament id for `date`. */
export function getIsoWeekKey(date: Date = new Date()): { year: number; week: number; id: string } {
  const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((utc.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  const year = utc.getUTCFullYear();
  return { year, week, id: `weekly_${year}_w${String(week).padStart(2, "0")}` };
}

function pickDeterministic(pool: string[], count: number, seed: number): string[] {
  const arr = [...pool].sort();
  const rng = seededRng(seed);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, Math.min(count, arr.length));
}

/** Deterministically builds the 8-troop, 8-augment mirror loadout for the given date's ISO week. */
export function getWeeklyTournamentLoadout(date: Date = new Date()): { id: string; name: string; loadout: Loadout } {
  const { year, week, id } = getIsoWeekKey(date);
  const seed = year * 100 + week;
  return {
    id,
    name: "Weekly Tournament: Mirror Match",
    loadout: {
      unitIds: pickDeterministic(Object.keys(UNIT_STATS), LOADOUT_UNIT_SLOTS, seed),
      augmentIds: pickDeterministic(Object.keys(AUGMENTS), LOADOUT_AUGMENT_SLOTS, seed + 997),
    },
  };
}

/**
 * Returns this week's tournament config with display names filled in from the
 * database (falling back to in-memory catalog names if DB is unavailable).
 */
export async function getWeeklyTournamentConfig(date: Date = new Date()): Promise<WeeklyTournamentConfig> {
  const weekly = getWeeklyTournamentLoadout(date);
  const { unitIds, augmentIds } = weekly.loadout;
  let cardNames = new Map<string, string>();
  let augmentInfo = new Map<string, { name: string; rarity: string }>();

  try {
    const [cards, augments] = await Promise.all([
      prisma.card.findMany({ where: { id: { in: unitIds } } }),
      prisma.augment.findMany({ where: { id: { in: augmentIds } } }),
    ]);
    cardNames = new Map(cards.map((c) => [c.id, c.name]));
    augmentInfo = new Map(augments.map((a) => [a.id, { name: a.name, rarity: a.rarity }]));
  } catch (err) {
    console.warn("[tournament] could not load names from database; using catalog:", errorSummary(err));
  }

  return {
    id: weekly.id,
    name: weekly.name,
    loadout: { unitIds: [...unitIds], augmentIds: [...augmentIds] },
    units: unitIds.map((id) => ({ id, name: cardNames.get(id) ?? UNIT_STATS[id]?.name ?? id })),
    augments: augmentIds.map((id) => ({
      id,
      name: augmentInfo.get(id)?.name ?? AUGMENTS[id]?.name ?? id,
      rarity: augmentInfo.get(id)?.rarity ?? AUGMENTS[id]?.rarity ?? "Unknown",
    })),
  };
}
