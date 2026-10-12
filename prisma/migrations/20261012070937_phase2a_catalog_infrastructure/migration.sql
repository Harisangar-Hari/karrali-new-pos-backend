-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('OPENING', 'PURCHASE', 'PURCHASE_RETURN', 'SALE', 'SALE_RETURN', 'ADJUSTMENT', 'TRANSFER_IN', 'TRANSFER_OUT');

-- CreateTable
CREATE TABLE "Warehouses" (
    "Id" UUID NOT NULL,
    "Name" TEXT NOT NULL,
    "Code" TEXT NOT NULL,
    "Address" TEXT,
    "IsActive" BOOLEAN NOT NULL DEFAULT true,
    "IsDefault" BOOLEAN NOT NULL DEFAULT false,
    "CreatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMPTZ(6) NOT NULL,
    "DeletedAt" TIMESTAMPTZ(6),
    "CreatedByUserId" UUID,
    "UpdatedByUserId" UUID,

    CONSTRAINT "Warehouses_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "Terminals" (
    "Id" UUID NOT NULL,
    "Name" TEXT NOT NULL,
    "Code" TEXT NOT NULL,
    "WarehouseId" UUID NOT NULL,
    "IsActive" BOOLEAN NOT NULL DEFAULT true,
    "CreatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMPTZ(6) NOT NULL,
    "DeletedAt" TIMESTAMPTZ(6),
    "CreatedByUserId" UUID,
    "UpdatedByUserId" UUID,

    CONSTRAINT "Terminals_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "Settings" (
    "Key" TEXT NOT NULL,
    "Value" JSONB NOT NULL,
    "Description" TEXT,
    "UpdatedAt" TIMESTAMPTZ(6) NOT NULL,
    "UpdatedByUserId" UUID,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("Key")
);

