-- Let the admin set a different price per license duration (3/6/12 months)
-- instead of one flat price per license type.
ALTER TABLE `LicenseType`
  ADD COLUMN `price90Cents` INTEGER UNSIGNED NOT NULL DEFAULT 0,
  ADD COLUMN `price180Cents` INTEGER UNSIGNED NOT NULL DEFAULT 0,
  ADD COLUMN `price365Cents` INTEGER UNSIGNED NOT NULL DEFAULT 0;

-- Backfill: use the old flat price for every duration as a starting point;
-- the admin can then adjust each duration's price from the catalog page.
UPDATE `LicenseType`
SET `price90Cents` = `priceCents`,
    `price180Cents` = `priceCents`,
    `price365Cents` = `priceCents`;

ALTER TABLE `LicenseType`
  ALTER COLUMN `price90Cents` DROP DEFAULT,
  ALTER COLUMN `price180Cents` DROP DEFAULT,
  ALTER COLUMN `price365Cents` DROP DEFAULT,
  DROP COLUMN `priceCents`;
