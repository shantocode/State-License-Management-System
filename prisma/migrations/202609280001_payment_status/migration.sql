-- Replace the boolean payment flag with a 3-state status the reviewer sets explicitly.
ALTER TABLE `LicenseApplication`
  ADD COLUMN `paymentStatus` ENUM('RECEIVED','NOT_RECEIVED','WAIVED') NOT NULL DEFAULT 'NOT_RECEIVED';

-- Backfill from the old boolean: previously-approved rows were only ever
-- marked verified when payment had in fact been received.
UPDATE `LicenseApplication` SET `paymentStatus` = 'RECEIVED' WHERE `paymentVerified` = 1;

ALTER TABLE `LicenseApplication`
  DROP COLUMN `paymentVerified`;
