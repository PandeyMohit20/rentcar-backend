-- Additive Razorpay payment identity and durable webhook idempotency foundation.
ALTER TABLE `payments`
    ADD COLUMN `provider_order_id` VARCHAR(100) NULL,
    ADD COLUMN `provider_payment_id` VARCHAR(100) NULL,
    ADD COLUMN `operational_status` ENUM('normal', 'review_required', 'late_payment_conflict') NOT NULL DEFAULT 'normal';

CREATE UNIQUE INDEX `payments_provider_order_id_key` ON `payments`(`provider_order_id`);
CREATE UNIQUE INDEX `payments_provider_payment_id_key` ON `payments`(`provider_payment_id`);

CREATE TABLE `payment_webhook_events` (
    `id` VARCHAR(36) NOT NULL,
    `provider` VARCHAR(100) NOT NULL,
    `provider_event_id` VARCHAR(150) NOT NULL,
    `event_type` VARCHAR(100) NOT NULL,
    `payment_id` VARCHAR(36) NULL,
    `payload_hash` VARCHAR(64) NULL,
    `processed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `payment_webhook_events_provider_provider_event_id_key`(`provider`, `provider_event_id`),
    INDEX `payment_webhook_events_payment_id_idx`(`payment_id`),
    INDEX `payment_webhook_events_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `payment_webhook_events`
    ADD CONSTRAINT `payment_webhook_events_payment_id_fkey`
    FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
