-- CreateTable
CREATE TABLE `vendor_settlement_payout_attempts` (
    `id` VARCHAR(36) NOT NULL,
    `settlement_id` VARCHAR(36) NOT NULL,
    `attempt_number` INTEGER NOT NULL,
    `idempotency_key_hash` VARCHAR(64) NOT NULL,
    `request_hash` VARCHAR(64) NOT NULL,
    `provider` VARCHAR(100) NOT NULL,
    `provider_payout_id` VARCHAR(150) NULL,
    `bank_account_id` VARCHAR(36) NOT NULL,
    `destination_fingerprint` VARCHAR(64) NOT NULL,
    `destination_snapshot` JSON NOT NULL,
    `amount` DECIMAL(14, 2) NOT NULL,
    `currency_code` VARCHAR(3) NOT NULL,
    `status` ENUM('prepared', 'dispatching', 'unknown', 'pending', 'succeeded', 'failed') NOT NULL DEFAULT 'prepared',
    `initiated_by` VARCHAR(36) NOT NULL,
    `initiated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `submitted_at` DATETIME(3) NULL,
    `paid_at` DATETIME(3) NULL,
    `failed_at` DATETIME(3) NULL,
    `failure_code` VARCHAR(100) NULL,
    `last_reconciled_at` DATETIME(3) NULL,
    `provider_status` VARCHAR(100) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `payout_attempt_settlement_status_idx`(`settlement_id`, `status`),
    INDEX `payout_attempt_provider_status_idx`(`provider`, `status`),
    INDEX `payout_attempt_reconciliation_idx`(`status`, `last_reconciled_at`),
    INDEX `payout_attempt_bank_idx`(`bank_account_id`),
    INDEX `payout_attempt_initiator_idx`(`initiated_by`),
    UNIQUE INDEX `payout_attempt_settlement_number_key`(`settlement_id`, `attempt_number`),
    UNIQUE INDEX `payout_attempt_settlement_idempotency_key`(`settlement_id`, `idempotency_key_hash`),
    UNIQUE INDEX `payout_attempt_provider_reference_key`(`provider`, `provider_payout_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `vendor_settlement_payout_attempts` ADD CONSTRAINT `vendor_settlement_payout_attempts_settlement_id_fkey` FOREIGN KEY (`settlement_id`) REFERENCES `vendor_settlements`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vendor_settlement_payout_attempts` ADD CONSTRAINT `vendor_settlement_payout_attempts_bank_account_id_fkey` FOREIGN KEY (`bank_account_id`) REFERENCES `vendor_bank_accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vendor_settlement_payout_attempts` ADD CONSTRAINT `vendor_settlement_payout_attempts_initiated_by_fkey` FOREIGN KEY (`initiated_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

