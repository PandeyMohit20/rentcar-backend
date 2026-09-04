-- Additive Phase 5A2 customer and vendor KYC persistence foundation.
ALTER TABLE `profiles` ADD COLUMN `rejection_reason` VARCHAR(500) NULL,
    ADD COLUMN `submitted_at` DATETIME(3) NULL,
    ADD COLUMN `verified_at` DATETIME(3) NULL,
    ADD COLUMN `verified_by` VARCHAR(36) NULL;

ALTER TABLE `vendor_documents` ADD COLUMN `rejection_reason` VARCHAR(500) NULL,
    ADD COLUMN `verified_at` DATETIME(3) NULL,
    ADD COLUMN `verified_by` VARCHAR(36) NULL;

ALTER TABLE `vendors` ADD COLUMN `rejection_reason` VARCHAR(500) NULL,
    ADD COLUMN `submitted_at` DATETIME(3) NULL,
    ADD COLUMN `verified_at` DATETIME(3) NULL,
    ADD COLUMN `verified_by` VARCHAR(36) NULL;

CREATE TABLE `vendor_members` (
    `id` VARCHAR(36) NOT NULL,
    `vendor_id` VARCHAR(36) NOT NULL,
    `user_id` VARCHAR(36) NOT NULL,
    `is_owner` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `vendor_members_user_id_idx`(`user_id`),
    INDEX `vendor_members_vendor_id_is_owner_idx`(`vendor_id`, `is_owner`),
    UNIQUE INDEX `vendor_members_vendor_id_user_id_key`(`vendor_id`, `user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `user_documents` (
    `id` VARCHAR(36) NOT NULL,
    `user_id` VARCHAR(36) NOT NULL,
    `document_type` ENUM('driving_license', 'pan', 'identity_proof', 'address_proof') NOT NULL,
    `storage_key` VARCHAR(500) NOT NULL,
    `status` ENUM('pending', 'verified', 'rejected', 'expired') NOT NULL DEFAULT 'pending',
    `issued_at` DATETIME(3) NULL,
    `expires_at` DATETIME(3) NULL,
    `remarks` VARCHAR(500) NULL,
    `verified_at` DATETIME(3) NULL,
    `verified_by` VARCHAR(36) NULL,
    `rejection_reason` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `user_documents_user_id_status_idx`(`user_id`, `status`),
    INDEX `user_documents_user_id_document_type_idx`(`user_id`, `document_type`),
    INDEX `user_documents_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `profiles` ADD CONSTRAINT `profiles_verified_by_fkey` FOREIGN KEY (`verified_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `vendors` ADD CONSTRAINT `vendors_verified_by_fkey` FOREIGN KEY (`verified_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `vendor_documents` ADD CONSTRAINT `vendor_documents_verified_by_fkey` FOREIGN KEY (`verified_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `vendor_members` ADD CONSTRAINT `vendor_members_vendor_id_fkey` FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `vendor_members` ADD CONSTRAINT `vendor_members_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `user_documents` ADD CONSTRAINT `user_documents_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `user_documents` ADD CONSTRAINT `user_documents_verified_by_fkey` FOREIGN KEY (`verified_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
