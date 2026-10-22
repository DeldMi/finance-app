CREATE TABLE "Category" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Category_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Category_userId_name_key" ON "Category"("userId", "name");
ALTER TABLE "Transaction" ADD COLUMN "recurrenceGroup" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "recurrenceEndDate" DATETIME;
CREATE INDEX "Transaction_recurrenceGroup_idx" ON "Transaction"("recurrenceGroup");
