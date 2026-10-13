/*
  Warnings:

  - A unique constraint covering the columns `[ChequeId]` on the table `CreditPayments` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[ChequeId]` on the table `SalePayments` will be added. If there are existing duplicate values, this will fail.
  - Changed the type of `Method` on the `CreditPayments` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "CreditPaymentMethod" AS ENUM ('CASH', 'CHEQUE');

-- AlterEnum
ALTER TYPE "CustomerLedgerType" ADD VALUE 'CHEQUE_VOIDED';

-- AlterEnum
ALTER TYPE "SalePaymentMethod" ADD VALUE 'CHEQUE';

-- AlterTable
ALTER TABLE "CreditPayments" ADD COLUMN     "ChequeId" UUID,
ADD COLUMN     "ReversalReason" TEXT,
ADD COLUMN     "ReversedAt" TIMESTAMPTZ(6),
ADD COLUMN     "ReversedByUserId" UUID,
DROP COLUMN "Method",
ADD COLUMN     "Method" "CreditPaymentMethod" NOT NULL;

-- AlterTable
ALTER TABLE "SalePayments" ADD COLUMN     "ChequeId" UUID,
ADD COLUMN     "ReversalReason" TEXT,
ADD COLUMN     "ReversedAt" TIMESTAMPTZ(6),
ADD COLUMN     "ReversedByUserId" UUID;

-- AlterTable
ALTER TABLE "Sales" ADD COLUMN     "ChequeAmount" DECIMAL(18,4) NOT NULL DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "CreditPayments_ChequeId_key" ON "CreditPayments"("ChequeId");

-- CreateIndex
CREATE INDEX "CreditPayments_Method_idx" ON "CreditPayments"("Method");

-- CreateIndex
CREATE INDEX "CreditPayments_ReversedAt_idx" ON "CreditPayments"("ReversedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SalePayments_ChequeId_key" ON "SalePayments"("ChequeId");

-- CreateIndex
CREATE INDEX "SalePayments_ReversedAt_idx" ON "SalePayments"("ReversedAt");

-- CreateIndex
CREATE INDEX "Sales_ChequeAmount_idx" ON "Sales"("ChequeAmount");

-- AddForeignKey
ALTER TABLE "SalePayments" ADD CONSTRAINT "SalePayments_ChequeId_fkey" FOREIGN KEY ("ChequeId") REFERENCES "CustomerCheques"("Id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditPayments" ADD CONSTRAINT "CreditPayments_ChequeId_fkey" FOREIGN KEY ("ChequeId") REFERENCES "CustomerCheques"("Id") ON DELETE SET NULL ON UPDATE CASCADE;
