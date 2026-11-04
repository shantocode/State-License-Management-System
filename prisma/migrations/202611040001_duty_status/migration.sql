-- On-duty tracking for State employees and State assistants.
ALTER TABLE `User` ADD COLUMN `onDuty` BOOLEAN NOT NULL DEFAULT false, ADD COLUMN `dutySince` DATETIME(3) NULL;
