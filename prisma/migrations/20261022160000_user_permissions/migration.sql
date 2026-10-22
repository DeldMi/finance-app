ALTER TABLE "User" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'BLOCKED';
ALTER TABLE "User" ADD COLUMN "permissions" TEXT NOT NULL DEFAULT '[]';

-- Preserve the existing account and make only the original owner an administrator.
UPDATE "User"
SET "role" = 'ADMIN', "permissions" = '["view","create","edit","delete"]'
WHERE "id" = (
  SELECT "id" FROM "User" ORDER BY "createdAt" ASC, "id" ASC LIMIT 1
);
