import { Rarity } from "../../generated/prisma/client";
import { prisma } from "../db";
import { ensurePlayer } from "../players";
import { describeAugment } from "./augments";
import { AUGMENT_DURATION_MS, LOSER_XP, WINNER_XP } from "./constants";
import { getTroopLevelFromXp, getTroopLevelProgress, TROOP_XP_PER_SECOND } from "./troopLevels";
import { getUnitStats } from "./units";

export interface TroopXpGain {
  cardId: string;
  name: string;
  xpGained: number;
  totalXp: number;
  previousLevel: number;
  newLevel: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
}

export interface AugmentReward {
  name: string;
  rarity: Rarity;
  effectModifier: number;
  effect: string | null; // e.g. "+10% unit health"; null for an augment with no in-match effect defined
  expiresAt: string; // ISO timestamp
}

export interface PlayerReward {
  xpGained: number;
  totalXp: number;
  augment: AugmentReward | null; // null if no augment of that rarity exists (not seeded)
}

/** Robin Hood rewards: winner gets XP and a Common augment, loser gets no XP but a Legendary augment. */
export const REWARD_PACKAGES = {
  victory: { xp: WINNER_XP, rarity: Rarity.Common },
  defeat: { xp: LOSER_XP, rarity: Rarity.Legendary },
} as const;

/**
 * Adds XP to a player (creating the Player row if this username is new) and
 * mints a random augment of the given rarity that expires after AUGMENT_DURATION_MS.
 * Runs in one transaction so a player never gets the XP without the augment or vice versa.
 */
export async function grantMatchReward(username: string, xp: number, rarity: Rarity): Promise<PlayerReward> {
  const { id: playerId } = await ensurePlayer(username);

  return prisma.$transaction(async (tx) => {
    const player = await tx.player.update({
      where: { id: playerId },
      data: { accountXp: { increment: xp } },
    });

    const candidates = await tx.augment.findMany({ where: { rarity } });
    if (candidates.length === 0) {
      return { xpGained: xp, totalXp: player.accountXp, augment: null };
    }

    const augment = candidates[Math.floor(Math.random() * candidates.length)];
    const grant = await tx.playerAugment.create({
      data: {
        playerId: player.id,
        augmentId: augment.id,
        expiresAt: new Date(Date.now() + AUGMENT_DURATION_MS),
      },
    });

    return {
      xpGained: xp,
      totalXp: player.accountXp,
      augment: {
        name: augment.name,
        rarity: augment.rarity,
        effectModifier: augment.effectModifier,
        effect: describeAugment(augment.id) ?? null,
        expiresAt: grant.expiresAt.toISOString(),
      },
    };
  });
}

/**
 * Awards per-troop XP to each distinct troop spawned by `username` during a match,
 * proportional to match play time (1 XP per second). Updates `PlayerCard.xp` and `level`.
 */
export async function grantTroopXp(
  username: string,
  playedCardIds: string[],
  durationSeconds: number,
): Promise<TroopXpGain[]> {
  const uniqueIds = [...new Set(playedCardIds)].filter((id) => !!getUnitStats(id));
  if (uniqueIds.length === 0) return [];

  const xpGained = Math.max(1, Math.round(durationSeconds)) * TROOP_XP_PER_SECOND;
  const { id: playerId } = await ensurePlayer(username);

  return prisma.$transaction(async (tx) => {
    const gains: TroopXpGain[] = [];
    for (const cardId of uniqueIds) {
      const existing = await tx.playerCard.findUnique({
        where: { playerId_cardId: { playerId, cardId } },
        select: { xp: true, level: true },
      });
      if (!existing) continue;

      const previousLevel = getTroopLevelFromXp(existing.xp);
      const updated = await tx.playerCard.update({
        where: { playerId_cardId: { playerId, cardId } },
        data: { xp: { increment: xpGained } },
        select: { xp: true },
      });
      const progress = getTroopLevelProgress(updated.xp);
      if (progress.level !== existing.level) {
        await tx.playerCard.update({
          where: { playerId_cardId: { playerId, cardId } },
          data: { level: progress.level },
        });
      }
      gains.push({
        cardId,
        name: getUnitStats(cardId)?.name ?? cardId,
        xpGained,
        totalXp: progress.xp,
        previousLevel,
        newLevel: progress.level,
        xpIntoLevel: progress.xpIntoLevel,
        xpForNextLevel: progress.xpForNextLevel,
      });
    }
    return gains;
  });
}
