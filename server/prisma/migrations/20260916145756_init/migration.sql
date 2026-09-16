-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" TEXT,
    "accountUserId" TEXT,
    CONSTRAINT "Player_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Player_accountUserId_fkey" FOREIGN KEY ("accountUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Game" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "label" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" DATETIME,
    "createdByUserId" TEXT,
    CONSTRAINT "Game_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GamePlayer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gameId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "seat" INTEGER NOT NULL,
    CONSTRAINT "GamePlayer_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GamePlayer_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Hand" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gameId" TEXT NOT NULL,
    "handNumber" INTEGER NOT NULL,
    "dealerId" TEXT NOT NULL,
    "passedRound" BOOLEAN NOT NULL DEFAULT false,
    "pointsMultiplier" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Hand_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Hand_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "Player" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HandDeclaration" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "handId" TEXT NOT NULL,
    "contractCode" TEXT NOT NULL,
    "trumpSuit" TEXT,
    "tricksWon" INTEGER NOT NULL,
    "success" BOOLEAN NOT NULL,
    CONSTRAINT "HandDeclaration_handId_fkey" FOREIGN KEY ("handId") REFERENCES "Hand" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HandDeclarationPlayer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "handDeclarationId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    CONSTRAINT "HandDeclarationPlayer_handDeclarationId_fkey" FOREIGN KEY ("handDeclarationId") REFERENCES "HandDeclaration" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "HandDeclarationPlayer_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HandPlayerScore" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "handId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    CONSTRAINT "HandPlayerScore_handId_fkey" FOREIGN KEY ("handId") REFERENCES "Hand" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "HandPlayerScore_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Player_name_key" ON "Player"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Player_accountUserId_key" ON "Player"("accountUserId");

-- CreateIndex
CREATE UNIQUE INDEX "GamePlayer_gameId_playerId_key" ON "GamePlayer"("gameId", "playerId");

-- CreateIndex
CREATE UNIQUE INDEX "GamePlayer_gameId_seat_key" ON "GamePlayer"("gameId", "seat");

-- CreateIndex
CREATE UNIQUE INDEX "Hand_gameId_handNumber_key" ON "Hand"("gameId", "handNumber");

-- CreateIndex
CREATE UNIQUE INDEX "HandDeclarationPlayer_handDeclarationId_playerId_key" ON "HandDeclarationPlayer"("handDeclarationId", "playerId");

-- CreateIndex
CREATE UNIQUE INDEX "HandPlayerScore_handId_playerId_key" ON "HandPlayerScore"("handId", "playerId");
