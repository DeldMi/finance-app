DROP INDEX "Category_userId_name_key";
ALTER TABLE "Category" ADD COLUMN "entity" TEXT NOT NULL DEFAULT 'ALL';

UPDATE "Category"
SET "name" = CASE lower(trim("name"))
  WHEN 'auxilio' THEN 'Auxílio'
  WHEN 'carro partícula' THEN 'Carro Particular'
  WHEN 'cartao' THEN 'Cartão'
  WHEN 'contão' THEN 'Conta'
  WHEN 'delivry' THEN 'Delivery'
  WHEN 'transporte púbico' THEN 'Transporte Público'
  ELSE trim("name")
END;

UPDATE "Transaction"
SET "category" = CASE lower(trim("category"))
  WHEN 'alxilho' THEN 'Auxílio'
  WHEN 'auxilio' THEN 'Auxílio'
  WHEN 'carro partícula' THEN 'Carro Particular'
  WHEN 'cartao' THEN 'Cartão'
  WHEN 'contão' THEN 'Conta'
  WHEN 'delivry' THEN 'Delivery'
  WHEN 'transporte púbico' THEN 'Transporte Público'
  ELSE trim("category")
END;

UPDATE "Category" AS target
SET "description" = (
  SELECT group_concat(DISTINCT trim(source."description"))
  FROM "Category" AS source
  WHERE source."userId" = target."userId"
    AND source."entity" = target."entity"
    AND lower(trim(source."name")) = lower(trim(target."name"))
    AND trim(source."description") <> ''
)
WHERE target."id" IN (
  SELECT "id" FROM (
    SELECT "id", ROW_NUMBER() OVER (
      PARTITION BY "userId", "entity", lower(trim("name")) ORDER BY "createdAt", "id"
    ) AS row_number
    FROM "Category"
  ) WHERE row_number = 1
)
AND EXISTS (
  SELECT 1 FROM "Category" AS source
  WHERE source."userId" = target."userId"
    AND source."entity" = target."entity"
    AND lower(trim(source."name")) = lower(trim(target."name"))
    AND trim(source."description") <> ''
);

DELETE FROM "Category"
WHERE "id" IN (
  SELECT "id" FROM (
    SELECT "id", ROW_NUMBER() OVER (
      PARTITION BY "userId", "entity", lower(trim("name")) ORDER BY "createdAt", "id"
    ) AS row_number
    FROM "Category"
  ) WHERE row_number > 1
);

INSERT INTO "Category" ("id", "userId", "name", "description", "entity", "createdAt")
SELECT lower(hex(randomblob(16))), t."userId", t."category", '', t."entity", CURRENT_TIMESTAMP
FROM "Transaction" AS t
WHERE trim(t."category") <> ''
  AND NOT EXISTS (
    SELECT 1 FROM "Category" AS c
    WHERE c."userId" = t."userId"
      AND c."entity" = t."entity"
      AND lower(trim(c."name")) = lower(trim(t."category"))
  )
GROUP BY t."userId", t."entity", t."category";

CREATE UNIQUE INDEX "Category_userId_name_entity_key" ON "Category"("userId", "name", "entity");

CREATE TABLE "FinancialInstitution" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "institution" TEXT NOT NULL,
  "accountType" TEXT NOT NULL DEFAULT 'CHECKING',
  "entity" TEXT NOT NULL DEFAULT 'PHYSICAL',
  "initialBalance" REAL NOT NULL DEFAULT 0,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FinancialInstitution_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "FinancialInstitution_userId_idx" ON "FinancialInstitution"("userId");

ALTER TABLE "PaymentCard" ADD COLUMN "paymentType" TEXT NOT NULL DEFAULT 'CREDIT';
ALTER TABLE "Transaction" ADD COLUMN "accountId" TEXT REFERENCES "FinancialInstitution"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Transaction" ADD COLUMN "purpose" TEXT NOT NULL DEFAULT 'STANDARD';
ALTER TABLE "Transaction" ADD COLUMN "autoDebit" BOOLEAN NOT NULL DEFAULT 0;
ALTER TABLE "Transaction" ADD COLUMN "isSubscription" BOOLEAN NOT NULL DEFAULT 0;
ALTER TABLE "Transaction" ADD COLUMN "notes" TEXT;
CREATE INDEX "Transaction_accountId_idx" ON "Transaction"("accountId");
