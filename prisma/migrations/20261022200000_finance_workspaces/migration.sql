CREATE TABLE "Finance" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "entity" TEXT NOT NULL DEFAULT 'PHYSICAL',
  "ownerId" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "Finance_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "FinanceMember" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "financeId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "permissions" TEXT NOT NULL DEFAULT '["view"]',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FinanceMember_financeId_fkey" FOREIGN KEY ("financeId") REFERENCES "Finance" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "FinanceMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "Finance" ("id", "name", "entity", "ownerId", "updatedAt")
SELECT 'legacy-' || "id", 'Meu Financeiro', 'ALL', "id", CURRENT_TIMESTAMP FROM "User";

INSERT INTO "FinanceMember" ("id", "financeId", "userId", "permissions")
SELECT 'owner-' || "id", 'legacy-' || "id", "id", '["view","create","edit","delete"]' FROM "User";

ALTER TABLE "Transaction" ADD COLUMN "financeId" TEXT REFERENCES "Finance"("id") ON DELETE CASCADE;
ALTER TABLE "PaymentCard" ADD COLUMN "financeId" TEXT REFERENCES "Finance"("id") ON DELETE CASCADE;
ALTER TABLE "FinancialInstitution" ADD COLUMN "financeId" TEXT REFERENCES "Finance"("id") ON DELETE CASCADE;
ALTER TABLE "Category" ADD COLUMN "financeId" TEXT REFERENCES "Finance"("id") ON DELETE CASCADE;
ALTER TABLE "ShoppingList" ADD COLUMN "financeId" TEXT REFERENCES "Finance"("id") ON DELETE CASCADE;

UPDATE "Transaction" SET "financeId" = 'legacy-' || "userId";
UPDATE "PaymentCard" SET "financeId" = 'legacy-' || "userId";
UPDATE "FinancialInstitution" SET "financeId" = 'legacy-' || "userId";
UPDATE "Category" SET "financeId" = 'legacy-' || "userId";
UPDATE "ShoppingList" SET "financeId" = 'legacy-' || "userId";

DROP INDEX "Category_userId_name_entity_key";
CREATE UNIQUE INDEX "Category_financeId_name_entity_key" ON "Category"("financeId", "name", "entity");
CREATE UNIQUE INDEX "FinanceMember_financeId_userId_key" ON "FinanceMember"("financeId", "userId");
CREATE INDEX "Finance_ownerId_idx" ON "Finance"("ownerId");
CREATE INDEX "FinanceMember_userId_idx" ON "FinanceMember"("userId");
CREATE INDEX "Transaction_financeId_idx" ON "Transaction"("financeId");
CREATE INDEX "PaymentCard_financeId_idx" ON "PaymentCard"("financeId");
CREATE INDEX "FinancialInstitution_financeId_idx" ON "FinancialInstitution"("financeId");
CREATE INDEX "Category_financeId_idx" ON "Category"("financeId");
CREATE INDEX "ShoppingList_financeId_idx" ON "ShoppingList"("financeId");
