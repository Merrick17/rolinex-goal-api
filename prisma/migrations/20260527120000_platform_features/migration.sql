-- AlterTable
ALTER TABLE "users" ADD COLUMN "account_frozen" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "rounds" ADD COLUMN "server_seed" TEXT;

-- CreateEnum
CREATE TYPE "TransactionTxStatus" AS ENUM ('pending', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "KycSubmissionStatus" AS ENUM ('pending', 'approved', 'rejected');

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN "tx_status" "TransactionTxStatus" NOT NULL DEFAULT 'completed';

-- AlterEnum
ALTER TYPE "TransactionType" ADD VALUE 'admin_credit';
ALTER TYPE "TransactionType" ADD VALUE 'admin_debit';

-- CreateTable
CREATE TABLE "webhook_deliveries" (
    "id" TEXT NOT NULL,
    "event_key" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_deliveries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "webhook_deliveries_event_key_key" ON "webhook_deliveries"("event_key");

-- CreateTable
CREATE TABLE "kyc_submissions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "document_urls" JSONB NOT NULL,
    "status" "KycSubmissionStatus" NOT NULL DEFAULT 'pending',
    "reviewer_note" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMP(3),

    CONSTRAINT "kyc_submissions_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "kyc_submissions" ADD CONSTRAINT "kyc_submissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
