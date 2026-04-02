ALTER TABLE "proxy_groups"
ADD COLUMN "bandwidth_rx_bytes" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN "bandwidth_tx_bytes" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN "bandwidth_reset_at" TIMESTAMP(6);
