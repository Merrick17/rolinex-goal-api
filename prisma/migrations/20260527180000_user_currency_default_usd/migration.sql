-- Default new users to USD (SentinelGate / product default)
ALTER TABLE "users" ALTER COLUMN "currency" SET DEFAULT 'USD';

-- Align existing accounts that still use the old default
UPDATE "users" SET "currency" = 'USD' WHERE "currency" = 'AED';
