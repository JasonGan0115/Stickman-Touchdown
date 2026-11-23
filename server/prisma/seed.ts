import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Rarity } from "../generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// Fixed ids (instead of random UUIDs) so server code such as the Weekly
// Tournament config can refer to specific cards and augments.
const cards = [
  { id: "card_footsoldier", name: "Footsoldier", type: "Melee", manaCost: 1 },
  { id: "card_archer", name: "Archer", type: "Ranged", manaCost: 2 },
  { id: "card_shield_bearer", name: "Shield Bearer", type: "Tank", manaCost: 3 },
  { id: "card_battle_mage", name: "Battle Mage", type: "Caster", manaCost: 4 },
];

const augments = [
  { id: "aug_swift_boots", name: "Swift Boots", rarity: Rarity.Common, effectModifier: 1.05 },
  { id: "aug_iron_skin", name: "Iron Skin", rarity: Rarity.Common, effectModifier: 1.1 },
  { id: "aug_quick_hands", name: "Quick Hands", rarity: Rarity.Common, effectModifier: 1.08 },
  { id: "aug_mana_surge", name: "Mana Surge", rarity: Rarity.Rare, effectModifier: 1.2 },
  { id: "aug_berserker_rage", name: "Berserker Rage", rarity: Rarity.Rare, effectModifier: 1.25 },
  { id: "aug_eagle_eye", name: "Eagle Eye", rarity: Rarity.Rare, effectModifier: 1.15 },
  { id: "aug_titans_blessing", name: "Titan's Blessing", rarity: Rarity.Legendary, effectModifier: 1.5 },
  { id: "aug_phoenix_heart", name: "Phoenix Heart", rarity: Rarity.Legendary, effectModifier: 1.4 },
];

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
