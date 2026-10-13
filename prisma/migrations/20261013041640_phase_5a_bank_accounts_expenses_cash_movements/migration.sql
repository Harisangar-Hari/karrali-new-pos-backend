-- CreateEnum
CREATE TYPE "ExpensePaymentMethod" AS ENUM ('CASH', 'BANK');

-- CreateEnum
CREATE TYPE "CashMovementType" AS ENUM ('CASH_IN', 'CASH_OUT');

-- CreateTable
CREATE TABLE "BankAccounts" (
    "Id" UUID NOT NULL,
    "Name" TEXT NOT NULL,
    "BankName" TEXT NOT NULL,
    "AccountNumber" TEXT NOT NULL,
    "Branch" TEXT,
    "Swift" TEXT,
    "IsDefault" BOOLEAN NOT NULL DEFAULT false,
    "IsActive" BOOLEAN NOT NULL DEFAULT true,
    "CreatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMPTZ(6) NOT NULL,
    "DeletedAt" TIMESTAMPTZ(6),
    "CreatedByUserId" UUID,
    "UpdatedByUserId" UUID,

    CONSTRAINT "BankAccounts_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "ExpenseCategories" (
    "Id" UUID NOT NULL,
    "Name" TEXT NOT NULL,
    "IsActive" BOOLEAN NOT NULL DEFAULT true,
    "CreatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMPTZ(6) NOT NULL,
    "DeletedAt" TIMESTAMPTZ(6),
    "CreatedByUserId" UUID,
    "UpdatedByUserId" UUID,

    CONSTRAINT "ExpenseCategories_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "Expenses" (
    "Id" UUID NOT NULL,
    "Code" TEXT NOT NULL,
    "CategoryId" UUID NOT NULL,
    "Amount" DECIMAL(18,4) NOT NULL,
    "Method" "ExpensePaymentMethod" NOT NULL,
    "BankAccountId" UUID,
    "Description" TEXT NOT NULL,
    "Payee" TEXT,
    "PaidAt" TIMESTAMPTZ(6) NOT NULL,
    "Notes" TEXT,
    "CreatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMPTZ(6) NOT NULL,
    "DeletedAt" TIMESTAMPTZ(6),
    "CreatedByUserId" UUID,
    "UpdatedByUserId" UUID,

    CONSTRAINT "Expenses_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "CashMovements" (
    "Id" UUID NOT NULL,
    "Code" TEXT NOT NULL,
    "Type" "CashMovementType" NOT NULL,
    "Amount" DECIMAL(18,4) NOT NULL,
    "Reason" TEXT NOT NULL,
    "Notes" TEXT,
    "BankAccountId" UUID,
    "CashSessionId" UUID,
    "CreatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMPTZ(6) NOT NULL,
    "CreatedByUserId" UUID,
    "UpdatedByUserId" UUID,

    CONSTRAINT "CashMovements_pkey" PRIMARY KEY ("Id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BankAccounts_AccountNumber_key" ON "BankAccounts"("AccountNumber");

-- CreateIndex
CREATE INDEX "BankAccounts_IsActive_idx" ON "BankAccounts"("IsActive");

-- CreateIndex
CREATE INDEX "BankAccounts_DeletedAt_idx" ON "BankAccounts"("DeletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseCategories_Name_key" ON "ExpenseCategories"("Name");

-- CreateIndex
CREATE INDEX "ExpenseCategories_DeletedAt_idx" ON "ExpenseCategories"("DeletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Expenses_Code_key" ON "Expenses"("Code");

-- CreateIndex
CREATE INDEX "Expenses_CategoryId_idx" ON "Expenses"("CategoryId");

-- CreateIndex
CREATE INDEX "Expenses_BankAccountId_idx" ON "Expenses"("BankAccountId");

-- CreateIndex
CREATE INDEX "Expenses_Method_idx" ON "Expenses"("Method");

-- CreateIndex
CREATE INDEX "Expenses_PaidAt_idx" ON "Expenses"("PaidAt");

-- CreateIndex
CREATE INDEX "Expenses_DeletedAt_idx" ON "Expenses"("DeletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CashMovements_Code_key" ON "CashMovements"("Code");

-- CreateIndex
CREATE INDEX "CashMovements_Type_idx" ON "CashMovements"("Type");

-- CreateIndex
CREATE INDEX "CashMovements_BankAccountId_idx" ON "CashMovements"("BankAccountId");

-- CreateIndex
CREATE INDEX "CashMovements_CashSessionId_idx" ON "CashMovements"("CashSessionId");

-- CreateIndex
CREATE INDEX "CashMovements_CreatedAt_idx" ON "CashMovements"("CreatedAt");

-- AddForeignKey
ALTER TABLE "Expenses" ADD CONSTRAINT "Expenses_CategoryId_fkey" FOREIGN KEY ("CategoryId") REFERENCES "ExpenseCategories"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expenses" ADD CONSTRAINT "Expenses_BankAccountId_fkey" FOREIGN KEY ("BankAccountId") REFERENCES "BankAccounts"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashMovements" ADD CONSTRAINT "CashMovements_BankAccountId_fkey" FOREIGN KEY ("BankAccountId") REFERENCES "BankAccounts"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashMovements" ADD CONSTRAINT "CashMovements_CashSessionId_fkey" FOREIGN KEY ("CashSessionId") REFERENCES "CashSessions"("Id") ON DELETE SET NULL ON UPDATE CASCADE;
