-- AlterTable
ALTER TABLE `bookings` ADD COLUMN `hold_expires_at` DATETIME(3) NULL,
    ADD COLUMN `idempotency_hash` VARCHAR(64) NULL,
    ADD COLUMN `idempotency_key` VARCHAR(255) NULL;

-- CreateIndex
CREATE INDEX `bookings_hold_expires_at_idx` ON `bookings`(`hold_expires_at`);

-- CreateIndex
CREATE UNIQUE INDEX `bookings_user_id_idempotency_key_key` ON `bookings`(`user_id`, `idempotency_key`);

