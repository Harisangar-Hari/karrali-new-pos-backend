-- CreateEnum
CREATE TYPE "CustomerType" AS ENUM ('RETAIL', 'WHOLESALE', 'CORPORATE', 'VIP', 'GOVERNMENT', 'EDUCATIONAL');

-- CreateEnum
CREATE TYPE "CustomerLedgerType" AS ENUM ('OPENING', 'SALE', 'SALE_RETURN', 'PAYMENT', 'CHEQUE', 'CHEQUE_BOUNCED', 'ADJUSTMENT', 'WRITE_OFF');

-- CreateTable
CREATE TABLE "CodeSequences" (
    "Prefix" TEXT NOT NULL,
    "LastNumber" INTEGER NOT NULL DEFAULT 0,
    "UpdatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "CodeSequences_pkey" PRIMARY KEY ("Prefix")
);

-- CreateTable
CREATE TABLE "Customers" (
    "Id" UUID NOT NULL,
    "Code" TEXT NOT NULL,
    "Name" TEXT NOT NULL,
    "Type" "CustomerType" NOT NULL DEFAULT 'RETAIL',
    "Phone" TEXT,
    "Email" TEXT,
    "Address" TEXT,
    "TaxNumber" TEXT,
    "Balance" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "CreditLimit" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "PaymentTerms" TEXT,
    "LoyaltyPoints" INTEGER NOT NULL DEFAULT 0,
    "LoyaltyTier" TEXT,
    "Notes" TEXT,
    "IsActive" BOOLEAN NOT NULL DEFAULT true,
    "CreatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMPTZ(6) NOT NULL,
    "DeletedAt" TIMESTAMPTZ(6),
    "CreatedByUserId" UUID,
    "UpdatedByUserId" UUID,

    CONSTRAINT "Customers_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "CustomerLedgers" (
    "Id" UUID NOT NULL,
    "CustomerId" UUID NOT NULL,
    "Type" "CustomerLedgerType" NOT NULL,
    "Amount" DECIMAL(18,4) NOT NULL,
    "BalanceAfter" DECIMAL(18,4) NOT NULL,
    "Notes" TEXT,
    "SaleId" UUID,
    "SaleReturnId" UUID,
    "CreditPaymentId" UUID,
    "ChequeId" UUID,
    "CreatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedByUserId" UUID,

    CONSTRAINT "CustomerLedgers_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "Suppliers" (
    "Id" UUID NOT NULL,
    "Code" TEXT NOT NULL,
    "Name" TEXT NOT NULL,
    "Phone" TEXT,
    "Email" TEXT,
    "Address" TEXT,
    "TaxNumber" TEXT,
    "PaymentTerms" TEXT,
    "BankName" TEXT,
    "BankAccountNo" TEXT,
    "BankBranch" TEXT,
    "BankSwift" TEXT,
    "Notes" TEXT,
    "IsActive" BOOLEAN NOT NULL DEFAULT true,
    "CreatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMPTZ(6) NOT NULL,
    "DeletedAt" TIMESTAMPTZ(6),
    "CreatedByUserId" UUID,
    "UpdatedByUserId" UUID,

    CONSTRAINT "Suppliers_pkey" PRIMARY KEY ("Id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Customers_Code_key" ON "Customers"("Code");

-- CreateIndex
CREATE INDEX "Customers_Name_idx" ON "Customers"("Name");

-- CreateIndex
CREATE INDEX "Customers_Phone_idx" ON "Customers"("Phone");

-- CreateIndex
CREATE INDEX "Customers_Email_idx" ON "Customers"("Email");

-- CreateIndex
CREATE INDEX "Customers_Type_idx" ON "Customers"("Type");

-- CreateIndex
CREATE INDEX "Customers_Balance_idx" ON "Customers"("Balance");

-- CreateIndex
CREATE INDEX "Customers_IsActive_idx" ON "Customers"("IsActive");

-- CreateIndex
CREATE INDEX "Customers_DeletedAt_idx" ON "Customers"("DeletedAt");

-- CreateIndex
CREATE INDEX "CustomerLedgers_CustomerId_idx" ON "CustomerLedgers"("CustomerId");

-- CreateIndex
CREATE INDEX "CustomerLedgers_Type_idx" ON "CustomerLedgers"("Type");

-- CreateIndex
CREATE INDEX "CustomerLedgers_CreatedAt_idx" ON "CustomerLedgers"("CreatedAt");

-- CreateIndex
CREATE INDEX "CustomerLedgers_SaleId_idx" ON "CustomerLedgers"("SaleId");

-- CreateIndex
CREATE INDEX "CustomerLedgers_CreditPaymentId_idx" ON "CustomerLedgers"("CreditPaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "Suppliers_Code_key" ON "Suppliers"("Code");

-- CreateIndex
CREATE INDEX "Suppliers_Name_idx" ON "Suppliers"("Name");

-- CreateIndex
CREATE INDEX "Suppliers_Phone_idx" ON "Suppliers"("Phone");

-- CreateIndex
CREATE INDEX "Suppliers_Email_idx" ON "Suppliers"("Email");

-- CreateIndex
CREATE INDEX "Suppliers_IsActive_idx" ON "Suppliers"("IsActive");

-- CreateIndex
CREATE INDEX "Suppliers_DeletedAt_idx" ON "Suppliers"("DeletedAt");

-- AddForeignKey
ALTER TABLE "CustomerLedgers" ADD CONSTRAINT "CustomerLedgers_CustomerId_fkey" FOREIGN KEY ("CustomerId") REFERENCES "Customers"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;
