ALTER TABLE `vendors` ADD COLUMN `tax_profile` JSON NULL;
ALTER TABLE `bookings` ADD COLUMN `financial_snapshot` JSON NULL, ADD COLUMN `billing_snapshot` JSON NULL;
ALTER TABLE `invoices` ADD COLUMN `snapshot` JSON NULL;
CREATE TABLE `email_deliveries` (
  `id` VARCHAR(36) NOT NULL,
  `dedupe_key` VARCHAR(64) NOT NULL,
  `booking_id` VARCHAR(36) NOT NULL,
  `event_type` VARCHAR(100) NOT NULL,
  `recipient` VARCHAR(255) NOT NULL,
  `payload` JSON NOT NULL,
  `status` VARCHAR(30) NOT NULL DEFAULT 'pending',
  `attempts` INTEGER NOT NULL DEFAULT 0,
  `next_attempt_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `claimed_at` DATETIME(3) NULL,
  `accepted_at` DATETIME(3) NULL,
  `provider_message_id` VARCHAR(255) NULL,
  `last_error_code` VARCHAR(100) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `email_deliveries_dedupe_key_key` (`dedupe_key`),
  INDEX `email_deliveries_booking_id_idx` (`booking_id`),
  INDEX `email_deliveries_status_next_attempt_at_idx` (`status`, `next_attempt_at`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
