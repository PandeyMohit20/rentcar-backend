CREATE TABLE `vendor_settlements` (
    `id` VARCHAR(36) NOT NULL,
    `settlement_number` VARCHAR(50) NOT NULL,
    `vendor_id` VARCHAR(36) NOT NULL,
    `bank_account_id` VARCHAR(36) NULL,
    `period_start` DATETIME(3) NOT NULL,
    `period_end` DATETIME(3) NOT NULL,
    `gross_collected` DECIMAL(14,2) NOT NULL DEFAULT 0,
    `refund_amount` DECIMAL(14,2) NOT NULL DEFAULT 0,
    `commission_amount` DECIMAL(14,2) NOT NULL DEFAULT 0,
    `security_deposit` DECIMAL(14,2) NOT NULL DEFAULT 0,
    `adjustment_amount` DECIMAL(14,2) NOT NULL DEFAULT 0,
    `net_payable` DECIMAL(14,2) NOT NULL DEFAULT 0,
    `currency_code` VARCHAR(3) NOT NULL DEFAULT 'INR',
    `status` ENUM(
        'pending',
        'processing',
        'paid',
        'failed',
        'reversed'
    ) NOT NULL DEFAULT 'pending',
    `payout_reference` VARCHAR(150) NULL,
    `processed_at` DATETIME(3) NULL,
    `failed_at` DATETIME(3) NULL,
    `failure_reason` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `vendor_settlements_settlement_number_key`
        (`settlement_number`),

    UNIQUE INDEX `vendor_settlements_payout_reference_key`
        (`payout_reference`),

    INDEX `vendor_settlements_vendor_id_idx`
        (`vendor_id`),

    INDEX `vendor_settlements_vendor_id_status_idx`
        (`vendor_id`, `status`),

    INDEX `vendor_settlements_period_start_period_end_idx`
        (`period_start`, `period_end`),

    INDEX `vendor_settlements_bank_account_id_idx`
        (`bank_account_id`),

    INDEX `vendor_settlements_created_at_idx`
        (`created_at`),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;


CREATE TABLE `vendor_settlement_items` (
    `id` VARCHAR(36) NOT NULL,
    `settlement_id` VARCHAR(36) NOT NULL,
    `booking_id` VARCHAR(36) NOT NULL,
    `payment_id` VARCHAR(36) NOT NULL,
    `gross_amount` DECIMAL(14,2) NOT NULL DEFAULT 0,
    `refund_amount` DECIMAL(14,2) NOT NULL DEFAULT 0,
    `commission_amount` DECIMAL(14,2) NOT NULL DEFAULT 0,
    `security_deposit` DECIMAL(14,2) NOT NULL DEFAULT 0,
    `net_amount` DECIMAL(14,2) NOT NULL DEFAULT 0,
    `currency_code` VARCHAR(3) NOT NULL DEFAULT 'INR',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `vendor_settlement_items_booking_id_payment_id_key`
        (`booking_id`, `payment_id`),

    INDEX `vendor_settlement_items_settlement_id_idx`
        (`settlement_id`),

    INDEX `vendor_settlement_items_booking_id_idx`
        (`booking_id`),

    INDEX `vendor_settlement_items_payment_id_idx`
        (`payment_id`),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;


ALTER TABLE `vendor_settlements`
    ADD CONSTRAINT `vendor_settlements_vendor_id_fkey`
    FOREIGN KEY (`vendor_id`)
    REFERENCES `vendors`(`id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;


ALTER TABLE `vendor_settlements`
    ADD CONSTRAINT `vendor_settlements_bank_account_id_fkey`
    FOREIGN KEY (`bank_account_id`)
    REFERENCES `vendor_bank_accounts`(`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE;


ALTER TABLE `vendor_settlement_items`
    ADD CONSTRAINT `vendor_settlement_items_settlement_id_fkey`
    FOREIGN KEY (`settlement_id`)
    REFERENCES `vendor_settlements`(`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE;


ALTER TABLE `vendor_settlement_items`
    ADD CONSTRAINT `vendor_settlement_items_booking_id_fkey`
    FOREIGN KEY (`booking_id`)
    REFERENCES `bookings`(`id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;


ALTER TABLE `vendor_settlement_items`
    ADD CONSTRAINT `vendor_settlement_items_payment_id_fkey`
    FOREIGN KEY (`payment_id`)
    REFERENCES `payments`(`id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;