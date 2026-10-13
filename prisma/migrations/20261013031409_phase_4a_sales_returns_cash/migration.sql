-- CreateEnum
CREATE TYPE "SaleStatus" AS ENUM ('COMPLETED', 'PARTIALLY_RETURNED', 'FULLY_RETURNED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SalePaymentMethod" AS ENUM ('CASH', 'CARD', 'CREDIT');

-- CreateEnum
CREATE TYPE "SaleReturnRefundMethod" AS ENUM ('CASH', 'CREDIT');

-- CreateEnum
CREATE TYPE "CustomerChequeStatus" AS ENUM ('PENDING', 'CLEARED', 'BOUNCED', 'VOIDED');

-- CreateEnum
CREATE TYPE "CashSessionStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "CashLedgerType" AS ENUM ('SALE', 'SALE_REFUND', 'CREDIT_PAYMENT', 'CASH_IN', 'CASH_OUT', 'EXPENSE', 'BANK_DEPOSIT');

-- CreateTable
CREATE TABLE "Sales" (
    "Id" UUID NOT NULL,
    "InvoiceNumber" TEXT NOT NULL,
    "TerminalId" UUID NOT NULL,
    "WarehouseId" UUID NOT NULL,
    "CashierId" UUID NOT NULL,
    "CustomerId" UUID,
    "Subtotal" DECIMAL(18,4) NOT NULL,
    "DiscountAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "TaxAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "TotalAmount" DECIMAL(18,4) NOT NULL,
    "CashAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "CardAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "CreditAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "PaidAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "RefundedAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "Status" "SaleStatus" NOT NULL DEFAULT 'COMPLETED',
    "Notes" TEXT,
    "CancelledAt" TIMESTAMPTZ(6),
    "CancelledByUserId" UUID,
    "CancelReason" TEXT,
    "CreatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMPTZ(6) NOT NULL,
    "DeletedAt" TIMESTAMPTZ(6),
    "CreatedByUserId" UUID,
    "UpdatedByUserId" UUID,

    CONSTRAINT "Sales_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "SaleItems" (
    "Id" UUID NOT NULL,
    "SaleId" UUID NOT NULL,
    "ProductId" UUID NOT NULL,
    "Qty" INTEGER NOT NULL,
    "UnitPrice" DECIMAL(18,4) NOT NULL,
    "Discount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "TaxRate" DECIMAL(5,2),
    "LineSubtotal" DECIMAL(18,4) NOT NULL,
    "LineDiscount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "LineTax" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "LineTotal" DECIMAL(18,4) NOT NULL,
    "ReturnedQty" INTEGER NOT NULL DEFAULT 0,
    "Notes" TEXT,
    "CreatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SaleItems_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "SalePayments" (
    "Id" UUID NOT NULL,
    "SaleId" UUID NOT NULL,
    "Method" "SalePaymentMethod" NOT NULL,
    "Amount" DECIMAL(18,4) NOT NULL,
    "Notes" TEXT,
    "CreatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedByUserId" UUID,

    CONSTRAINT "SalePayments_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "SaleReturns" (
    "Id" UUID NOT NULL,
    "Code" TEXT NOT NULL,
    "SaleId" UUID NOT NULL,
    "CustomerId" UUID,
    "RefundMethod" "SaleReturnRefundMethod" NOT NULL,
    "Subtotal" DECIMAL(18,4) NOT NULL,
    "TaxAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "RefundAmount" DECIMAL(18,4) NOT NULL,
    "Notes" TEXT,
    "CreatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedByUserId" UUID,

    CONSTRAINT "SaleReturns_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "SaleReturnItems" (
    "Id" UUID NOT NULL,
    "SaleReturnId" UUID NOT NULL,
    "SaleItemId" UUID NOT NULL,
    "ProductId" UUID NOT NULL,
    "Qty" INTEGER NOT NULL,
    "UnitPrice" DECIMAL(18,4) NOT NULL,
    "TaxRate" DECIMAL(5,2),
    "LineSubtotal" DECIMAL(18,4) NOT NULL,
    "LineTax" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "RefundAmount" DECIMAL(18,4) NOT NULL,
    "CreatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SaleReturnItems_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "CustomerCheques" (
    "Id" UUID NOT NULL,
    "Code" TEXT NOT NULL,
    "CustomerId" UUID NOT NULL,
    "SaleId" UUID,
    "ChequeNumber" TEXT NOT NULL,
    "BankName" TEXT,
    "BankBranch" TEXT,
    "Amount" DECIMAL(18,4) NOT NULL,
    "IssueDate" TIMESTAMPTZ(6) NOT NULL,
    "DueDate" TIMESTAMPTZ(6) NOT NULL,
    "Status" "CustomerChequeStatus" NOT NULL DEFAULT 'PENDING',
    "ClearedAt" TIMESTAMPTZ(6),
    "BouncedAt" TIMESTAMPTZ(6),
    "BounceReason" TEXT,
    "Notes" TEXT,
    "CreatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMPTZ(6) NOT NULL,
    "DeletedAt" TIMESTAMPTZ(6),
    "CreatedByUserId" UUID,
    "UpdatedByUserId" UUID,

    CONSTRAINT "CustomerCheques_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "CreditPayments" (
    "Id" UUID NOT NULL,
    "Code" TEXT NOT NULL,
    "CustomerId" UUID NOT NULL,
    "Method" "SalePaymentMethod" NOT NULL,
    "Amount" DECIMAL(18,4) NOT NULL,
    "PaidAt" TIMESTAMPTZ(6) NOT NULL,
    "Notes" TEXT,
    "CreatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedByUserId" UUID,

    CONSTRAINT "CreditPayments_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "CashSessions" (
    "Id" UUID NOT NULL,
    "TerminalId" UUID NOT NULL,
    "CashierId" UUID NOT NULL,
    "OpenedAt" TIMESTAMPTZ(6) NOT NULL,
    "StartingCash" DECIMAL(18,4) NOT NULL,
    "ClosedAt" TIMESTAMPTZ(6),
    "CountedCash" DECIMAL(18,4),
    "ExpectedCash" DECIMAL(18,4),
    "Difference" DECIMAL(18,4),
    "Status" "CashSessionStatus" NOT NULL DEFAULT 'OPEN',
    "Notes" TEXT,
    "CreatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ClosedByUserId" UUID,
    "CreatedByUserId" UUID,

    CONSTRAINT "CashSessions_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "CashLedgers" (
    "Id" UUID NOT NULL,
    "CashSessionId" UUID,
    "Type" "CashLedgerType" NOT NULL,
    "Amount" DECIMAL(18,4) NOT NULL,
    "SaleId" UUID,
    "SaleReturnId" UUID,
    "CreditPaymentId" UUID,
    "CustomerChequeId" UUID,
    "ExpenseId" UUID,
    "Notes" TEXT,
    "CreatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedByUserId" UUID,

    CONSTRAINT "CashLedgers_pkey" PRIMARY KEY ("Id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Sales_InvoiceNumber_key" ON "Sales"("InvoiceNumber");

-- CreateIndex
CREATE INDEX "Sales_TerminalId_idx" ON "Sales"("TerminalId");

-- CreateIndex
CREATE INDEX "Sales_WarehouseId_idx" ON "Sales"("WarehouseId");

-- CreateIndex
CREATE INDEX "Sales_CashierId_idx" ON "Sales"("CashierId");

-- CreateIndex
CREATE INDEX "Sales_CustomerId_idx" ON "Sales"("CustomerId");

-- CreateIndex
CREATE INDEX "Sales_Status_idx" ON "Sales"("Status");

-- CreateIndex
CREATE INDEX "Sales_CreatedAt_idx" ON "Sales"("CreatedAt");

-- CreateIndex
CREATE INDEX "Sales_CashAmount_idx" ON "Sales"("CashAmount");

-- CreateIndex
CREATE INDEX "Sales_CardAmount_idx" ON "Sales"("CardAmount");

-- CreateIndex
CREATE INDEX "Sales_CreditAmount_idx" ON "Sales"("CreditAmount");

-- CreateIndex
CREATE INDEX "SaleItems_SaleId_idx" ON "SaleItems"("SaleId");

-- CreateIndex
CREATE INDEX "SaleItems_ProductId_idx" ON "SaleItems"("ProductId");

-- CreateIndex
CREATE INDEX "SalePayments_SaleId_idx" ON "SalePayments"("SaleId");

-- CreateIndex
CREATE INDEX "SalePayments_Method_idx" ON "SalePayments"("Method");

-- CreateIndex
CREATE UNIQUE INDEX "SaleReturns_Code_key" ON "SaleReturns"("Code");

-- CreateIndex
CREATE INDEX "SaleReturns_SaleId_idx" ON "SaleReturns"("SaleId");

-- CreateIndex
CREATE INDEX "SaleReturns_CustomerId_idx" ON "SaleReturns"("CustomerId");

-- CreateIndex
CREATE INDEX "SaleReturns_CreatedAt_idx" ON "SaleReturns"("CreatedAt");

-- CreateIndex
CREATE INDEX "SaleReturnItems_SaleReturnId_idx" ON "SaleReturnItems"("SaleReturnId");

-- CreateIndex
CREATE INDEX "SaleReturnItems_SaleItemId_idx" ON "SaleReturnItems"("SaleItemId");

-- CreateIndex
CREATE INDEX "SaleReturnItems_ProductId_idx" ON "SaleReturnItems"("ProductId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerCheques_Code_key" ON "CustomerCheques"("Code");

-- CreateIndex
CREATE INDEX "CustomerCheques_CustomerId_idx" ON "CustomerCheques"("CustomerId");

-- CreateIndex
CREATE INDEX "CustomerCheques_SaleId_idx" ON "CustomerCheques"("SaleId");

-- CreateIndex
CREATE INDEX "CustomerCheques_Status_idx" ON "CustomerCheques"("Status");

-- CreateIndex
CREATE INDEX "CustomerCheques_DueDate_idx" ON "CustomerCheques"("DueDate");

-- CreateIndex
CREATE INDEX "CustomerCheques_ChequeNumber_idx" ON "CustomerCheques"("ChequeNumber");

-- CreateIndex
CREATE UNIQUE INDEX "CreditPayments_Code_key" ON "CreditPayments"("Code");

-- CreateIndex
CREATE INDEX "CreditPayments_CustomerId_idx" ON "CreditPayments"("CustomerId");

-- CreateIndex
CREATE INDEX "CreditPayments_Method_idx" ON "CreditPayments"("Method");

-- CreateIndex
CREATE INDEX "CreditPayments_PaidAt_idx" ON "CreditPayments"("PaidAt");

-- CreateIndex
CREATE INDEX "CashSessions_TerminalId_idx" ON "CashSessions"("TerminalId");

-- CreateIndex
CREATE INDEX "CashSessions_CashierId_idx" ON "CashSessions"("CashierId");

-- CreateIndex
CREATE INDEX "CashSessions_Status_idx" ON "CashSessions"("Status");

-- CreateIndex
CREATE INDEX "CashSessions_OpenedAt_idx" ON "CashSessions"("OpenedAt");

-- CreateIndex
CREATE INDEX "CashLedgers_CashSessionId_idx" ON "CashLedgers"("CashSessionId");

-- CreateIndex
CREATE INDEX "CashLedgers_Type_idx" ON "CashLedgers"("Type");

-- CreateIndex
CREATE INDEX "CashLedgers_CreatedAt_idx" ON "CashLedgers"("CreatedAt");

-- CreateIndex
CREATE INDEX "CashLedgers_SaleId_idx" ON "CashLedgers"("SaleId");

-- CreateIndex
CREATE INDEX "CashLedgers_SaleReturnId_idx" ON "CashLedgers"("SaleReturnId");

-- CreateIndex
CREATE INDEX "CashLedgers_CreditPaymentId_idx" ON "CashLedgers"("CreditPaymentId");

-- AddForeignKey
ALTER TABLE "Sales" ADD CONSTRAINT "Sales_TerminalId_fkey" FOREIGN KEY ("TerminalId") REFERENCES "Terminals"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sales" ADD CONSTRAINT "Sales_WarehouseId_fkey" FOREIGN KEY ("WarehouseId") REFERENCES "Warehouses"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sales" ADD CONSTRAINT "Sales_CashierId_fkey" FOREIGN KEY ("CashierId") REFERENCES "Users"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sales" ADD CONSTRAINT "Sales_CustomerId_fkey" FOREIGN KEY ("CustomerId") REFERENCES "Customers"("Id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleItems" ADD CONSTRAINT "SaleItems_SaleId_fkey" FOREIGN KEY ("SaleId") REFERENCES "Sales"("Id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleItems" ADD CONSTRAINT "SaleItems_ProductId_fkey" FOREIGN KEY ("ProductId") REFERENCES "Products"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalePayments" ADD CONSTRAINT "SalePayments_SaleId_fkey" FOREIGN KEY ("SaleId") REFERENCES "Sales"("Id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleReturns" ADD CONSTRAINT "SaleReturns_SaleId_fkey" FOREIGN KEY ("SaleId") REFERENCES "Sales"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleReturns" ADD CONSTRAINT "SaleReturns_CustomerId_fkey" FOREIGN KEY ("CustomerId") REFERENCES "Customers"("Id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleReturnItems" ADD CONSTRAINT "SaleReturnItems_SaleReturnId_fkey" FOREIGN KEY ("SaleReturnId") REFERENCES "SaleReturns"("Id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleReturnItems" ADD CONSTRAINT "SaleReturnItems_SaleItemId_fkey" FOREIGN KEY ("SaleItemId") REFERENCES "SaleItems"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleReturnItems" ADD CONSTRAINT "SaleReturnItems_ProductId_fkey" FOREIGN KEY ("ProductId") REFERENCES "Products"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerCheques" ADD CONSTRAINT "CustomerCheques_CustomerId_fkey" FOREIGN KEY ("CustomerId") REFERENCES "Customers"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerCheques" ADD CONSTRAINT "CustomerCheques_SaleId_fkey" FOREIGN KEY ("SaleId") REFERENCES "Sales"("Id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditPayments" ADD CONSTRAINT "CreditPayments_CustomerId_fkey" FOREIGN KEY ("CustomerId") REFERENCES "Customers"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashSessions" ADD CONSTRAINT "CashSessions_TerminalId_fkey" FOREIGN KEY ("TerminalId") REFERENCES "Terminals"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashSessions" ADD CONSTRAINT "CashSessions_CashierId_fkey" FOREIGN KEY ("CashierId") REFERENCES "Users"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashLedgers" ADD CONSTRAINT "CashLedgers_CashSessionId_fkey" FOREIGN KEY ("CashSessionId") REFERENCES "CashSessions"("Id") ON DELETE SET NULL ON UPDATE CASCADE;
