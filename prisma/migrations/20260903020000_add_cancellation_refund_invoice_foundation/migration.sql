-- Additive Phase 4C cancellation, refund, and invoice persistence foundation.
ALTER TABLE `bookings`
    ADD COLUMN `cancelled_at` DATETIME(3) NULL,
    ADD COLUMN `cancellation_reason` VARCHAR(500) NULL;

ALTER TABLE `refunds`
    ADD COLUMN `provider` VARCHAR(100) NULL,
    ADD COLUMN `idempotency_key` VARCHAR(255) NULL,
    ADD COLUMN `failed_at` DATETIME(3) NULL,
    ADD COLUMN `failure_reason` VARCHAR(500) NULL;

CREATE UNIQUE INDEX `refunds_booking_id_idempotency_key_key` ON `refunds`(`booking_id`, `idempotency_key`);
CREATE UNIQUE INDEX `invoices_booking_id_key` ON `invoices`(`booking_id`);

CREATE TABLE `refund_webhook_events` (
    `id` VARCHAR(36) NOT NULL,
    `provider` VARCHAR(100) NOT NULL,
    `provider_event_id` VARCHAR(150) NOT NULL,
    `event_type` VARCHAR(100) NOT NULL,
    `refund_id` VARCHAR(36) NULL,
    `payload_hash` VARCHAR(64) NULL,
    `processed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `refund_webhook_events_provider_provider_event_id_key`(`provider`, `provider_event_id`),
    INDEX `refund_webhook_events_refund_id_idx`(`refund_id`),
    INDEX `refund_webhook_events_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `refund_webhook_events`
    ADD CONSTRAINT `refund_webhook_events_refund_id_fkey`
    FOREIGN KEY (`refund_id`) REFERENCES `refunds`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
