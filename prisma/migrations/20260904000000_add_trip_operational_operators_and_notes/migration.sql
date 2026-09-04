-- AlterTable
ALTER TABLE `trip_history`
    ADD COLUMN `started_by` VARCHAR(36) NULL,
    ADD COLUMN `completed_by` VARCHAR(36) NULL,
    ADD COLUMN `pickup_notes` VARCHAR(1000) NULL,
    ADD COLUMN `return_notes` VARCHAR(1000) NULL;

-- AddForeignKey
ALTER TABLE `trip_history` ADD CONSTRAINT `trip_history_started_by_fkey` FOREIGN KEY (`started_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `trip_history` ADD CONSTRAINT `trip_history_completed_by_fkey` FOREIGN KEY (`completed_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
