import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Rarity } from "../generated/prisma/client";

import { AUGMENTS } from "../src/game/augments";
import { UNIT_STATS } from "../src/game/units";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// Fixed ids (instead of random UUIDs) so server code such as the Weekly
// Tournament config can refer to specific cards and augments. The rows come
// from the gameplay tables in src/game, so a card's cost or an augment's
// modifier is only ever written in one place.
const cards = Object.values(UNIT_STATS).map((u) => ({ id: u.cardId, name: u.name, type: u.type, manaCost: u.cost }));

const augments = Object.values(AUGMENTS).map((a) => ({
  id: a.id,
  name: a.name,
  rarity: Rarity[a.rarity],
  effectModifier: a.modifier,
}));

async function main() {
  // Upsert on the unique name makes the seed safe to re-run. `update` also sets
  // the id, so a database seeded before ids were fixed is migrated to them.
  for (const card of cards) {
    await prisma.card.upsert({ where: { name: card.name }, update: card, create: card });
  }
  for (const augment of augments) {
    await prisma.augment.upsert({ where: { name: augment.name }, update: augment, create: augment });
  }
  console.log(`Seeded ${cards.length} cards and ${augments.length} augments.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
