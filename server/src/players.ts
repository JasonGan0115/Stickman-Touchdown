import { prisma } from "./db";
import { AUGMENTS, describeAugment, getAugment } from "./game/augments";
import { LOADOUT_AUGMENT_SLOTS, LOADOUT_UNIT_SLOTS } from "./game/constants";
import type { Loadout } from "./game/match";
import { getUnitStats, UNIT_STATS } from "./game/units";

// There is no login yet: clients identify themselves by username, which the
// server trusts. Replace with real authentication before launch.
export const USERNAME_PATTERN = /^[A-Za-z0-9_-]{3,24}$/;

export const EMPTY_LOADOUT: Loadout = { unitIds: [], augmentIds: [] };

// TODO(deploy): In production (NODE_ENV === "production"), players only receive
// starter/earned cards and augments. In dev/testing, all 64 troops and all
// augments are unlocked automatically.
const TESTING_UNLOCK_ALL = process.env.NODE_ENV !== "production";

/**
 * Finds the player, creating them if this username is new. New players are
 * given starter cards (or all 64 troops when TESTING_UNLOCK_ALL is true).
 */
export async function ensurePlayer(username: string) {
  const player = await prisma.player.upsert({ where: { username }, update: {}, create: { username } });

  if (TESTING_UNLOCK_ALL) {
    const allUnits = Object.values(UNIT_STATS);
    const existingCount = await prisma.card.count();
    if (existingCount < allUnits.length) {
      for (const u of allUnits) {
        const row = { id: u.cardId, name: u.name, type: u.type, manaCost: u.cost };
        await prisma.card.upsert({ where: { id: u.cardId }, update: row, create: row });
      }
    }
    const cards = await prisma.card.findMany({ select: { id: true } });
    await prisma.playerCard.createMany({
      data: cards.map((c) => ({ playerId: player.id, cardId: c.id })),
      skipDuplicates: true,
    });
    return player;
  }

  const owned = await prisma.playerCard.count({ where: { playerId: player.id } });
  if (owned === 0) {
    const cards = await prisma.card.findMany({ select: { id: true } });
    await prisma.playerCard.createMany({
      data: cards.map((c) => ({ playerId: player.id, cardId: c.id })),
      skipDuplicates: true,
    });
  }
  return player;
}

/** The player's unlocked cards, active (unexpired) augment grants, and saved loadout. */
export async function getCollection(username: string) {
  const player = await ensurePlayer(username);
  const now = new Date();

  const [cards, grants] = await Promise.all([
    prisma.playerCard.findMany({
      where: { playerId: player.id },
      include: { card: true },
      orderBy: { card: { manaCost: "asc" } },
    }),
    prisma.playerAugment.findMany({
      where: { playerId: player.id, expiresAt: { gt: now } },
      include: { augment: true },
      orderBy: { expiresAt: "asc" },
    }),
  ]);

  const mappedGrants = grants.map((g) => ({
    grantId: g.id, // one entry per grant: the same augment can be owned more than once
    augmentId: g.augmentId,
    name: g.augment.name,
    rarity: g.augment.rarity,
    effectModifier: g.augment.effectModifier,
    effect: describeAugment(g.augmentId) ?? null,
    expiresAt: g.expiresAt.toISOString(),
  }));

  if (TESTING_UNLOCK_ALL) {
    const ownedAugIds = new Set(mappedGrants.map((g) => g.augmentId));
    const testExpiry = new Date(now.getTime() + 24 * 3_600_000).toISOString();
    for (const aug of Object.values(AUGMENTS)) {
      if (!ownedAugIds.has(aug.id)) {
        mappedGrants.push({
          grantId: `test_${aug.id}`,
          augmentId: aug.id,
          name: aug.name,
          rarity: aug.rarity,
          effectModifier: aug.modifier,
          effect: describeAugment(aug.id) ?? null,
          expiresAt: testExpiry,
        });
      }
    }
  }

  const availableCounts = countBy(mappedGrants.map((g) => g.augmentId));
  const loadout = pruneLoadout(
    { unitIds: player.loadoutUnitIds, augmentIds: player.loadoutAugmentIds },
    new Set(cards.map((c) => c.cardId)),
    availableCounts,
  );

  return {
    username: player.username,
    cards: cards.map(({ card }) => ({
      ...card,
      movement: getUnitStats(card.id)?.movement ?? "walking",
    })),
    augments: mappedGrants,
    loadout,
  };
}

export class LoadoutError extends Error {}

/**
 * Validates and saves a loadout. Units must be unlocked cards (no duplicates).
 * Each augment id can appear at most as many times as the player has active grants of it.
 */
export async function saveLoadout(username: string, unitIds: unknown, augmentIds: unknown): Promise<Loadout> {
  if (!isStringArray(unitIds) || !isStringArray(augmentIds)) {
    throw new LoadoutError("unitIds and augmentIds must be arrays of strings");
  }
  if (unitIds.length > LOADOUT_UNIT_SLOTS) throw new LoadoutError(`At most ${LOADOUT_UNIT_SLOTS} units`);
  if (augmentIds.length > LOADOUT_AUGMENT_SLOTS) throw new LoadoutError(`At most ${LOADOUT_AUGMENT_SLOTS} augments`);
  if (new Set(unitIds).size !== unitIds.length) throw new LoadoutError("Each unit can only be used once");

  const player = await ensurePlayer(username);
  const [cards, grants] = await Promise.all([
    prisma.playerCard.findMany({ where: { playerId: player.id }, select: { cardId: true } }),
    prisma.playerAugment.findMany({
      where: { playerId: player.id, expiresAt: { gt: new Date() } },
      select: { augmentId: true },
    }),
  ]);

  const unlocked = new Set(cards.map((c) => c.cardId));
  const notOwned = unitIds.filter((id) => !unlocked.has(id));
  if (notOwned.length) throw new LoadoutError(`Units not unlocked: ${notOwned.join(", ")}`);

  const available = countBy(grants.map((g) => g.augmentId));
  for (const [id, wanted] of countBy(augmentIds)) {
    const allowedInTesting = TESTING_UNLOCK_ALL && !!getAugment(id) && wanted <= 1;
    if (!allowedInTesting && wanted > (available.get(id) ?? 0)) {
      throw new LoadoutError(`Not enough active "${id}" augments`);
    }
  }

  const saved = await prisma.player.update({
    where: { id: player.id },
    data: { loadoutUnitIds: unitIds, loadoutAugmentIds: augmentIds },
  });
  return { unitIds: saved.loadoutUnitIds, augmentIds: saved.loadoutAugmentIds };
}

/** The loadout a player takes into a standard match (expired augments and lost cards removed). */
export async function getMatchLoadout(username: string): Promise<Loadout> {
  const { loadout } = await getCollection(username);
  return loadout;
}

// --- helpers ---

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}

function countBy(ids: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  return counts;
}

/** Drops ids the player no longer owns (e.g. an augment that expired since the loadout was saved). */
export function pruneLoadout(loadout: Loadout, unlockedCards: Set<string>, activeAugments: Map<string, number>): Loadout {
  const remaining = new Map(activeAugments);
  return {
    unitIds: loadout.unitIds.filter((id) => unlockedCards.has(id)),
    augmentIds: loadout.augmentIds.filter((id) => {
      const left = remaining.get(id) ?? 0;
      if (left <= 0) return false;
      remaining.set(id, left - 1);
      return true;
    }),
  };
}
