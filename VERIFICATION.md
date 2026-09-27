# Verification record

Checked locally on September 26–27, 2026.

- Next.js 15.5.26 production build: passed, including TypeScript validation and all application routes.
- Six automated domain/export checks: passed. Covered revenue conservation and split validation, permission and ownership rules, fixed-day expiration, salted password verification, upload signature validation, native Excel data, and PDF generation with Bengali text.
- MariaDB 11.4.5 initial migration: applied successfully to an isolated `slms_test` database.
- Database workflow integration test: passed. Covered rejected unauthorized reviews, failed-verification rollback, concurrent approvals creating exactly one license/revenue allocation, lawyer query isolation, rejected applications, renewal history, expiration, duplicate notification prevention, and report data.
- Browser: local administrator sign-in and populated dashboard verified. Desktop light theme, mobile dark theme, and mobile navigation inspected. Mobile document width did not overflow the viewport; wide data tables have intentional horizontal scrolling.
- Dependency audit after pinned transitive updates: zero known vulnerabilities reported on September 26, 2026.

The screenshot outside this source directory uses synthetic local test records. Neither those records nor the local test credentials are included in the seed or source archive.

Not verified: deployment in your Vercel account, connectivity/TLS to your hosted MariaDB, production cron delivery, production load, all form flows through the browser, or an independent security assessment. The optional Discord webhook integration is not implemented. See DEPLOYMENT.md for the remaining environment setup and production acceptance checks.
