-- AlterTable
ALTER TABLE "Game" ADD COLUMN     "rikikiDoublePeak" BOOLEAN DEFAULT false,
ADD COLUMN     "rikikiPeak" INTEGER,
ADD COLUMN     "rikikiZeroBidPenalty" BOOLEAN DEFAULT false,
ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'WHIST';

-- CreateTable
CREATE TABLE "RikikiRound" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "cardsDealt" INTEGER NOT NULL,
    "dealerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RikikiRound_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RikikiBid" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "bid" INTEGER NOT NULL,
    "tricksWon" INTEGER NOT NULL,
    "success" BOOLEAN NOT NULL,
    "zeroBidPenalty" BOOLEAN NOT NULL DEFAULT false,
    "points" INTEGER NOT NULL,

    CONSTRAINT "RikikiBid_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RikikiRound_gameId_roundNumber_key" ON "RikikiRound"("gameId", "roundNumber");

-- CreateIndex
CREATE UNIQUE INDEX "RikikiBid_roundId_playerId_key" ON "RikikiBid"("roundId", "playerId");

-- AddForeignKey
ALTER TABLE "RikikiRound" ADD CONSTRAINT "RikikiRound_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RikikiRound" ADD CONSTRAINT "RikikiRound_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RikikiBid" ADD CONSTRAINT "RikikiBid_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "RikikiRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RikikiBid" ADD CONSTRAINT "RikikiBid_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
