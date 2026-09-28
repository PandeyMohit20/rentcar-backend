-- M10: Phase C settlement-generation safety foundation.
ALTER TABLE `vendor_settlements`
    ADD COLUMN `idempotency_key_hash` VARCHAR(64) NULL,
    ADD COLUMN `request_hash` VARCHAR(64) NULL,
    ADD COLUMN `requires_financial_review` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `financial_review_reason` VARCHAR(500) NULL,
    ADD UNIQUE INDEX `vendor_settlements_vendor_id_idempotency_key_hash_key`
        (`vendor_id`, `idempotency_key_hash`);
