/*
  Warnings:

  - You are about to drop the `HotTopicCache` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "HotTopicCache";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "HotTopic" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "discussionCount" INTEGER NOT NULL,
    "sources" TEXT NOT NULL,
    "articleIds" TEXT NOT NULL,
    "score" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "HotTopic_type_idx" ON "HotTopic"("type");

-- CreateIndex
CREATE INDEX "HotTopic_createdAt_idx" ON "HotTopic"("createdAt");
