/**
 * Inserts test data for checking the nightly augment wipe.
 *
 *   npm run test:db          then   GET http://localhost:3000/debug/trigger-cron
 *
 * Creates (or reuses) a player named "test_player" and gives them two augments:
 *   - EXPIRED: expiresAt = 5 minutes ago  -> the wipe should delete this
 *   - ACTIVE:  expiresAt = 1 hour from now -> the wipe should keep this (control)
 * Requires the seed to have run first (npx prisma db seed).
 */
import { prisma } from "../src/db";

const TEST_USERNAME = "test_player";
const MINUTE = 60 * 1000;

async function main() {
  const augments = await prisma.augment.findMany({ take: 2, orderBy: { name: "asc" } });
  if (augments.length < 2) {
    throw new Error("Not enough augments found. Run `npx prisma db seed` first.");
  }

  const player = await prisma.player.upsert({
    where: { username: TEST_USERNAME },
    update: {},
    create: { username: TEST_USERNAME },
  });

  // Start from a clean slate so repeated runs give predictable counts
  await prisma.playerAugment.deleteMany({ where: { playerId: player.id } });

  const now = Date.now();
  const expired = await prisma.playerAugment.create({
    data: { playerId: player.id, augmentId: augments[0].id, expiresAt: new Date(now - 5 * MINUTE) },
  });
  const active = await prisma.playerAugment.create({
    data: { playerId: player.id, augmentId: augments[1].id, expiresAt: new Date(now + 60 * MINUTE) },
  });

  console.log(`Player "${player.username}" (${player.id})`);
  console.log(`  EXPIRED  ${augments[0].name.padEnd(18)} expiresAt ${expired.expiresAt.toISOString()}  <- should be deleted`);
  console.log(`  ACTIVE   ${augments[1].name.padEnd(18)} expiresAt ${active.expiresAt.toISOString()}  <- should remain`);
  console.log(`\nNow call GET http://localhost:${process.env.PORT || 3000}/debug/trigger-cron — expect "deleted": 1`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
