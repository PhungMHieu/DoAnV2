-- Migration: Add proof columns to group_expense_shares
-- Date: 2024-01-08
-- Description: Add columns for payment proof image upload feature

-- =====================================================
-- STEP 1: Add proof columns to group_expense_shares
-- =====================================================

ALTER TABLE "group_expense_shares"
ADD COLUMN IF NOT EXISTS "proofImageUrl" varchar NULL;

ALTER TABLE "group_expense_shares"
ADD COLUMN IF NOT EXISTS "proofStatus" varchar DEFAULT 'none';

ALTER TABLE "group_expense_shares"
ADD COLUMN IF NOT EXISTS "proofUploadedAt" timestamptz NULL;

-- =====================================================
-- VERIFICATION: Check the migration result
-- =====================================================
-- Run these queries to verify:
-- \d group_expense_shares
-- SELECT id, "proofStatus", "proofImageUrl" FROM group_expense_shares LIMIT 5;
