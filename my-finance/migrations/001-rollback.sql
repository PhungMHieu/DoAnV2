-- Rollback Migration: Revert Transaction to GroupExpense changes
-- Date: 2024-01-08
-- WARNING: This will restore the old schema structure

-- =====================================================
-- STEP 1: Add back amount and category columns to group_expenses
-- =====================================================
ALTER TABLE "group_expenses"
ADD COLUMN IF NOT EXISTS "amount" numeric(18,2);

ALTER TABLE "group_expenses"
ADD COLUMN IF NOT EXISTS "category" varchar;

-- =====================================================
-- STEP 2: Restore data from transactions back to group_expenses
-- =====================================================
UPDATE "group_expenses" ge
SET
    amount = subq.total_amount,
    category = subq.first_category
FROM (
    SELECT
        t."groupExpenseId",
        SUM(t.amount) as total_amount,
        (SELECT t2.category FROM "transactions" t2 WHERE t2."groupExpenseId" = t."groupExpenseId" LIMIT 1) as first_category
    FROM "transactions" t
    WHERE t."groupExpenseId" IS NOT NULL
    GROUP BY t."groupExpenseId"
) subq
WHERE ge.id = subq."groupExpenseId";

-- =====================================================
-- STEP 3: Remove foreign key and column from transactions
-- =====================================================
ALTER TABLE "transactions"
DROP CONSTRAINT IF EXISTS "FK_transactions_groupExpenseId";

DROP INDEX IF EXISTS "IDX_transactions_groupExpenseId";

ALTER TABLE "transactions"
DROP COLUMN IF EXISTS "groupExpenseId";
