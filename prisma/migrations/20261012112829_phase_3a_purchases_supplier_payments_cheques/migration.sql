-- CreateEnum
CREATE TYPE "PurchaseStatus" AS ENUM ('POSTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SupplierPaymentMethod" AS ENUM ('CASH', 'BANK_TRANSFER', 'CHEQUE');

-- CreateEnum
CREATE TYPE "SupplierChequeStatus" AS ENUM ('PENDING', 'CLEARED', 'BOUNCED', 'VOIDED');

-- CreateTable
CREATE TABLE "Purchases" (
    "Id" UUID NOT NULL,
    "Code" TEXT NOT NULL,
    "SupplierId" UUID NOT NULL,
    "SupplierInvoiceNo" TEXT,
    "InvoiceDate" TIMESTAMPTZ(6) NOT NULL,
    "DueDate" TIMESTAMPTZ(6),
    "WarehouseId" UUID NOT NULL,
    "Status" "PurchaseStatus" NOT NULL DEFAULT 'POSTED',
    "Subtotal" DECIMAL(18,4) NOT NULL,
    "TaxAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "TotalAmount" DECIMAL(18,4) NOT NULL,
    "PaidAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "Notes" TEXT,
    "CreatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMPTZ(6) NOT NULL,
    "DeletedAt" TIMESTAMPTZ(6),
    "CreatedByUserId" UUID,
    "UpdatedByUserId" UUID,
    "CancelledAt" TIMESTAMPTZ(6),
    "CancelledByUserId" UUID,

    CONSTRAINT "Purchases_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "PurchaseItems" (
    "Id" UUID NOT NULL,
    "PurchaseId" UUID NOT NULL,
    "ProductId" UUID NOT NULL,
    "Qty" INTEGER NOT NULL,
    "UnitCost" DECIMAL(18,4) NOT NULL,
    "TaxRate" DECIMAL(5,2),
    "LineSubtotal" DECIMAL(18,4) NOT NULL,
    "LineTax" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "LineTotal" DECIMAL(18,4) NOT NULL,
    "Notes" TEXT,
    "CreatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseItems_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "SupplierPayments" (
    "Id" UUID NOT NULL,
    "Code" TEXT NOT NULL,
    "SupplierId" UUID NOT NULL,
    "PurchaseId" UUID NOT NULL,
    "Method" "SupplierPaymentMethod" NOT NULL,
    "Amount" DECIMAL(18,4) NOT NULL,
    "PaidAt" TIMESTAMPTZ(6) NOT NULL,
    "ChequeId" UUID,
    "Notes" TEXT,
    "CreatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMPTZ(6) NOT NULL,
    "CreatedByUserId" UUID,
    "UpdatedByUserId" UUID,

    CONSTRAINT "SupplierPayments_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "SupplierCheques" (
    "Id" UUID NOT NULL,
    "Code" TEXT NOT NULL,
    "SupplierId" UUID NOT NULL,
    "PurchaseId" UUID NOT NULL,
    "ChequeNumber" TEXT NOT NULL,
    "BankName" TEXT,
    "Amount" DECIMAL(18,4) NOT NULL,
    "IssueDate" TIMESTAMPTZ(6) NOT NULL,
    "DueDate" TIMESTAMPTZ(6) NOT NULL,
    "Status" "SupplierChequeStatus" NOT NULL DEFAULT 'PENDING',
    "ClearedAt" TIMESTAMPTZ(6),
    "BouncedAt" TIMESTAMPTZ(6),
    "BounceReason" TEXT,
    "Notes" TEXT,
    "CreatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMPTZ(6) NOT NULL,
    "CreatedByUserId" UUID,
    "UpdatedByUserId" UUID,

    CONSTRAINT "SupplierCheques_pkey" PRIMARY KEY ("Id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Purchases_Code_key" ON "Purchases"("Code");

-- CreateIndex
CREATE INDEX "Purchases_SupplierId_idx" ON "Purchases"("SupplierId");

-- CreateIndex
CREATE INDEX "Purchases_WarehouseId_idx" ON "Purchases"("WarehouseId");

-- CreateIndex
CREATE INDEX "Purchases_Status_idx" ON "Purchases"("Status");

-- CreateIndex
CREATE INDEX "Purchases_InvoiceDate_idx" ON "Purchases"("InvoiceDate");

-- CreateIndex
CREATE INDEX "Purchases_DueDate_idx" ON "Purchases"("DueDate");

-- CreateIndex
CREATE INDEX "Purchases_CreatedAt_idx" ON "Purchases"("CreatedAt");

-- CreateIndex
CREATE INDEX "PurchaseItems_PurchaseId_idx" ON "PurchaseItems"("PurchaseId");

-- CreateIndex
CREATE INDEX "PurchaseItems_ProductId_idx" ON "PurchaseItems"("ProductId");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierPayments_Code_key" ON "SupplierPayments"("Code");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierPayments_ChequeId_key" ON "SupplierPayments"("ChequeId");

-- CreateIndex
CREATE INDEX "SupplierPayments_SupplierId_idx" ON "SupplierPayments"("SupplierId");

-- CreateIndex
CREATE INDEX "SupplierPayments_PurchaseId_idx" ON "SupplierPayments"("PurchaseId");

-- CreateIndex
CREATE INDEX "SupplierPayments_Method_idx" ON "SupplierPayments"("Method");

-- CreateIndex
CREATE INDEX "SupplierPayments_PaidAt_idx" ON "SupplierPayments"("PaidAt");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierCheques_Code_key" ON "SupplierCheques"("Code");

-- CreateIndex
CREATE INDEX "SupplierCheques_SupplierId_idx" ON "SupplierCheques"("SupplierId");

-- CreateIndex
CREATE INDEX "SupplierCheques_PurchaseId_idx" ON "SupplierCheques"("PurchaseId");

-- CreateIndex
CREATE INDEX "SupplierCheques_Status_idx" ON "SupplierCheques"("Status");

-- CreateIndex
CREATE INDEX "SupplierCheques_DueDate_idx" ON "SupplierCheques"("DueDate");

-- CreateIndex
CREATE INDEX "SupplierCheques_ChequeNumber_idx" ON "SupplierCheques"("ChequeNumber");

-- AddForeignKey
ALTER TABLE "Purchases" ADD CONSTRAINT "Purchases_SupplierId_fkey" FOREIGN KEY ("SupplierId") REFERENCES "Suppliers"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchases" ADD CONSTRAINT "Purchases_WarehouseId_fkey" FOREIGN KEY ("WarehouseId") REFERENCES "Warehouses"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseItems" ADD CONSTRAINT "PurchaseItems_PurchaseId_fkey" FOREIGN KEY ("PurchaseId") REFERENCES "Purchases"("Id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseItems" ADD CONSTRAINT "PurchaseItems_ProductId_fkey" FOREIGN KEY ("ProductId") REFERENCES "Products"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierPayments" ADD CONSTRAINT "SupplierPayments_SupplierId_fkey" FOREIGN KEY ("SupplierId") REFERENCES "Suppliers"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierPayments" ADD CONSTRAINT "SupplierPayments_PurchaseId_fkey" FOREIGN KEY ("PurchaseId") REFERENCES "Purchases"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierPayments" ADD CONSTRAINT "SupplierPayments_ChequeId_fkey" FOREIGN KEY ("ChequeId") REFERENCES "SupplierCheques"("Id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierCheques" ADD CONSTRAINT "SupplierCheques_SupplierId_fkey" FOREIGN KEY ("SupplierId") REFERENCES "Suppliers"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierCheques" ADD CONSTRAINT "SupplierCheques_PurchaseId_fkey" FOREIGN KEY ("PurchaseId") REFERENCES "Purchases"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;
