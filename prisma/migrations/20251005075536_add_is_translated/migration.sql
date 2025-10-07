-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Article" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "titleOriginal" TEXT,
    "description" TEXT,
    "descriptionOriginal" TEXT,
    "content" TEXT,
    "contentOriginal" TEXT,
    "link" TEXT NOT NULL,
    "pubDate" DATETIME NOT NULL,
    "source" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "imageUrl" TEXT,
    "trendingScore" REAL NOT NULL DEFAULT 0,
    "keywords" TEXT,
    "isTranslated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Article" ("category", "content", "contentOriginal", "createdAt", "description", "descriptionOriginal", "id", "imageUrl", "keywords", "link", "pubDate", "source", "title", "titleOriginal", "trendingScore", "updatedAt") SELECT "category", "content", "contentOriginal", "createdAt", "description", "descriptionOriginal", "id", "imageUrl", "keywords", "link", "pubDate", "source", "title", "titleOriginal", "trendingScore", "updatedAt" FROM "Article";
DROP TABLE "Article";
ALTER TABLE "new_Article" RENAME TO "Article";
CREATE UNIQUE INDEX "Article_link_key" ON "Article"("link");
CREATE INDEX "Article_pubDate_idx" ON "Article"("pubDate");
CREATE INDEX "Article_category_idx" ON "Article"("category");
CREATE INDEX "Article_source_idx" ON "Article"("source");
CREATE INDEX "Article_trendingScore_idx" ON "Article"("trendingScore");
CREATE INDEX "Article_isTranslated_idx" ON "Article"("isTranslated");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
