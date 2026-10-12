-- Extend roles and catalog without changing historical records or allocations.
ALTER TABLE `Role` MODIFY `code` ENUM('ADMIN','LAWYER','STATE_EMPLOYEE','STATE_ASSISTANT','REVIEWER','DRIVING_INSTRUCTOR') NOT NULL;
INSERT INTO `Role` (`id`, `code`) VALUES ('role_driving_instructor', 'DRIVING_INSTRUCTOR') ON DUPLICATE KEY UPDATE `code` = VALUES(`code`);
ALTER TABLE `LicenseType` ADD COLUMN `isDriving` BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE `License` MODIFY `expiresAt` DATETIME(3) NULL, ADD COLUMN `deletedAt` DATETIME(3) NULL;
INSERT INTO `LicenseType` (`id`,`name`,`description`,`price90Cents`,`price180Cents`,`price365Cents`,`enabled`,`createdAt`,`isDriving`)
VALUES ('type_driving_license','Driving License','Driving authorization with no expiry; revocable by an administrator.',300000,300000,300000,true,CURRENT_TIMESTAMP(3),true)
ON DUPLICATE KEY UPDATE `isDriving` = true, `price90Cents` = 300000, `price180Cents` = 300000, `price365Cents` = 300000, `enabled` = true, `deletedAt` = NULL;
-- Drop old duration checks if present, on MySQL or MariaDB.
SET @slms_drop = IF(EXISTS(SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='LicenseApplication' AND CONSTRAINT_NAME='valid_requested_duration'),
 IF(LOCATE('MariaDB',VERSION())>0,'ALTER TABLE `LicenseApplication` DROP CONSTRAINT `valid_requested_duration`','ALTER TABLE `LicenseApplication` DROP CHECK `valid_requested_duration`'),'SELECT 1');
PREPARE slms_stmt FROM @slms_drop;
EXECUTE slms_stmt;
DEALLOCATE PREPARE slms_stmt;
SET @slms_drop = IF(EXISTS(SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='LicenseApplication' AND CONSTRAINT_NAME='valid_duration'),
 IF(LOCATE('MariaDB',VERSION())>0,'ALTER TABLE `LicenseApplication` DROP CONSTRAINT `valid_duration`','ALTER TABLE `LicenseApplication` DROP CHECK `valid_duration`'),'SELECT 1');
PREPARE slms_stmt FROM @slms_drop;
EXECUTE slms_stmt;
DEALLOCATE PREPARE slms_stmt;
UPDATE `LicenseApplication` SET `requestedDays`=60 WHERE `requestedDays`=90 AND `status`='PENDING';
ALTER TABLE `LicenseApplication`
 ADD CONSTRAINT `valid_requested_duration` CHECK (`requestedDays` IN (0,60,180,365) OR (`requestedDays`=90 AND `status`<>'PENDING')),
 ADD CONSTRAINT `valid_duration` CHECK (`durationDays` IS NULL OR `durationDays` IN (0,30,60,90,180,365));
