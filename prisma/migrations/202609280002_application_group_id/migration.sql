-- Ties the separate per-type application rows created from a single
-- multi-select submission back together, so the UI can show/manage them
-- as one submission instead of unrelated rows.
ALTER TABLE `LicenseApplication`
  ADD COLUMN `groupId` VARCHAR(40) NULL;

CREATE INDEX `LicenseApplication_groupId_idx` ON `LicenseApplication` (`groupId`);
