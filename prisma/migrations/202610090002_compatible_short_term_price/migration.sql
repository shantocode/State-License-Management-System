-- Keep the established database column; Prisma exposes it as price60Cents.
-- Also handles installations that already applied the previous column rename.
SET @slms_restore_price_column = IF(
  EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'LicenseType'
      AND COLUMN_NAME = 'price60Cents'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'LicenseType'
      AND COLUMN_NAME = 'price90Cents'
  ),
  'ALTER TABLE `LicenseType` CHANGE COLUMN `price60Cents` `price90Cents` INTEGER UNSIGNED NOT NULL',
  'SELECT 1'
);
PREPARE slms_restore_price_column FROM @slms_restore_price_column;
EXECUTE slms_restore_price_column;
DEALLOCATE PREPARE slms_restore_price_column;
