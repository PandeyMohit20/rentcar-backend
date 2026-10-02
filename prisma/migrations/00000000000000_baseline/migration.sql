-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `phone` VARCHAR(50) NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `status` ENUM('active', 'inactive', 'pending', 'suspended', 'blocked', 'deleted') NOT NULL DEFAULT 'pending',
    `email_verified_at` DATETIME(3) NULL,
    `last_login_at` DATETIME(3) NULL,
    `is_deleted` BOOLEAN NOT NULL DEFAULT false,
    `deleted_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    INDEX `users_phone_idx`(`phone`),
    INDEX `users_status_idx`(`status`),
    INDEX `users_email_verified_at_idx`(`email_verified_at`),
    INDEX `users_deleted_at_idx`(`deleted_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `roles` (
    `id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `description` VARCHAR(500) NULL,
    `is_system` BOOLEAN NOT NULL DEFAULT false,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `status` ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `roles_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `permissions` (
    `id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `description` VARCHAR(500) NULL,
    `module` VARCHAR(100) NOT NULL,
    `action` VARCHAR(100) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `permissions_name_key`(`name`),
    INDEX `permissions_module_idx`(`module`),
    UNIQUE INDEX `permissions_module_action_key`(`module`, `action`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_roles` (
    `id` VARCHAR(36) NOT NULL,
    `user_id` VARCHAR(36) NOT NULL,
    `role_id` VARCHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `user_roles_role_id_idx`(`role_id`),
    UNIQUE INDEX `user_roles_user_id_role_id_key`(`user_id`, `role_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `role_permissions` (
    `id` VARCHAR(36) NOT NULL,
    `role_id` VARCHAR(36) NOT NULL,
    `permission_id` VARCHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `role_permissions_permission_id_idx`(`permission_id`),
    UNIQUE INDEX `role_permissions_role_id_permission_id_key`(`role_id`, `permission_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `refresh_tokens` (
    `id` VARCHAR(36) NOT NULL,
    `user_id` VARCHAR(36) NOT NULL,
    `token_hash` VARCHAR(255) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `revoked_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `refresh_tokens_token_hash_key`(`token_hash`),
    INDEX `refresh_tokens_user_id_idx`(`user_id`),
    INDEX `refresh_tokens_expires_at_idx`(`expires_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sessions` (
    `id` VARCHAR(36) NOT NULL,
    `user_id` VARCHAR(36) NOT NULL,
    `session_token_hash` VARCHAR(255) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `last_active_at` DATETIME(3) NOT NULL,
    `ip_address` VARCHAR(45) NULL,
    `user_agent` VARCHAR(500) NULL,
    `device_source` ENUM('mobile', 'web', 'admin', 'system') NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `revoked_at` DATETIME(3) NULL,

    UNIQUE INDEX `sessions_session_token_hash_key`(`session_token_hash`),
    INDEX `sessions_user_id_idx`(`user_id`),
    INDEX `sessions_expires_at_idx`(`expires_at`),
    INDEX `sessions_last_active_at_idx`(`last_active_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `otp` (
    `id` VARCHAR(36) NOT NULL,
    `user_id` VARCHAR(36) NOT NULL,
    `purpose` ENUM('registration', 'login', 'password_reset', 'email_verification', 'phone_verification', 'delete_account') NOT NULL DEFAULT 'registration',
    `code_hash` VARCHAR(255) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `verified_at` DATETIME(3) NULL,
    `attempt_count` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `otp_user_id_purpose_idx`(`user_id`, `purpose`),
    INDEX `otp_expires_at_idx`(`expires_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `profiles` (
    `id` VARCHAR(36) NOT NULL,
    `user_id` VARCHAR(36) NOT NULL,
    `date_of_birth` DATE NULL,
    `gender` ENUM('male', 'female', 'other', 'undisclosed') NULL,
    `profile_image` VARCHAR(500) NULL,
    `verification_status` ENUM('unverified', 'pending', 'verified', 'rejected') NOT NULL DEFAULT 'unverified',
    `bio` VARCHAR(1000) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `profiles_user_id_key`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `addresses` (
    `id` VARCHAR(36) NOT NULL,
    `user_id` VARCHAR(36) NOT NULL,
    `address_line1` VARCHAR(255) NOT NULL,
    `address_line2` VARCHAR(255) NULL,
    `city` VARCHAR(100) NOT NULL,
    `state` VARCHAR(100) NULL,
    `country` VARCHAR(2) NOT NULL DEFAULT 'IN',
    `postal_code` VARCHAR(20) NULL,
    `latitude` DECIMAL(10, 7) NULL,
    `longitude` DECIMAL(10, 7) NULL,
    `address_type` VARCHAR(50) NOT NULL DEFAULT 'home',
    `is_default` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `addresses_user_id_idx`(`user_id`),
    INDEX `addresses_city_idx`(`city`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `vendors` (
    `id` VARCHAR(36) NOT NULL,
    `vendor_code` VARCHAR(50) NOT NULL,
    `company_name` VARCHAR(255) NOT NULL,
    `legal_name` VARCHAR(255) NULL,
    `email` VARCHAR(255) NULL,
    `phone` VARCHAR(50) NULL,
    `website` VARCHAR(255) NULL,
    `tax_id` VARCHAR(100) NULL,
    `gstin` VARCHAR(100) NULL,
    `verification_status` ENUM('unverified', 'pending', 'verified', 'rejected') NOT NULL DEFAULT 'pending',
    `commission_rate` DECIMAL(5, 2) NULL DEFAULT 10,
    `status` ENUM('active', 'inactive', 'pending', 'suspended', 'archived', 'rejected') NOT NULL DEFAULT 'pending',
    `is_deleted` BOOLEAN NOT NULL DEFAULT false,
    `deleted_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `vendors_vendor_code_key`(`vendor_code`),
    INDEX `vendors_status_idx`(`status`),
    INDEX `vendors_verification_status_idx`(`verification_status`),
    INDEX `vendors_is_deleted_idx`(`is_deleted`),
    INDEX `vendors_company_name_idx`(`company_name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `vendor_documents` (
    `id` VARCHAR(36) NOT NULL,
    `vendor_id` VARCHAR(36) NOT NULL,
    `document_type` VARCHAR(100) NOT NULL,
    `document_url` VARCHAR(500) NOT NULL,
    `status` ENUM('pending', 'verified', 'rejected', 'expired') NOT NULL DEFAULT 'pending',
    `issued_at` DATETIME(3) NULL,
    `expires_at` DATETIME(3) NULL,
    `remarks` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `vendor_documents_vendor_id_idx`(`vendor_id`),
    INDEX `vendor_documents_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `vendor_bank_accounts` (
    `id` VARCHAR(36) NOT NULL,
    `vendor_id` VARCHAR(36) NOT NULL,
    `account_holder` VARCHAR(255) NOT NULL,
    `bank_name` VARCHAR(255) NOT NULL,
    `account_number` VARCHAR(100) NOT NULL,
    `ifsc_code` VARCHAR(50) NULL,
    `swift_code` VARCHAR(50) NULL,
    `currency_code` VARCHAR(3) NOT NULL DEFAULT 'INR',
    `is_default` BOOLEAN NOT NULL DEFAULT false,
    `status` ENUM('active', 'inactive', 'pending', 'suspended', 'archived', 'rejected') NOT NULL DEFAULT 'active',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `vendor_bank_accounts_vendor_id_idx`(`vendor_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cities` (
    `id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `state` VARCHAR(100) NULL,
    `country` VARCHAR(2) NOT NULL DEFAULT 'IN',
    `code` VARCHAR(20) NULL,
    `latitude` DECIMAL(10, 7) NULL,
    `longitude` DECIMAL(10, 7) NULL,
    `status` ENUM('active', 'inactive', 'pending', 'suspended', 'archived', 'rejected') NOT NULL DEFAULT 'active',
    `is_deleted` BOOLEAN NOT NULL DEFAULT false,
    `deleted_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `cities_code_key`(`code`),
    INDEX `cities_name_country_idx`(`name`, `country`),
    INDEX `cities_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `locations` (
    `id` VARCHAR(36) NOT NULL,
    `city_id` VARCHAR(36) NOT NULL,
    `vendor_id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `address` VARCHAR(500) NULL,
    `latitude` DECIMAL(10, 7) NULL,
    `longitude` DECIMAL(10, 7) NULL,
    `location_type` VARCHAR(50) NOT NULL DEFAULT 'pickup',
    `status` ENUM('active', 'inactive', 'pending', 'suspended', 'archived', 'rejected') NOT NULL DEFAULT 'active',
    `is_deleted` BOOLEAN NOT NULL DEFAULT false,
    `deleted_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `locations_city_id_idx`(`city_id`),
    INDEX `locations_vendor_id_idx`(`vendor_id`),
    INDEX `locations_status_idx`(`status`),
    INDEX `locations_latitude_longitude_idx`(`latitude`, `longitude`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `branches` (
    `id` VARCHAR(36) NOT NULL,
    `location_id` VARCHAR(36) NOT NULL,
    `vendor_id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `address` VARCHAR(500) NULL,
    `phone` VARCHAR(50) NULL,
    `email` VARCHAR(255) NULL,
    `city` VARCHAR(100) NULL,
    `is_operational` BOOLEAN NOT NULL DEFAULT true,
    `status` ENUM('active', 'inactive', 'pending', 'suspended', 'archived', 'rejected') NOT NULL DEFAULT 'active',
    `is_deleted` BOOLEAN NOT NULL DEFAULT false,
    `deleted_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `branches_location_id_idx`(`location_id`),
    INDEX `branches_vendor_id_idx`(`vendor_id`),
    INDEX `branches_is_operational_idx`(`is_operational`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cars` (
    `id` VARCHAR(36) NOT NULL,
    `vendor_id` VARCHAR(36) NOT NULL,
    `branch_id` VARCHAR(36) NOT NULL,
    `registration_number` VARCHAR(50) NOT NULL,
    `vin` VARCHAR(50) NULL,
    `brand` VARCHAR(100) NOT NULL,
    `model` VARCHAR(100) NOT NULL,
    `variant` VARCHAR(150) NULL,
    `manufacturing_year` INTEGER NOT NULL,
    `fuel_type` ENUM('petrol', 'diesel', 'cng', 'electric', 'hybrid', 'lpg') NULL,
    `transmission` ENUM('automatic', 'manual') NOT NULL DEFAULT 'manual',
    `seating_capacity` INTEGER NOT NULL DEFAULT 4,
    `status` ENUM('available', 'booked', 'busy', 'maintenance', 'inactive', 'retired') NOT NULL DEFAULT 'available',
    `odometer` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `is_deleted` BOOLEAN NOT NULL DEFAULT false,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `cars_registration_number_key`(`registration_number`),
    UNIQUE INDEX `cars_vin_key`(`vin`),
    INDEX `cars_vendor_id_idx`(`vendor_id`),
    INDEX `cars_branch_id_idx`(`branch_id`),
    INDEX `cars_status_idx`(`status`),
    INDEX `cars_brand_model_idx`(`brand`, `model`),
    INDEX `cars_manufacturing_year_idx`(`manufacturing_year`),
    INDEX `cars_is_deleted_idx`(`is_deleted`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `car_images` (
    `id` VARCHAR(36) NOT NULL,
    `car_id` VARCHAR(36) NOT NULL,
    `image_url` VARCHAR(500) NOT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `is_primary` BOOLEAN NOT NULL DEFAULT false,
    `alt_text` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `car_images_car_id_idx`(`car_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `car_features` (
    `id` VARCHAR(36) NOT NULL,
    `car_id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `icon_key` VARCHAR(100) NULL,

    INDEX `car_features_car_id_idx`(`car_id`),
    UNIQUE INDEX `car_features_car_id_name_key`(`car_id`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `car_pricing` (
    `id` VARCHAR(36) NOT NULL,
    `car_id` VARCHAR(36) NOT NULL,
    `hourly_price` DECIMAL(12, 2) NULL,
    `daily_price` DECIMAL(12, 2) NOT NULL,
    `weekly_price` DECIMAL(12, 2) NULL,
    `monthly_price` DECIMAL(12, 2) NULL,
    `extra_hour_price` DECIMAL(12, 2) NULL,
    `extra_km_price` DECIMAL(12, 2) NULL,
    `security_deposit` DECIMAL(12, 2) NULL,
    `currency_code` VARCHAR(3) NOT NULL DEFAULT 'INR',
    `effective_from` DATETIME(3) NULL,
    `effective_to` DATETIME(3) NULL,
    `status` ENUM('active', 'inactive', 'pending', 'suspended', 'archived', 'rejected') NOT NULL DEFAULT 'active',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `car_pricing_car_id_status_idx`(`car_id`, `status`),
    INDEX `car_pricing_effective_from_effective_to_idx`(`effective_from`, `effective_to`),
    INDEX `car_pricing_currency_code_idx`(`currency_code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `car_availability` (
    `id` VARCHAR(36) NOT NULL,
    `car_id` VARCHAR(36) NOT NULL,
    `date` DATE NOT NULL,
    `start_time` DATETIME(3) NULL,
    `end_time` DATETIME(3) NULL,
    `status` ENUM('available', 'unavailable', 'maintenance', 'blocked') NOT NULL DEFAULT 'available',
    `reason` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `car_availability_car_id_idx`(`car_id`),
    INDEX `car_availability_date_idx`(`date`),
    INDEX `car_availability_status_idx`(`status`),
    INDEX `car_availability_date_status_idx`(`date`, `status`),
    UNIQUE INDEX `car_availability_car_id_date_key`(`car_id`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `car_documents` (
    `id` VARCHAR(36) NOT NULL,
    `car_id` VARCHAR(36) NOT NULL,
    `document_type` VARCHAR(100) NOT NULL,
    `document_url` VARCHAR(500) NOT NULL,
    `issue_date` DATE NULL,
    `expiry_date` DATE NULL,
    `verification_status` ENUM('unverified', 'pending', 'verified', 'rejected') NOT NULL DEFAULT 'pending',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `car_documents_car_id_idx`(`car_id`),
    INDEX `car_documents_document_type_idx`(`document_type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `car_insurance` (
    `id` VARCHAR(36) NOT NULL,
    `car_id` VARCHAR(36) NOT NULL,
    `provider` VARCHAR(255) NOT NULL,
    `policy_number` VARCHAR(150) NOT NULL,
    `coverage_type` VARCHAR(100) NULL,
    `start_date` DATE NULL,
    `expiry_date` DATE NULL,
    `document_url` VARCHAR(500) NULL,
    `status` ENUM('pending', 'verified', 'rejected', 'expired') NOT NULL DEFAULT 'pending',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `car_insurance_car_id_idx`(`car_id`),
    INDEX `car_insurance_expiry_date_idx`(`expiry_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `maintenance` (
    `id` VARCHAR(36) NOT NULL,
    `car_id` VARCHAR(36) NOT NULL,
    `maintenance_type` VARCHAR(100) NOT NULL,
    `description` VARCHAR(500) NULL,
    `scheduled_at` DATETIME(3) NULL,
    `started_at` DATETIME(3) NULL,
    `completed_at` DATETIME(3) NULL,
    `cost` DECIMAL(12, 2) NULL,
    `currency_code` VARCHAR(3) NOT NULL DEFAULT 'INR',
    `odometer` INTEGER NULL,
    `status` ENUM('active', 'inactive', 'pending', 'suspended', 'archived', 'rejected') NOT NULL DEFAULT 'pending',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `maintenance_car_id_idx`(`car_id`),
    INDEX `maintenance_status_idx`(`status`),
    INDEX `maintenance_scheduled_at_idx`(`scheduled_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `fuel_logs` (
    `id` VARCHAR(36) NOT NULL,
    `car_id` VARCHAR(36) NOT NULL,
    `fuel_type` ENUM('petrol', 'diesel', 'cng', 'electric', 'hybrid', 'lpg') NOT NULL,
    `quantity` DECIMAL(8, 2) NOT NULL,
    `cost` DECIMAL(12, 2) NOT NULL,
    `currency_code` VARCHAR(3) NOT NULL DEFAULT 'INR',
    `odometer` INTEGER NOT NULL,
    `recorded_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_by` VARCHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `fuel_logs_car_id_idx`(`car_id`),
    INDEX `fuel_logs_recorded_at_idx`(`recorded_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `gps_devices` (
    `id` VARCHAR(36) NOT NULL,
    `car_id` VARCHAR(36) NOT NULL,
    `device_id` VARCHAR(100) NOT NULL,
    `provider` VARCHAR(100) NOT NULL,
    `status` ENUM('active', 'inactive', 'pending', 'suspended', 'archived', 'rejected') NOT NULL DEFAULT 'active',
    `last_latitude` DECIMAL(10, 7) NULL,
    `last_longitude` DECIMAL(10, 7) NULL,
    `last_seen_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `gps_devices_device_id_key`(`device_id`),
    INDEX `gps_devices_car_id_idx`(`car_id`),
    INDEX `gps_devices_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bookings` (
    `id` VARCHAR(36) NOT NULL,
    `booking_number` VARCHAR(50) NOT NULL,
    `user_id` VARCHAR(36) NOT NULL,
    `vendor_id` VARCHAR(36) NOT NULL,
    `car_id` VARCHAR(36) NOT NULL,
    `pickup_location_id` VARCHAR(36) NULL,
    `dropoff_location_id` VARCHAR(36) NULL,
    `start_at` DATETIME(3) NOT NULL,
    `end_at` DATETIME(3) NOT NULL,
    `subtotal` DECIMAL(12, 2) NOT NULL,
    `tax` DECIMAL(12, 2) NULL DEFAULT 0,
    `discount` DECIMAL(12, 2) NULL DEFAULT 0,
    `security_deposit` DECIMAL(12, 2) NULL DEFAULT 0,
    `total_amount` DECIMAL(12, 2) NOT NULL,
    `currency_code` VARCHAR(3) NOT NULL DEFAULT 'INR',
    `status` ENUM('PENDING', 'CONFIRMED', 'PAYMENT_PENDING', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'EXPIRED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `payment_status` ENUM('pending', 'processing', 'succeeded', 'failed', 'cancelled', 'refunded') NOT NULL DEFAULT 'pending',
    `vendor_commision` DECIMAL(12, 2) NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `bookings_booking_number_key`(`booking_number`),
    INDEX `bookings_user_id_idx`(`user_id`),
    INDEX `bookings_car_id_idx`(`car_id`),
    INDEX `bookings_vendor_id_idx`(`vendor_id`),
    INDEX `bookings_status_idx`(`status`),
    INDEX `bookings_payment_status_idx`(`payment_status`),
    INDEX `bookings_start_at_idx`(`start_at`),
    INDEX `bookings_end_at_idx`(`end_at`),
    INDEX `bookings_pickup_location_id_idx`(`pickup_location_id`),
    INDEX `bookings_dropoff_location_id_idx`(`dropoff_location_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `booking_items` (
    `id` VARCHAR(36) NOT NULL,
    `booking_id` VARCHAR(36) NOT NULL,
    `car_id` VARCHAR(36) NOT NULL,
    `item_type` VARCHAR(50) NOT NULL DEFAULT 'car',
    `quantity` INTEGER NOT NULL DEFAULT 1,
    `unit_price` DECIMAL(12, 2) NOT NULL,
    `currency_code` VARCHAR(3) NOT NULL DEFAULT 'INR',
    `subtotal` DECIMAL(12, 2) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `booking_items_booking_id_idx`(`booking_id`),
    INDEX `booking_items_car_id_idx`(`car_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `booking_status_history` (
    `id` VARCHAR(36) NOT NULL,
    `booking_id` VARCHAR(36) NOT NULL,
    `from_status` ENUM('PENDING', 'CONFIRMED', 'PAYMENT_PENDING', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'EXPIRED', 'REJECTED') NULL,
    `to_status` ENUM('PENDING', 'CONFIRMED', 'PAYMENT_PENDING', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'EXPIRED', 'REJECTED') NOT NULL,
    `changed_by` VARCHAR(36) NULL,
    `reason` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `booking_status_history_booking_id_idx`(`booking_id`),
    INDEX `booking_status_history_to_status_idx`(`to_status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `trip_history` (
    `id` VARCHAR(36) NOT NULL,
    `booking_id` VARCHAR(36) NOT NULL,
    `start_time` DATETIME(3) NULL,
    `end_time` DATETIME(3) NULL,
    `start_odometer` INTEGER NULL,
    `end_odometer` INTEGER NULL,
    `start_fuel` DECIMAL(6, 2) NULL,
    `end_fuel` DECIMAL(6, 2) NULL,
    `distance` DECIMAL(10, 2) NULL,
    `actual_distance` INTEGER NULL,
    `trip_status` ENUM('active', 'inactive', 'pending', 'suspended', 'archived', 'rejected') NOT NULL DEFAULT 'pending',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `trip_history_booking_id_idx`(`booking_id`),
    UNIQUE INDEX `trip_history_booking_id_key`(`booking_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `trip_extensions` (
    `id` VARCHAR(36) NOT NULL,
    `booking_id` VARCHAR(36) NOT NULL,
    `requested_by` VARCHAR(36) NOT NULL,
    `old_end_time` DATETIME(3) NOT NULL,
    `new_end_time` DATETIME(3) NOT NULL,
    `additional_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `currency_code` VARCHAR(3) NOT NULL DEFAULT 'INR',
    `status` ENUM('active', 'inactive', 'pending', 'suspended', 'archived', 'rejected') NOT NULL DEFAULT 'pending',
    `approved_by` VARCHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `trip_extensions_booking_id_idx`(`booking_id`),
    INDEX `trip_extensions_requested_by_idx`(`requested_by`),
    INDEX `trip_extensions_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `trip_photos` (
    `id` VARCHAR(36) NOT NULL,
    `trip_id` VARCHAR(36) NOT NULL,
    `photo_type` VARCHAR(50) NOT NULL,
    `image_url` VARCHAR(500) NOT NULL,
    `captured_at` DATETIME(3) NOT NULL,
    `uploaded_by` VARCHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `trip_photos_trip_id_idx`(`trip_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `trip_damage` (
    `id` VARCHAR(36) NOT NULL,
    `trip_id` VARCHAR(36) NOT NULL,
    `damage_type` VARCHAR(100) NOT NULL,
    `description` VARCHAR(1000) NULL,
    `amount` DECIMAL(12, 2) NULL,
    `currency_code` VARCHAR(3) NOT NULL DEFAULT 'INR',
    `photo_url` VARCHAR(500) NULL,
    `status` ENUM('active', 'inactive', 'pending', 'suspended', 'archived', 'rejected') NOT NULL DEFAULT 'pending',
    `reported_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `trip_damage_trip_id_idx`(`trip_id`),
    INDEX `trip_damage_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payments` (
    `id` VARCHAR(36) NOT NULL,
    `booking_id` VARCHAR(36) NOT NULL,
    `user_id` VARCHAR(36) NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `currency_code` VARCHAR(3) NOT NULL DEFAULT 'INR',
    `payment_method` ENUM('card', 'upi', 'net_banking', 'wallet', 'cash', 'bank_transfer', 'other') NOT NULL DEFAULT 'card',
    `provider` VARCHAR(100) NULL,
    `status` ENUM('pending', 'processing', 'succeeded', 'failed', 'cancelled', 'refunded') NOT NULL DEFAULT 'pending',
    `transaction_reference` VARCHAR(150) NULL,
    `paid_at` DATETIME(3) NULL,
    `failed_at` DATETIME(3) NULL,
    `failure_reason` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `payments_transaction_reference_key`(`transaction_reference`),
    INDEX `payments_booking_id_idx`(`booking_id`),
    INDEX `payments_user_id_idx`(`user_id`),
    INDEX `payments_status_idx`(`status`),
    INDEX `payments_paid_at_idx`(`paid_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `refunds` (
    `id` VARCHAR(36) NOT NULL,
    `payment_id` VARCHAR(36) NOT NULL,
    `booking_id` VARCHAR(36) NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `currency_code` VARCHAR(3) NOT NULL DEFAULT 'INR',
    `reason` VARCHAR(500) NULL,
    `status` ENUM('pending', 'processing', 'succeeded', 'failed', 'cancelled') NOT NULL DEFAULT 'pending',
    `provider_reference` VARCHAR(150) NULL,
    `processed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `refunds_provider_reference_key`(`provider_reference`),
    INDEX `refunds_payment_id_idx`(`payment_id`),
    INDEX `refunds_booking_id_idx`(`booking_id`),
    INDEX `refunds_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `wallets` (
    `id` VARCHAR(36) NOT NULL,
    `user_id` VARCHAR(36) NOT NULL,
    `balance` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `currency_code` VARCHAR(3) NOT NULL DEFAULT 'INR',
    `status` ENUM('active', 'frozen', 'closed') NOT NULL DEFAULT 'active',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `wallets_user_id_key`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `wallet_transactions` (
    `id` VARCHAR(36) NOT NULL,
    `wallet_id` VARCHAR(36) NOT NULL,
    `type` ENUM('credit', 'debit') NOT NULL DEFAULT 'credit',
    `amount` DECIMAL(14, 2) NOT NULL,
    `balance_before` DECIMAL(14, 2) NOT NULL,
    `balance_after` DECIMAL(14, 2) NOT NULL,
    `reference_type` ENUM('booking', 'refund', 'topup', 'payout', 'adjustment', 'commission', 'cancellation') NOT NULL,
    `reference_id` VARCHAR(36) NULL,
    `description` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `wallet_transactions_wallet_id_idx`(`wallet_id`),
    INDEX `wallet_transactions_reference_type_reference_id_idx`(`reference_type`, `reference_id`),
    INDEX `wallet_transactions_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `coupons` (
    `id` VARCHAR(36) NOT NULL,
    `code` VARCHAR(50) NOT NULL,
    `discount_type` ENUM('percentage', 'fixed') NOT NULL DEFAULT 'percentage',
    `discount_value` DECIMAL(12, 2) NOT NULL,
    `minimum_booking_amount` DECIMAL(12, 2) NULL,
    `maximum_discount` DECIMAL(12, 2) NULL,
    `start_date` DATETIME(3) NULL,
    `end_date` DATETIME(3) NULL,
    `usage_limit` INTEGER NULL,
    `per_user_limit` INTEGER NULL DEFAULT 1,
    `status` ENUM('active', 'inactive', 'expired', 'disabled') NOT NULL DEFAULT 'active',
    `is_deleted` BOOLEAN NOT NULL DEFAULT false,
    `deleted_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `coupons_code_key`(`code`),
    INDEX `coupons_status_idx`(`status`),
    INDEX `coupons_start_date_end_date_idx`(`start_date`, `end_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `coupon_usage` (
    `id` VARCHAR(36) NOT NULL,
    `coupon_id` VARCHAR(36) NOT NULL,
    `user_id` VARCHAR(36) NOT NULL,
    `booking_id` VARCHAR(36) NOT NULL,
    `discount_amount` DECIMAL(12, 2) NOT NULL,
    `used_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `coupon_usage_user_id_idx`(`user_id`),
    INDEX `coupon_usage_coupon_id_user_id_idx`(`coupon_id`, `user_id`),
    UNIQUE INDEX `coupon_usage_coupon_id_booking_id_key`(`coupon_id`, `booking_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `invoices` (
    `id` VARCHAR(36) NOT NULL,
    `invoice_number` VARCHAR(50) NOT NULL,
    `booking_id` VARCHAR(36) NULL,
    `user_id` VARCHAR(36) NOT NULL,
    `vendor_id` VARCHAR(36) NULL,
    `subtotal` DECIMAL(12, 2) NOT NULL,
    `tax` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `discount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `total` DECIMAL(12, 2) NOT NULL,
    `currency_code` VARCHAR(3) NOT NULL DEFAULT 'INR',
    `status` ENUM('draft', 'issued', 'paid', 'overdue', 'void', 'cancelled') NOT NULL DEFAULT 'draft',
    `invoice_date` DATETIME(3) NOT NULL,
    `due_date` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `invoices_invoice_number_key`(`invoice_number`),
    INDEX `invoices_booking_id_idx`(`booking_id`),
    INDEX `invoices_user_id_idx`(`user_id`),
    INDEX `invoices_vendor_id_idx`(`vendor_id`),
    INDEX `invoices_status_idx`(`status`),
    INDEX `invoices_invoice_date_idx`(`invoice_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reviews` (
    `id` VARCHAR(36) NOT NULL,
    `user_id` VARCHAR(36) NOT NULL,
    `booking_id` VARCHAR(36) NULL,
    `car_id` VARCHAR(36) NOT NULL,
    `rating` TINYINT NOT NULL,
    `comment` VARCHAR(2000) NULL,
    `status` ENUM('pending', 'approved', 'rejected', 'hidden') NOT NULL DEFAULT 'pending',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `reviews_car_id_idx`(`car_id`),
    INDEX `reviews_status_idx`(`status`),
    UNIQUE INDEX `reviews_booking_id_car_id_key`(`booking_id`, `car_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `rating_summaries` (
    `id` VARCHAR(36) NOT NULL,
    `car_id` VARCHAR(36) NULL,
    `vendor_id` VARCHAR(36) NULL,
    `average` DECIMAL(3, 2) NOT NULL DEFAULT 0,
    `count` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `rating_summaries_car_id_key`(`car_id`),
    UNIQUE INDEX `rating_summaries_vendor_id_key`(`vendor_id`),
    INDEX `rating_summaries_average_idx`(`average`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notifications` (
    `id` VARCHAR(36) NOT NULL,
    `user_id` VARCHAR(36) NOT NULL,
    `type` VARCHAR(100) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `message` TEXT NOT NULL,
    `channel` ENUM('email', 'sms', 'push', 'in_app') NOT NULL DEFAULT 'in_app',
    `status` ENUM('pending', 'sent', 'delivered', 'read', 'failed') NOT NULL DEFAULT 'pending',
    `read_at` DATETIME(3) NULL,
    `sent_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `notifications_user_id_idx`(`user_id`),
    INDEX `notifications_user_id_read_at_idx`(`user_id`, `read_at`),
    INDEX `notifications_created_at_idx`(`created_at`),
    INDEX `notifications_status_created_at_idx`(`status`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `support_tickets` (
    `id` VARCHAR(36) NOT NULL,
    `ticket_number` VARCHAR(50) NOT NULL,
    `user_id` VARCHAR(36) NOT NULL,
    `category` ENUM('booking', 'payment', 'refund', 'support', 'technical', 'other') NOT NULL DEFAULT 'support',
    `priority` ENUM('low', 'medium', 'high', 'urgent') NOT NULL DEFAULT 'medium',
    `subject` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `status` ENUM('open', 'pending', 'resolved', 'closed', 'reopened') NOT NULL DEFAULT 'open',
    `assigned_to` VARCHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `support_tickets_ticket_number_key`(`ticket_number`),
    INDEX `support_tickets_user_id_idx`(`user_id`),
    INDEX `support_tickets_assigned_to_idx`(`assigned_to`),
    INDEX `support_tickets_status_idx`(`status`),
    INDEX `support_tickets_priority_idx`(`priority`),
    INDEX `support_tickets_created_at_idx`(`created_at`),
    INDEX `support_tickets_assigned_to_status_idx`(`assigned_to`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `support_messages` (
    `id` VARCHAR(36) NOT NULL,
    `ticket_id` VARCHAR(36) NOT NULL,
    `sender_id` VARCHAR(36) NOT NULL,
    `message` TEXT NOT NULL,
    `attachment_url` VARCHAR(500) NULL,
    `is_staff` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `support_messages_ticket_id_idx`(`ticket_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `settings` (
    `id` VARCHAR(36) NOT NULL,
    `key` VARCHAR(150) NOT NULL,
    `value` TEXT NOT NULL,
    `type` VARCHAR(50) NOT NULL DEFAULT 'string',
    `group` VARCHAR(100) NULL,
    `is_public` BOOLEAN NOT NULL DEFAULT false,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `settings_key_key`(`key`),
    INDEX `settings_group_idx`(`group`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `activity_logs` (
    `id` VARCHAR(36) NOT NULL,
    `user_id` VARCHAR(36) NULL,
    `action` VARCHAR(100) NOT NULL,
    `module` VARCHAR(100) NOT NULL,
    `entity` VARCHAR(150) NULL,
    `entity_id` VARCHAR(36) NULL,
    `metadata` TEXT NULL,
    `ip_address` VARCHAR(45) NULL,
    `user_agent` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `activity_logs_user_id_idx`(`user_id`),
    INDEX `activity_logs_action_idx`(`action`),
    INDEX `activity_logs_module_idx`(`module`),
    INDEX `activity_logs_created_at_idx`(`created_at`),
    INDEX `activity_logs_entity_entity_id_idx`(`entity`, `entity_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_logs` (
    `id` VARCHAR(36) NOT NULL,
    `user_id` VARCHAR(36) NULL,
    `action` VARCHAR(100) NOT NULL,
    `module` VARCHAR(100) NOT NULL,
    `entity` VARCHAR(150) NULL,
    `entity_id` VARCHAR(36) NULL,
    `result` VARCHAR(50) NULL,
    `metadata` TEXT NULL,
    `request_id` VARCHAR(100) NULL,
    `ip_address` VARCHAR(45) NULL,
    `user_agent` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_logs_user_id_idx`(`user_id`),
    INDEX `audit_logs_action_idx`(`action`),
    INDEX `audit_logs_module_idx`(`module`),
    INDEX `audit_logs_created_at_idx`(`created_at`),
    INDEX `audit_logs_entity_entity_id_idx`(`entity`, `entity_id`),
    INDEX `audit_logs_request_id_idx`(`request_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reports` (
    `id` VARCHAR(36) NOT NULL,
    `report_name` VARCHAR(150) NOT NULL,
    `report_type` VARCHAR(100) NOT NULL,
    `from_date` DATETIME(3) NULL,
    `to_date` DATETIME(3) NULL,
    `status` ENUM('active', 'inactive', 'pending', 'suspended', 'archived', 'rejected') NOT NULL DEFAULT 'pending',
    `status_message` VARCHAR(500) NULL,
    `file_url` VARCHAR(500) NULL,
    `created_by` VARCHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `reports_report_type_from_date_to_date_idx`(`report_type`, `from_date`, `to_date`),
    INDEX `reports_created_by_idx`(`created_by`),
    INDEX `reports_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `daily_metrics` (
    `id` VARCHAR(36) NOT NULL,
    `metric_date` DATE NOT NULL,
    `bookings_count` INTEGER NOT NULL DEFAULT 0,
    `revenue_amount` DECIMAL(16, 2) NOT NULL DEFAULT 0,
    `active_cars` INTEGER NOT NULL DEFAULT 0,
    `total_trips` INTEGER NOT NULL DEFAULT 0,
    `total_distance` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `new_customers` INTEGER NOT NULL DEFAULT 0,
    `utilization_rate` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `daily_metrics_metric_date_key`(`metric_date`),
    INDEX `daily_metrics_metric_date_idx`(`metric_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `user_roles` ADD CONSTRAINT `user_roles_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_roles` ADD CONSTRAINT `user_roles_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `role_permissions` ADD CONSTRAINT `role_permissions_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `role_permissions` ADD CONSTRAINT `role_permissions_permission_id_fkey` FOREIGN KEY (`permission_id`) REFERENCES `permissions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `refresh_tokens` ADD CONSTRAINT `refresh_tokens_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sessions` ADD CONSTRAINT `sessions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `otp` ADD CONSTRAINT `otp_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `profiles` ADD CONSTRAINT `profiles_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `addresses` ADD CONSTRAINT `addresses_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vendor_documents` ADD CONSTRAINT `vendor_documents_vendor_id_fkey` FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vendor_bank_accounts` ADD CONSTRAINT `vendor_bank_accounts_vendor_id_fkey` FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `locations` ADD CONSTRAINT `locations_city_id_fkey` FOREIGN KEY (`city_id`) REFERENCES `cities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `locations` ADD CONSTRAINT `locations_vendor_id_fkey` FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `branches` ADD CONSTRAINT `branches_location_id_fkey` FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `branches` ADD CONSTRAINT `branches_vendor_id_fkey` FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cars` ADD CONSTRAINT `cars_vendor_id_fkey` FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cars` ADD CONSTRAINT `cars_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `car_images` ADD CONSTRAINT `car_images_car_id_fkey` FOREIGN KEY (`car_id`) REFERENCES `cars`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `car_features` ADD CONSTRAINT `car_features_car_id_fkey` FOREIGN KEY (`car_id`) REFERENCES `cars`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `car_pricing` ADD CONSTRAINT `car_pricing_car_id_fkey` FOREIGN KEY (`car_id`) REFERENCES `cars`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `car_availability` ADD CONSTRAINT `car_availability_car_id_fkey` FOREIGN KEY (`car_id`) REFERENCES `cars`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `car_documents` ADD CONSTRAINT `car_documents_car_id_fkey` FOREIGN KEY (`car_id`) REFERENCES `cars`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `car_insurance` ADD CONSTRAINT `car_insurance_car_id_fkey` FOREIGN KEY (`car_id`) REFERENCES `cars`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `maintenance` ADD CONSTRAINT `maintenance_car_id_fkey` FOREIGN KEY (`car_id`) REFERENCES `cars`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fuel_logs` ADD CONSTRAINT `fuel_logs_car_id_fkey` FOREIGN KEY (`car_id`) REFERENCES `cars`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `gps_devices` ADD CONSTRAINT `gps_devices_car_id_fkey` FOREIGN KEY (`car_id`) REFERENCES `cars`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_vendor_id_fkey` FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_car_id_fkey` FOREIGN KEY (`car_id`) REFERENCES `cars`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `booking_items` ADD CONSTRAINT `booking_items_booking_id_fkey` FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `booking_items` ADD CONSTRAINT `booking_items_car_id_fkey` FOREIGN KEY (`car_id`) REFERENCES `cars`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `booking_status_history` ADD CONSTRAINT `booking_status_history_booking_id_fkey` FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `trip_history` ADD CONSTRAINT `trip_history_booking_id_fkey` FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `trip_extensions` ADD CONSTRAINT `trip_extensions_booking_id_fkey` FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `trip_extensions` ADD CONSTRAINT `trip_extensions_requested_by_fkey` FOREIGN KEY (`requested_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `trip_extensions` ADD CONSTRAINT `trip_extensions_approved_by_fkey` FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `trip_photos` ADD CONSTRAINT `trip_photos_trip_id_fkey` FOREIGN KEY (`trip_id`) REFERENCES `trip_history`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `trip_damage` ADD CONSTRAINT `trip_damage_trip_id_fkey` FOREIGN KEY (`trip_id`) REFERENCES `trip_history`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_booking_id_fkey` FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `refunds` ADD CONSTRAINT `refunds_payment_id_fkey` FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `refunds` ADD CONSTRAINT `refunds_booking_id_fkey` FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `wallets` ADD CONSTRAINT `wallets_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `wallet_transactions` ADD CONSTRAINT `wallet_transactions_wallet_id_fkey` FOREIGN KEY (`wallet_id`) REFERENCES `wallets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `coupon_usage` ADD CONSTRAINT `coupon_usage_coupon_id_fkey` FOREIGN KEY (`coupon_id`) REFERENCES `coupons`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `coupon_usage` ADD CONSTRAINT `coupon_usage_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `coupon_usage` ADD CONSTRAINT `coupon_usage_booking_id_fkey` FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_booking_id_fkey` FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_vendor_id_fkey` FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_booking_id_fkey` FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_car_id_fkey` FOREIGN KEY (`car_id`) REFERENCES `cars`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `support_tickets` ADD CONSTRAINT `support_tickets_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `support_tickets` ADD CONSTRAINT `support_tickets_assigned_to_fkey` FOREIGN KEY (`assigned_to`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `support_messages` ADD CONSTRAINT `support_messages_ticket_id_fkey` FOREIGN KEY (`ticket_id`) REFERENCES `support_tickets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `support_messages` ADD CONSTRAINT `support_messages_sender_id_fkey` FOREIGN KEY (`sender_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `activity_logs` ADD CONSTRAINT `activity_logs_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

