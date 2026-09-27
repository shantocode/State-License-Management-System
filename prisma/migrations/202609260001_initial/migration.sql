-- CreateTable
CREATE TABLE `Role` (
    `id` VARCHAR(191) NOT NULL,
    `code` ENUM('ADMIN', 'LAWYER', 'STATE_EMPLOYEE', 'STATE_ASSISTANT', 'REVIEWER') NOT NULL,

    UNIQUE INDEX `Role_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `username` VARCHAR(60) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `passwordHash` VARCHAR(255) NOT NULL,
    `roleId` VARCHAR(191) NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `deletedAt` DATETIME(3) NULL,
    `mustChangePassword` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_username_key`(`username`),
    INDEX `User_roleId_enabled_idx`(`roleId`, `enabled`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Session` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Session_expiresAt_idx`(`expiresAt`),
    INDEX `Session_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LoginAttempt` (
    `key` VARCHAR(64) NOT NULL,
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `resetAt` DATETIME(3) NOT NULL,

    INDEX `LoginAttempt_resetAt_idx`(`resetAt`),
    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LicenseType` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `description` VARCHAR(500) NOT NULL,
    `priceCents` INTEGER UNSIGNED NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `LicenseType_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LicenseApplication` (
    `id` VARCHAR(191) NOT NULL,
    `reference` VARCHAR(40) NOT NULL,
    `citizenName` VARCHAR(120) NOT NULL,
    `cid` VARCHAR(60) NOT NULL,
    `phone` VARCHAR(30) NOT NULL,
    `licenseTypeId` VARCHAR(191) NOT NULL,
    `typeName` VARCHAR(100) NOT NULL,
    `priceCents` INTEGER UNSIGNED NOT NULL,
    `paymentCents` INTEGER UNSIGNED NOT NULL,
    `notes` TEXT NOT NULL,
    `lawyerId` VARCHAR(191) NOT NULL,
    `reviewerId` VARCHAR(191) NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `rejectionReason` VARCHAR(1000) NULL,
    `paymentVerified` BOOLEAN NOT NULL DEFAULT false,
    `durationDays` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `reviewedAt` DATETIME(3) NULL,
    `renewalOfId` VARCHAR(191) NULL,

    UNIQUE INDEX `LicenseApplication_reference_key`(`reference`),
    INDEX `LicenseApplication_status_createdAt_idx`(`status`, `createdAt`),
    INDEX `LicenseApplication_lawyerId_createdAt_idx`(`lawyerId`, `createdAt`),
    INDEX `LicenseApplication_reviewerId_reviewedAt_idx`(`reviewerId`, `reviewedAt`),
    INDEX `LicenseApplication_cid_idx`(`cid`),
    INDEX `LicenseApplication_citizenName_idx`(`citizenName`),
    INDEX `LicenseApplication_renewalOfId_status_idx`(`renewalOfId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PaymentProof` (
    `id` VARCHAR(191) NOT NULL,
    `applicationId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `mime` VARCHAR(50) NOT NULL,
    `data` MEDIUMBLOB NOT NULL,
    `size` INTEGER NOT NULL,

    UNIQUE INDEX `PaymentProof_applicationId_key`(`applicationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `License` (
    `id` VARCHAR(191) NOT NULL,
    `number` VARCHAR(40) NOT NULL,
    `applicationId` VARCHAR(191) NOT NULL,
    `citizenName` VARCHAR(120) NOT NULL,
    `cid` VARCHAR(60) NOT NULL,
    `issuedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NOT NULL,
    `status` ENUM('ACTIVE', 'EXPIRED', 'REVOKED') NOT NULL DEFAULT 'ACTIVE',
    `revokedAt` DATETIME(3) NULL,
    `supersededAt` DATETIME(3) NULL,
    `revocationReason` VARCHAR(1000) NULL,
    `expiringNotifiedAt` DATETIME(3) NULL,
    `expiredNotifiedAt` DATETIME(3) NULL,

    UNIQUE INDEX `License_number_key`(`number`),
    UNIQUE INDEX `License_applicationId_key`(`applicationId`),
    INDEX `License_status_expiresAt_idx`(`status`, `expiresAt`),
    INDEX `License_cid_idx`(`cid`),
    INDEX `License_citizenName_idx`(`citizenName`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RevenueDistribution` (
    `id` VARCHAR(191) NOT NULL,
    `applicationId` VARCHAR(191) NOT NULL,
    `totalCents` INTEGER UNSIGNED NOT NULL,
    `lawyerBps` SMALLINT UNSIGNED NOT NULL,
    `reviewerBps` SMALLINT UNSIGNED NOT NULL,
    `governmentBps` SMALLINT UNSIGNED NOT NULL,
    `lawyerCents` INTEGER UNSIGNED NOT NULL,
    `reviewerCents` INTEGER UNSIGNED NOT NULL,
    `governmentCents` INTEGER UNSIGNED NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `RevenueDistribution_applicationId_key`(`applicationId`),
    INDEX `RevenueDistribution_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Earnings` (
    `id` VARCHAR(191) NOT NULL,
    `revenueId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `kind` ENUM('LAWYER', 'REVIEWER') NOT NULL,
    `amountCents` INTEGER UNSIGNED NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Earnings_userId_createdAt_idx`(`userId`, `createdAt`),
    UNIQUE INDEX `Earnings_revenueId_kind_key`(`revenueId`, `kind`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditLog` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `actorName` VARCHAR(120) NOT NULL,
    `action` VARCHAR(80) NOT NULL,
    `entityId` VARCHAR(100) NULL,
    `details` JSON NULL,
    `ipAddress` VARCHAR(64) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AuditLog_createdAt_idx`(`createdAt`),
    INDEX `AuditLog_userId_createdAt_idx`(`userId`, `createdAt`),
    INDEX `AuditLog_action_idx`(`action`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Notification` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `message` VARCHAR(300) NOT NULL,
    `href` VARCHAR(200) NOT NULL,
    `readAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Notification_userId_readAt_createdAt_idx`(`userId`, `readAt`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SystemSettings` (
    `id` INTEGER NOT NULL DEFAULT 1,
    `organization` VARCHAR(100) NOT NULL DEFAULT 'State Licensing Authority',
    `lawyerBps` SMALLINT UNSIGNED NOT NULL DEFAULT 5000,
    `reviewerBps` SMALLINT UNSIGNED NOT NULL DEFAULT 3000,
    `governmentBps` SMALLINT UNSIGNED NOT NULL DEFAULT 2000,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `Role`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Session` ADD CONSTRAINT `Session_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LicenseApplication` ADD CONSTRAINT `LicenseApplication_licenseTypeId_fkey` FOREIGN KEY (`licenseTypeId`) REFERENCES `LicenseType`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LicenseApplication` ADD CONSTRAINT `LicenseApplication_lawyerId_fkey` FOREIGN KEY (`lawyerId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LicenseApplication` ADD CONSTRAINT `LicenseApplication_reviewerId_fkey` FOREIGN KEY (`reviewerId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LicenseApplication` ADD CONSTRAINT `LicenseApplication_renewalOfId_fkey` FOREIGN KEY (`renewalOfId`) REFERENCES `License`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PaymentProof` ADD CONSTRAINT `PaymentProof_applicationId_fkey` FOREIGN KEY (`applicationId`) REFERENCES `LicenseApplication`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `License` ADD CONSTRAINT `License_applicationId_fkey` FOREIGN KEY (`applicationId`) REFERENCES `LicenseApplication`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RevenueDistribution` ADD CONSTRAINT `RevenueDistribution_applicationId_fkey` FOREIGN KEY (`applicationId`) REFERENCES `LicenseApplication`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Earnings` ADD CONSTRAINT `Earnings_revenueId_fkey` FOREIGN KEY (`revenueId`) REFERENCES `RevenueDistribution`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Earnings` ADD CONSTRAINT `Earnings_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Application-level validation is also enforced by the database.
ALTER TABLE `SystemSettings` ADD CONSTRAINT `settings_singleton` CHECK (`id` = 1), ADD CONSTRAINT `settings_split_total` CHECK (`lawyerBps` + `reviewerBps` + `governmentBps` = 10000);
ALTER TABLE `RevenueDistribution` ADD CONSTRAINT `revenue_split_total` CHECK (`lawyerBps` + `reviewerBps` + `governmentBps` = 10000), ADD CONSTRAINT `revenue_cents_total` CHECK (`lawyerCents` + `reviewerCents` + `governmentCents` = `totalCents`);
ALTER TABLE `LicenseApplication` ADD CONSTRAINT `valid_duration` CHECK (`durationDays` IS NULL OR `durationDays` IN (30,60,90,180,365)), ADD CONSTRAINT `payment_matches_price` CHECK (`paymentCents` = `priceCents`);
ALTER TABLE `PaymentProof` ADD CONSTRAINT `proof_size_limit` CHECK (`size` > 0 AND `size` <= 3145728);
