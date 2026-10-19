-- CreateEnum
CREATE TYPE "LoyaltyTransactionType" AS ENUM ('EARN', 'REDEEM', 'ADJUST', 'REVERSAL');

-- AlterTable
ALTER TABLE "Customers" ADD COLUMN     "LifetimeEarned" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Sales" ADD COLUMN     "LoyaltyDiscountAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
ADD COLUMN     "LoyaltyEarnedPoints" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "LoyaltyRedeemedPoints" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "LoyaltyReversedPoints" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "LoyaltyTransactions" (
    "Id" UUID NOT NULL,
    "CustomerId" UUID NOT NULL,
    "Type" "LoyaltyTransactionType" NOT NULL,
    "Points" INTEGER NOT NULL,
    "PointsAfter" INTEGER NOT NULL,
    "SaleId" UUID,
    "SaleReturnId" UUID,
    "ReversalOfId" UUID,
    "Notes" TEXT,
    "CreatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedByUserId" UUID,

    CONSTRAINT "LoyaltyTransactions_pkey" PRIMARY KEY ("Id")
);

-- CreateIndex
CREATE INDEX "LoyaltyTransactions_CustomerId_idx" ON "LoyaltyTransactions"("CustomerId");

-- CreateIndex
CREATE INDEX "LoyaltyTransactions_Type_idx" ON "LoyaltyTransactions"("Type");

-- CreateIndex
CREATE INDEX "LoyaltyTransactions_CreatedAt_idx" ON "LoyaltyTransactions"("CreatedAt");

-- CreateIndex
CREATE INDEX "LoyaltyTransactions_SaleId_idx" ON "LoyaltyTransactions"("SaleId");

-- CreateIndex
CREATE INDEX "LoyaltyTransactions_ReversalOfId_idx" ON "LoyaltyTransactions"("ReversalOfId");

-- AddForeignKey
ALTER TABLE "LoyaltyTransactions" ADD CONSTRAINT "LoyaltyTransactions_CustomerId_fkey" FOREIGN KEY ("CustomerId") REFERENCES "Customers"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;
