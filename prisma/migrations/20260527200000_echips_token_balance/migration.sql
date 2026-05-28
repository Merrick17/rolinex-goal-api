-- eChips (unverified) vs cash (verified / SentinelGate)

CREATE TYPE "BetWalletSource" AS ENUM ('cash', 'tokens');

ALTER TABLE "users" ADD COLUMN "token_balance" DECIMAL(12,2) NOT NULL DEFAULT 0;

ALTER TABLE "bets" ADD COLUMN "wallet_source" "BetWalletSource" NOT NULL DEFAULT 'tokens';

ALTER TYPE "TransactionType" ADD VALUE 'token_deposit';
