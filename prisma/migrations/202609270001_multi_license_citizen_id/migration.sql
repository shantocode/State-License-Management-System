-- DropForeignKey
ALTER TABLE `PaymentProof` DROP FOREIGN KEY `PaymentProof_applicationId_fkey`;

-- DropTable
DROP TABLE `PaymentProof`;

-- AlterTable: replace uploaded payment proof with a Citizen ID picture link,
-- and record the duration the applicant requested at submission time.
ALTER TABLE `LicenseApplication`
  ADD COLUMN `citizenIdUrl` VARCHAR(500) NOT NULL DEFAULT '',
  ADD COLUMN `requestedDays` SMALLINT UNSIGNED NOT NULL DEFAULT 90;

-- Application-level validation is also enforced by the database.
ALTER TABLE `LicenseApplication`
  ADD CONSTRAINT `valid_requested_duration` CHECK (`requestedDays` IN (90,180,365));

-- Columns above were added with defaults for existing rows; drop the defaults
-- so future inserts must supply real values (Prisma always does).
ALTER TABLE `LicenseApplication`
  ALTER COLUMN `citizenIdUrl` DROP DEFAULT,
  ALTER COLUMN `requestedDays` DROP DEFAULT;