-- CreateTable
CREATE TABLE "Categories" (
    "Id" UUID NOT NULL,
    "Name" TEXT NOT NULL,
    "Description" TEXT,
    "ParentId" UUID,
    "IsActive" BOOLEAN NOT NULL DEFAULT true,
    "CreatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMPTZ(6) NOT NULL,
    "DeletedAt" TIMESTAMPTZ(6),
    "CreatedByUserId" UUID,
    "UpdatedByUserId" UUID,

    CONSTRAINT "Categories_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "Brands" (
    "Id" UUID NOT NULL,
    "Name" TEXT NOT NULL,
    "Description" TEXT,
    "IsActive" BOOLEAN NOT NULL DEFAULT true,
    "CreatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMPTZ(6) NOT NULL,
    "DeletedAt" TIMESTAMPTZ(6),
    "CreatedByUserId" UUID,
    "UpdatedByUserId" UUID,

    CONSTRAINT "Brands_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "Products" (
    "Id" UUID NOT NULL,
    "Name" TEXT NOT NULL,
    "Barcode" TEXT,
    "SKU" TEXT,
    "Description" TEXT,
    "Unit" TEXT NOT NULL DEFAULT 'pcs',
    "Price" DECIMAL(18,4) NOT NULL,
    "CostPrice" DECIMAL(18,4) NOT NULL,
    "Discount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "TaxRate" DECIMAL(5,2),
    "ReorderLevel" INTEGER NOT NULL DEFAULT 0,
    "WarrantyMonths" INTEGER DEFAULT 0,
    "ImageUrl" TEXT,
    "IsActive" BOOLEAN NOT NULL DEFAULT true,
    "CategoryId" UUID NOT NULL,
    "BrandId" UUID,
    "CreatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMPTZ(6) NOT NULL,
    "DeletedAt" TIMESTAMPTZ(6),
    "CreatedByUserId" UUID,
    "UpdatedByUserId" UUID,

    CONSTRAINT "Products_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "WarehouseStocks" (
    "Id" UUID NOT NULL,
    "ProductId" UUID NOT NULL,
    "WarehouseId" UUID NOT NULL,
    "Qty" INTEGER NOT NULL DEFAULT 0,
    "CreatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "WarehouseStocks_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "StockMovements" (
    "Id" UUID NOT NULL,
    "ProductId" UUID NOT NULL,
    "WarehouseId" UUID NOT NULL,
    "Type" "StockMovementType" NOT NULL,
    "Quantity" INTEGER NOT NULL,
    "UnitCost" DECIMAL(18,4),
    "Notes" TEXT,
    "SaleId" UUID,
    "SaleReturnId" UUID,
    "PurchaseId" UUID,
    "CreatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedByUserId" UUID,

    CONSTRAINT "StockMovements_pkey" PRIMARY KEY ("Id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Warehouses_Code_key" ON "Warehouses"("Code");

-- CreateIndex
CREATE INDEX "Warehouses_IsActive_idx" ON "Warehouses"("IsActive");

-- CreateIndex
CREATE INDEX "Warehouses_DeletedAt_idx" ON "Warehouses"("DeletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Terminals_Code_key" ON "Terminals"("Code");

-- CreateIndex
CREATE INDEX "Terminals_WarehouseId_idx" ON "Terminals"("WarehouseId");

-- CreateIndex
CREATE INDEX "Categories_ParentId_idx" ON "Categories"("ParentId");

-- CreateIndex
CREATE INDEX "Categories_DeletedAt_idx" ON "Categories"("DeletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Brands_Name_key" ON "Brands"("Name");

-- CreateIndex
CREATE INDEX "Brands_DeletedAt_idx" ON "Brands"("DeletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Products_Barcode_key" ON "Products"("Barcode");

-- CreateIndex
CREATE UNIQUE INDEX "Products_SKU_key" ON "Products"("SKU");

-- CreateIndex
CREATE INDEX "Products_CategoryId_idx" ON "Products"("CategoryId");

-- CreateIndex
CREATE INDEX "Products_BrandId_idx" ON "Products"("BrandId");

-- CreateIndex
CREATE INDEX "Products_IsActive_idx" ON "Products"("IsActive");

-- CreateIndex
CREATE INDEX "Products_DeletedAt_idx" ON "Products"("DeletedAt");

-- CreateIndex
CREATE INDEX "WarehouseStocks_ProductId_idx" ON "WarehouseStocks"("ProductId");

-- CreateIndex
CREATE INDEX "WarehouseStocks_WarehouseId_idx" ON "WarehouseStocks"("WarehouseId");

-- CreateIndex
CREATE UNIQUE INDEX "WarehouseStocks_ProductId_WarehouseId_key" ON "WarehouseStocks"("ProductId", "WarehouseId");

-- CreateIndex
CREATE INDEX "StockMovements_ProductId_idx" ON "StockMovements"("ProductId");

-- CreateIndex
CREATE INDEX "StockMovements_WarehouseId_idx" ON "StockMovements"("WarehouseId");

-- CreateIndex
CREATE INDEX "StockMovements_Type_idx" ON "StockMovements"("Type");

-- CreateIndex
CREATE INDEX "StockMovements_SaleId_idx" ON "StockMovements"("SaleId");

-- CreateIndex
CREATE INDEX "StockMovements_SaleReturnId_idx" ON "StockMovements"("SaleReturnId");

-- CreateIndex
CREATE INDEX "StockMovements_PurchaseId_idx" ON "StockMovements"("PurchaseId");

-- CreateIndex
CREATE INDEX "StockMovements_CreatedAt_idx" ON "StockMovements"("CreatedAt");

-- AddForeignKey
ALTER TABLE "Terminals" ADD CONSTRAINT "Terminals_WarehouseId_fkey" FOREIGN KEY ("WarehouseId") REFERENCES "Warehouses"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Categories" ADD CONSTRAINT "Categories_ParentId_fkey" FOREIGN KEY ("ParentId") REFERENCES "Categories"("Id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Products" ADD CONSTRAINT "Products_CategoryId_fkey" FOREIGN KEY ("CategoryId") REFERENCES "Categories"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Products" ADD CONSTRAINT "Products_BrandId_fkey" FOREIGN KEY ("BrandId") REFERENCES "Brands"("Id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseStocks" ADD CONSTRAINT "WarehouseStocks_ProductId_fkey" FOREIGN KEY ("ProductId") REFERENCES "Products"("Id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseStocks" ADD CONSTRAINT "WarehouseStocks_WarehouseId_fkey" FOREIGN KEY ("WarehouseId") REFERENCES "Warehouses"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovements" ADD CONSTRAINT "StockMovements_ProductId_fkey" FOREIGN KEY ("ProductId") REFERENCES "Products"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovements" ADD CONSTRAINT "StockMovements_WarehouseId_fkey" FOREIGN KEY ("WarehouseId") REFERENCES "Warehouses"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;
