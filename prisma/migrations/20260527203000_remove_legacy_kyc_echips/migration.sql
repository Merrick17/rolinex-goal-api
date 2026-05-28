-- Remove legacy KYC / eChips artifacts (game-only schema)

-- 1. KYC submissions (depends on KycSubmissionStatus)
DROP TABLE IF EXISTS "kyc_submissions";

DROP TYPE IF EXISTS "KycSubmissionStatus";

-- 2. User columns + KycStatus enum
ALTER TABLE "users" DROP COLUMN IF EXISTS "token_balance";
ALTER TABLE "users" DROP COLUMN IF EXISTS "kyc_status";

DROP TYPE IF EXISTS "KycStatus";

-- 3. Any token_deposit ledger rows → treat as deposit for history
UPDATE "transactions" SET "type" = 'deposit'::"TransactionType" WHERE "type"::text = 'token_deposit';

-- 4. Bet wallet source column + enum
ALTER TABLE "bets" DROP COLUMN IF EXISTS "wallet_source";

DROP TYPE IF EXISTS "BetWalletSource";

-- 5. TransactionType: rebuild enum without token_deposit
ALTER TYPE "TransactionType" RENAME TO "TransactionType_old";

CREATE TYPE "TransactionType" AS ENUM (
  'deposit',
  'withdraw',
  'bet',
  'win',
  'admin_credit',
  'admin_debit'
);

ALTER TABLE "transactions" ALTER COLUMN "type" DROP DEFAULT;

ALTER TABLE "transactions"
  ALTER COLUMN "type" TYPE "TransactionType"
  USING ("type"::text::"TransactionType");

DROP TYPE "TransactionType_old";
