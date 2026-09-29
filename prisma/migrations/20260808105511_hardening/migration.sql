-- CreateIndex
CREATE INDEX `activity_logs_entity_entity_id_idx` ON `activity_logs`(`entity`, `entity_id`);

-- CreateIndex
CREATE INDEX `audit_logs_entity_entity_id_idx` ON `audit_logs`(`entity`, `entity_id`);

-- CreateIndex
CREATE INDEX `audit_logs_request_id_idx` ON `audit_logs`(`request_id`);

-- CreateIndex
CREATE INDEX `car_availability_date_status_idx` ON `car_availability`(`date`, `status`);

-- CreateIndex
CREATE INDEX `car_pricing_effective_from_effective_to_idx` ON `car_pricing`(`effective_from`, `effective_to`);

-- CreateIndex
CREATE INDEX `car_pricing_currency_code_idx` ON `car_pricing`(`currency_code`);

-- CreateIndex
CREATE INDEX `notifications_status_created_at_idx` ON `notifications`(`status`, `created_at`);

-- CreateIndex
CREATE INDEX `support_tickets_assigned_to_status_idx` ON `support_tickets`(`assigned_to`, `status`);
