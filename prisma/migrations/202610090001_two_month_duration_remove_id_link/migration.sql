-- Keep the existing short-term price when replacing the 90-day option with 60 days.
ALTER TABLE `LicenseType`
  CHANGE COLUMN `price90Cents` `price60Cents` INTEGER UNSIGNED NOT NULL;

-- Retain previously stored links, but new applications do not collect an ID photo link.
ALTER TABLE `LicenseApplication`
  ALTER COLUMN `citizenIdUrl` SET DEFAULT '';

-- MariaDB uses DROP CONSTRAINT; MySQL 8.0.16+ supports DROP CHECK.
SET @slms_drop_duration_check = IF(
  LOCATE('MariaDB', VERSION()) > 0,
  'ALTER TABLE `LicenseApplication` DROP CONSTRAINT `valid_requested_duration`',
  'ALTER TABLE `LicenseApplication` DROP CHECK `valid_requested_duration`'
);
PREPARE slms_drop_duration_check FROM @slms_drop_duration_check;
EXECUTE slms_drop_duration_check;
DEALLOCATE PREPARE slms_drop_duration_check;

UPDATE `LicenseApplication`
SET `requestedDays` = 60
WHERE `status` = 'PENDING' AND `requestedDays` = 90;

-- 90 days remains valid only for historical application records.
ALTER TABLE `LicenseApplication`
  ADD CONSTRAINT `valid_requested_duration`
  CHECK (`requestedDays` IN (60,180,365) OR (`requestedDays` = 90 AND `status` <> 'PENDING'));
