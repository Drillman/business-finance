-- Migration: Change TVA payments from period_start/period_end to period_month
-- This migration converts the date range to a single month (YYYY-MM format)

-- Step 1: Add the new period_month column
ALTER TABLE tax_payments
ADD COLUMN IF NOT EXISTS period_month VARCHAR(7);

-- Step 2: Populate period_month from period_start (extracting YYYY-MM)
UPDATE tax_payments
SET period_month = TO_CHAR(period_start, 'YYYY-MM')
WHERE period_month IS NULL;

-- Step 3: Make period_month NOT NULL
ALTER TABLE tax_payments
ALTER COLUMN period_month SET NOT NULL;

-- Step 4: Drop the old columns
ALTER TABLE tax_payments
DROP COLUMN IF EXISTS period_start,
DROP COLUMN IF EXISTS period_end;
