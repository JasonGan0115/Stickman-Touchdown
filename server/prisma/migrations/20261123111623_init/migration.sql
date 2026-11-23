-- CreateEnum
CREATE TYPE "Rarity" AS ENUM ('Common', 'Rare', 'Legendary');

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "accountXp" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "loadoutUnitIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "loadoutAugmentIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Card" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "manaCost" INTEGER NOT NULL,

    CONSTRAINT "Card_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Augment" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rarity" "Rarity" NOT NULL,
    "effectModifier" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "Augment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerAugment" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "augmentId" TEXT NOT NULL,
    "acquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayerAugment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerCard" (
    "playerId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlayerCard_pkey" PRIMARY KEY ("playerId","cardId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Player_username_key" ON "Player"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Card_name_key" ON "Card"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Augment_name_key" ON "Augment"("name");

-- CreateIndex
CREATE INDEX "PlayerAugment_playerId_expiresAt_idx" ON "PlayerAugment"("playerId", "expiresAt");

-- CreateIndex
CREATE INDEX "PlayerAugment_augmentId_idx" ON "PlayerAugment"("augmentId");

-- CreateIndex
CREATE INDEX "PlayerCard_cardId_idx" ON "PlayerCard"("cardId");

-- AddForeignKey
ALTER TABLE "PlayerAugment" ADD CONSTRAINT "PlayerAugment_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerAugment" ADD CONSTRAINT "PlayerAugment_augmentId_fkey" FOREIGN KEY ("augmentId") REFERENCES "Augment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerCard" ADD CONSTRAINT "PlayerCard_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerCard" ADD CONSTRAINT "PlayerCard_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;
