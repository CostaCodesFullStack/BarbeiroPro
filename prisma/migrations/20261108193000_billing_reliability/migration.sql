ALTER TABLE "subscriptions"
  ADD COLUMN "checkout_reference" TEXT,
  ADD COLUMN "checkout_status" TEXT,
  ADD COLUMN "checkout_first_charge_date" VARCHAR(10);

CREATE UNIQUE INDEX "subscriptions_checkout_reference_key"
  ON "subscriptions"("checkout_reference");
