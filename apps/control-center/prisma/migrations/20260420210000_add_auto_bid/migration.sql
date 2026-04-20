-- Auto-bid per monitor
ALTER TABLE "monitors"
  ADD COLUMN "auto_bid_enabled"      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "auto_bid_discount_pct" INTEGER,
  ADD COLUMN "auto_bid_max_price"    NUMERIC(10, 2);

-- Idempotency + audit log (1 row per monitor+item)
CREATE TABLE "auto_bid_logs" (
  "id"         SERIAL PRIMARY KEY,
  "monitor_id" INTEGER NOT NULL REFERENCES "monitors"("id") ON DELETE CASCADE,
  "user_id"    TEXT    NOT NULL,
  "item_id"    BIGINT  NOT NULL,
  "status"     TEXT    NOT NULL,
  "price_eur"  NUMERIC(10, 2),
  "error"      TEXT,
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("monitor_id", "item_id")
);

CREATE INDEX "auto_bid_logs_user_created_idx" ON "auto_bid_logs" ("user_id", "created_at");
