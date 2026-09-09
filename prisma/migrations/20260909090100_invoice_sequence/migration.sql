CREATE TABLE `invoice_sequences` (
  `fiscal_year` INTEGER NOT NULL,
  `next_number` INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (`fiscal_year`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
