ALTER TABLE `wallet_transactions`
    ADD COLUMN `idempotency_key_hash` VARCHAR(64) NULL,
    ADD COLUMN `request_hash` VARCHAR(64) NULL;

CREATE UNIQUE INDEX `wallet_transactions_wallet_id_idempotency_key_hash_key`
    ON `wallet_transactions`(`wallet_id`, `idempotency_key_hash`);