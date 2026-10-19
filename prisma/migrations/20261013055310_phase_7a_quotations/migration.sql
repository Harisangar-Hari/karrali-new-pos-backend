-- CreateEnum
CREATE TYPE "QuotationStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'CONVERTED');

-- CreateTable
CREATE TABLE "Quotations" (
    "Id" UUID NOT NULL,
    "Code" TEXT NOT NULL,
    "CustomerId" UUID,
    "Status" "QuotationStatus" NOT NULL DEFAULT 'DRAFT',
    "Subtotal" DECIMAL(18,4) NOT NULL,
    "DiscountAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "TaxAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "TotalAmount" DECIMAL(18,4) NOT NULL,
    "ValidUntil" TIMESTAMPTZ(6),
    "Notes" TEXT,
    "SaleId" UUID,
    "ConvertedAt" TIMESTAMPTZ(6),
    "ConvertedByUserId" UUID,
    "CreatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMPTZ(6) NOT NULL,
    "DeletedAt" TIMESTAMPTZ(6),
    "CreatedByUserId" UUID,
    "UpdatedByUserId" UUID,

    CONSTRAINT "Quotations_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "QuotationItems" (
    "Id" UUID NOT NULL,
    "QuotationId" UUID NOT NULL,
    "ProductId" UUID NOT NULL,
    "Qty" INTEGER NOT NULL,
    "UnitPrice" DECIMAL(18,4) NOT NULL,
    "Discount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "TaxRate" DECIMAL(5,2),
    "LineSubtotal" DECIMAL(18,4) NOT NULL,
    "LineDiscount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "LineTax" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "LineTotal" DECIMAL(18,4) NOT NULL,
    "Notes" TEXT,
    "CreatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuotationItems_pkey" PRIMARY KEY ("Id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Quotations_Code_key" ON "Quotations"("Code");

-- CreateIndex
CREATE UNIQUE INDEX "Quotations_SaleId_key" ON "Quotations"("SaleId");

-- CreateIndex
CREATE INDEX "Quotations_CustomerId_idx" ON "Quotations"("CustomerId");

-- CreateIndex
CREATE INDEX "Quotations_Status_idx" ON "Quotations"("Status");

-- CreateIndex
CREATE INDEX "Quotations_ValidUntil_idx" ON "Quotations"("ValidUntil");

-- CreateIndex
CREATE INDEX "Quotations_CreatedAt_idx" ON "Quotations"("CreatedAt");

-- CreateIndex
CREATE INDEX "Quotations_DeletedAt_idx" ON "Quotations"("DeletedAt");

-- CreateIndex
CREATE INDEX "QuotationItems_QuotationId_idx" ON "QuotationItems"("QuotationId");

-- CreateIndex
CREATE INDEX "QuotationItems_ProductId_idx" ON "QuotationItems"("ProductId");

-- AddForeignKey
ALTER TABLE "Quotations" ADD CONSTRAINT "Quotations_CustomerId_fkey" FOREIGN KEY ("CustomerId") REFERENCES "Customers"("Id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quotations" ADD CONSTRAINT "Quotations_SaleId_fkey" FOREIGN KEY ("SaleId") REFERENCES "Sales"("Id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotationItems" ADD CONSTRAINT "QuotationItems_QuotationId_fkey" FOREIGN KEY ("QuotationId") REFERENCES "Quotations"("Id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotationItems" ADD CONSTRAINT "QuotationItems_ProductId_fkey" FOREIGN KEY ("ProductId") REFERENCES "Products"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;
