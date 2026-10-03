-- Unfiltered recent-record lists cannot use an index whose first column is status.
CREATE INDEX `LicenseApplication_createdAt_idx` ON `LicenseApplication`(`createdAt`);
CREATE INDEX `License_issuedAt_idx` ON `License`(`issuedAt`);
