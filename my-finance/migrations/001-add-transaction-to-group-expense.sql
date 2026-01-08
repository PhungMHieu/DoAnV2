-- Migration: Add Transaction to GroupExpense relationship
-- Date: 2024-01-08
-- Description:
--   1. Add groupExpenseId column to transactions table
--   2. Migrate existing group_expenses data to transactions
--   3. Remove amount and category columns from group_expenses

-- =====================================================
-- STEP 1: Add groupExpenseId column to transactions
-- =====================================================
ALTER TABLE "transactions"
ADD COLUMN IF NOT EXISTS "groupExpenseId" uuid NULL;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS "IDX_transactions_groupExpenseId"
ON "transactions" ("groupExpenseId");

-- Add foreign key constraint
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'FK_transactions_groupExpenseId'
    ) THEN
        ALTER TABLE "transactions"
        ADD CONSTRAINT "FK_transactions_groupExpenseId"
        FOREIGN KEY ("groupExpenseId")
        REFERENCES "group_expenses"("id")
        ON DELETE SET NULL;
    END IF;
END $$;

-- =====================================================
-- STEP 2: Migrate existing data from group_expenses to transactions
-- =====================================================
-- Create a transaction record for each existing group_expense
INSERT INTO "transactions" ("id", "amount", "category", "note", "user_id", "date_time", "groupExpenseId")
SELECT
    gen_random_uuid(),
    ge.amount::decimal,
    COALESCE(ge.category, 'Group Expense'),
    ge.title,
    ge."createdByUserId",
    ge."createdAt",
    ge.id
FROM "group_expenses" ge
WHERE ge.amount IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "transactions" t WHERE t."groupExpenseId" = ge.id
  );

-- =====================================================
-- STEP 3: Remove old columns from group_expenses
-- =====================================================
ALTER TABLE "group_expenses"
DROP COLUMN IF EXISTS "amount";

ALTER TABLE "group_expenses"
DROP COLUMN IF EXISTS "category";

-- =====================================================
-- VERIFICATION: Check the migration result
-- =====================================================
-- Run these queries to verify:
-- SELECT COUNT(*) FROM transactions WHERE "groupExpenseId" IS NOT NULL;
-- SELECT id, title, "createdAt" FROM group_expenses LIMIT 5;
-- \d transactions
-- \d group_expenses
