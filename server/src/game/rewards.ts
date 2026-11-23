import { Rarity } from "../../generated/prisma/client";
import { prisma } from "../db";
import { ensurePlayer } from "../players";
import { describeAugment } from "./augments";
import { AUGMENT_DURATION_MS, LOSER_XP, WINNER_XP } from "./constants";

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
