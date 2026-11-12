ALTER TABLE "subscriptions"
  ADD COLUMN "access_ends_at" TIMESTAMP(3),
  ADD COLUMN "cancellation_confirmed" BOOLEAN NOT NULL DEFAULT false;
