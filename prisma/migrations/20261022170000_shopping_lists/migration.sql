CREATE TABLE "ShoppingList" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "shareToken" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "ShoppingList_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ShoppingList_shareToken_key"
  ON "ShoppingList" ("shareToken");
CREATE INDEX "ShoppingList_userId_idx" ON "ShoppingList" ("userId");

CREATE TABLE "ShoppingListItem" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "listId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "quantity" REAL NOT NULL,
  "unit" TEXT NOT NULL DEFAULT 'un',
  "unitPrice" REAL NOT NULL,
  "checked" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "ShoppingListItem_listId_fkey"
    FOREIGN KEY ("listId") REFERENCES "ShoppingList" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "ShoppingListItem_listId_idx" ON "ShoppingListItem" ("listId");
