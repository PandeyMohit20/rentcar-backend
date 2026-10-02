-- CreateTable
CREATE TABLE `vehicle_transfers` (
    `id` VARCHAR(36) NOT NULL,
    `car_id` VARCHAR(36) NOT NULL,
    `from_branch_id` VARCHAR(36) NOT NULL,
    `to_branch_id` VARCHAR(36) NOT NULL,
    `transfer_date` DATE NOT NULL,
    `reason` VARCHAR(255) NULL,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `vehicle_transfers_car_id_idx`(`car_id`),
    INDEX `vehicle_transfers_from_branch_id_idx`(`from_branch_id`),
    INDEX `vehicle_transfers_to_branch_id_idx`(`to_branch_id`),
    INDEX `vehicle_transfers_transfer_date_idx`(`transfer_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `vehicle_transfers` ADD CONSTRAINT `vehicle_transfers_car_id_fkey` FOREIGN KEY (`car_id`) REFERENCES `cars`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vehicle_transfers` ADD CONSTRAINT `vehicle_transfers_from_branch_id_fkey` FOREIGN KEY (`from_branch_id`) REFERENCES `branches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vehicle_transfers` ADD CONSTRAINT `vehicle_transfers_to_branch_id_fkey` FOREIGN KEY (`to_branch_id`) REFERENCES `branches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

