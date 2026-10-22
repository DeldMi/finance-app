ALTER TABLE "Transaction" ADD COLUMN "dueDate" DATETIME;
ALTER TABLE "Transaction" ADD COLUMN "paidAt" DATETIME;
ALTER TABLE "Transaction" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'PAID';
ALTER TABLE "Transaction" ADD COLUMN "recurrence" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "installmentGroup" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "installmentNumber" INTEGER;
ALTER TABLE "Transaction" ADD COLUMN "installmentTotal" INTEGER;
ALTER TABLE "Transaction" ADD COLUMN "cardId" TEXT;
CREATE TABLE "PaymentCard" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "brand" TEXT,
  "lastFour" TEXT,
  "creditLimit" REAL,
  "closingDay" INTEGER,
  "dueDay" INTEGER,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentCard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "PaymentCard_userId_idx" ON "PaymentCard"("userId");
