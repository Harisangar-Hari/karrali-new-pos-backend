-- CreateIndex
CREATE INDEX "CashLedgers_Type_CreatedAt_idx" ON "CashLedgers"("Type", "CreatedAt");

-- CreateIndex
CREATE INDEX "CustomerLedgers_CustomerId_CreatedAt_idx" ON "CustomerLedgers"("CustomerId", "CreatedAt");

-- CreateIndex
CREATE INDEX "Expenses_Method_PaidAt_idx" ON "Expenses"("Method", "PaidAt");

-- CreateIndex
CREATE INDEX "Purchases_Status_DueDate_idx" ON "Purchases"("Status", "DueDate");

-- CreateIndex
CREATE INDEX "SalePayments_Method_CreatedAt_idx" ON "SalePayments"("Method", "CreatedAt");

-- CreateIndex
CREATE INDEX "Sales_Status_CreatedAt_idx" ON "Sales"("Status", "CreatedAt");

-- CreateIndex
CREATE INDEX "Sales_TerminalId_CreatedAt_idx" ON "Sales"("TerminalId", "CreatedAt");

-- CreateIndex
CREATE INDEX "Sales_CustomerId_CreatedAt_idx" ON "Sales"("CustomerId", "CreatedAt");

-- CreateIndex
CREATE INDEX "StockMovements_ProductId_CreatedAt_idx" ON "StockMovements"("ProductId", "CreatedAt");

-- CreateIndex
CREATE INDEX "StockMovements_Type_CreatedAt_idx" ON "StockMovements"("Type", "CreatedAt");
