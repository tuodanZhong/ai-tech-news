-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Article" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "content" TEXT,
    "link" TEXT NOT NULL,
    "pubDate" DATETIME NOT NULL,
    "source" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "imageUrl" TEXT,
    "trendingScore" REAL NOT NULL DEFAULT 0,
    "keywords" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Article" ("category", "content", "createdAt", "description", "id", "imageUrl", "link", "pubDate", "source", "title", "updatedAt") SELECT "category", "content", "createdAt", "description", "id", "imageUrl", "link", "pubDate", "source", "title", "updatedAt" FROM "Article";
DROP TABLE "Article";
ALTER TABLE "new_Article" RENAME TO "Article";
CREATE UNIQUE INDEX "Article_link_key" ON "Article"("link");
CREATE INDEX "Article_pubDate_idx" ON "Article"("pubDate");
CREATE INDEX "Article_category_idx" ON "Article"("category");
CREATE INDEX "Article_source_idx" ON "Article"("source");
CREATE INDEX "Article_trendingScore_idx" ON "Article"("trendingScore");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
