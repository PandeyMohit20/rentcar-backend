-- CreateTable
CREATE TABLE `wallet_topups` (
    `id` VARCHAR(36) NOT NULL,
    `user_id` VARCHAR(36) NOT NULL,
    `amount` DECIMAL(14, 2) NOT NULL,
    `currency_code` VARCHAR(3) NOT NULL DEFAULT 'INR',
    `provider` VARCHAR(100) NOT NULL DEFAULT 'razorpay',
    `provider_order_id` VARCHAR(100) NOT NULL,
    `provider_payment_id` VARCHAR(100) NULL,
    `status` VARCHAR(32) NOT NULL DEFAULT 'pending',
    `paid_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `wallet_topups_provider_order_id_key`(`provider_order_id`),
    UNIQUE INDEX `wallet_topups_provider_payment_id_key`(`provider_payment_id`),
    INDEX `wallet_topups_user_id_idx`(`user_id`),
    INDEX `wallet_topups_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `wallet_topups` ADD CONSTRAINT `wallet_topups_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
