# State Licensing Management System

SLMS is a Next.js 15 / React 19 application for administrator-managed citizen licensing. It uses TypeScript, Prisma 6, MariaDB/MySQL, Tailwind CSS 4, shadcn-style Radix UI primitives, and Server Actions.

## Run locally

Requirements: Node.js 22 LTS (or 24), npm, and MariaDB 10.11+/MySQL 8.0.16+.

1. Run `npm ci` in this directory.
2. Copy `.env.example` to `.env`. Set `DATABASE_URL` to a **new, empty SLMS database**. URL-encode special characters in the database password.
3. Set `ADMIN_USERNAME`, `ADMIN_NAME`, and a unique `ADMIN_PASSWORD` of at least 8 characters. There are no built-in login credentials or public registration endpoints.
4. Run `npm run db:generate`, `npm run db:migrate`, and `npm run db:seed`.
5. Run `npm run dev` and open http://localhost:3000.
6. Sign in with the administrator credentials and change the initial password. Create the team accounts under **User accounts**.
7. Remove `ADMIN_PASSWORD` from the environment after bootstrap. Re-running the seed preserves an existing administrator and existing catalog prices.

The seed command uses Prisma's environment loading via the imported client. If your shell does not load `.env`, use `node --env-file=.env --import tsx prisma/seed.ts` with Node 22+.

## Deploy to Vercel + MariaDB

See [DEPLOYMENT.md](DEPLOYMENT.md) for the exact environment settings, migration order, cron setup, and verification steps. This source bundle is not connected to your live database and has not been deployed to your Vercel account.

## Included workflows

| Area           | Implemented behavior                                                                                                                                                                     |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authentication | Admin-created usernames, scrypt password hashes, hashed opaque sessions, 8-hour expiry, forced password changes, account lockout after 10 attempts per 15 minutes                        |
| Administrator  | Create/edit/disable/delete accounts, reset passwords, catalog/pricing, all applications/licenses, revoke/edit licenses, revenue percentages, audit trail, reports, organization settings |
| Lawyer         | Submit applications and renewals, upload payment proof, view own applications/licenses and review decisions, view own earnings                                                           |
| Reviewers      | State employee, state assistant, and authorized reviewer roles; verify payment, approve/reject, choose duration, view personal review counts and earnings                                |
| Licenses       | Unique IDs, active/expired/revoked status, fixed-day duration, automatic expiry display, renewal chain and preserved prior expiry dates                                                  |
| Revenue        | Immutable per-approval price/split snapshot, exact integer cents, 50/30/20 default, validation of a 100% total, per-person allocation history                                            |
| Search         | Citizen, CID, license/application ID, lawyer, reviewer, license type; role scope, type/status filters, pagination                                                                        |
| Notifications  | Submission, approval, rejection, 7-day expiration warning, expiration; unread state and mark-all-read                                                                                    |
| Reports        | PDF and native Excel for revenue, active/expired licenses, lawyer performance, reviewer performance, with date filters                                                                   |
| Interface      | Navy/gold government dashboard, charts, responsive tables and forms, dark mode, loading/error/success and empty states                                                                   |

Earnings are accounting allocations, not transfers to banks or external payment systems. Payment is verified manually from uploaded proof. The optional Discord webhook integration is not enabled or implemented.

## Architecture and folder structure

```text
prisma/
  schema.prisma                 All requested models plus sessions, login limits, payment proof
  migrations/                   Initial SQL migration, indexes, foreign keys, check constraints
  seed.ts                       Roles, initial admin, catalog, settings (idempotent)
src/
  app/
    (portal)/                   Authenticated dashboard and role-specific pages
      dashboard/ applications/ licenses/ earnings/
      users/ license-types/ settings/ audit/ notifications/ search/
    actions.ts                  Authenticated and validated Server Actions
    api/proofs/[id]/             Authorized attachment downloads
    api/search/                 Scoped search endpoint
    api/reports/                Administrator PDF/Excel exports
    api/cron/expiration/        Bearer-secret-protected expiration maintenance
    login/ change-password/    Authentication views
  components/                   Shared forms, tables, navigation, review controls
    ui/                         Radix/shadcn-style Button and Table primitives
  lib/
    auth.ts                     Session verification and permission enforcement
    service.ts                  Transactional approval, expiry, and audit operations
    policy.ts                   Revenue, date, role, and ownership rules
    validation.ts               Zod validation, currency and upload checks
    report-data.ts export.ts    Scoped report data and file generation
    db.ts password.ts queries.ts utils.ts
public/fonts/                   OFL-licensed Noto fonts for English/Bengali PDF text
tests/                          Domain/export tests and disposable MariaDB workflow test
```

### Data and permission boundaries

Every mutation rechecks authentication and role on the server. Lawyer reads and downloads are restricted to their own submissions. Reviewers cannot create accounts; lawyers cannot approve applications. UI visibility is supplementary, never the only control. This follows the [Next.js Server Action security guidance](https://nextjs.org/docs/15/app/guides/data-security).

Approvals run in serializable transactions. A conditional pending-status update claims an application; license and revenue uniqueness constraints prevent a second payout. A failed verification rolls the entire operation back. Concurrent conflicts return a retry message. Revenue uses integer cents and basis points; rounding remainder goes to the government so shares always equal the fee.

Payment proofs are private database BLOBs, restricted to PNG/JPEG/PDF signatures and 3 MB. Downloads require a session and ownership/role authorization and are served as attachments with `nosniff`. No file is put in Vercel's ephemeral filesystem. For much larger upload volume, move BLOBs to private object storage with the same authorization boundary.

Account and catalog deletion removes access/availability while retaining historical foreign-key records. Logs snapshot the actor name. Password resets, role edits, and disabling invalidate existing sessions. Sessions are also invalid when the account is deleted or disabled.

Application decision status stays PENDING/APPROVED/REJECTED to preserve review history; the related license carries ACTIVE/EXPIRED/REVOKED. Application tables show an expired/revoked license status when relevant. Successful renewal marks the old license expired/superseded while retaining its original expiration date; the new period starts at the later of the prior expiry and approval time. Rejected renewals may be resubmitted.

Expiry is computed at read time, so validity never depends on a timely scheduler. The scheduled job persists expiration and creates notifications in batches. A daily schedule can delay notices by up to a day. Transactions are capped; a response with `remaining: true` means another authenticated invocation is needed.

Audit logs record successful mutations, logins/logouts, failed logins, downloads, report exports, expiry, password changes, and settings updates. `TRUST_PROXY=true` is required to record forwarded IP addresses behind Vercel; it must remain false behind an untrusted proxy. User-provided metadata and passwords are never logged.

### HTTP endpoints

| Method/path                                                               | Access                              | Result                                                                   |
| ------------------------------------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------ |
| GET `/api/search?q=...&type=...`                                          | Signed in                           | Up to 25 matching applications and licenses, scoped to role              |
| GET `/api/proofs/:id`                                                     | Owner lawyer or reviewer/admin      | Private attachment download                                              |
| GET `/api/reports?type=revenue&format=xlsx&from=YYYY-MM-DD&to=YYYY-MM-DD` | Admin                               | PDF/XLSX attachment; types: revenue, active, expired, lawyers, reviewers |
| GET `/api/cron/expiration`                                                | `Authorization: Bearer CRON_SECRET` | Expiry/notification maintenance counts                                   |

Writes use Next.js Server Actions with built-in same-origin checks, not duplicate public REST endpoints. Report exports are capped at 10,000 source records and request narrower filters above the cap.

## Checks

```sh
npm run typecheck
npm test
npm run build
npm audit
```

For database integration checks, create an isolated database named `slms_test`, set `DATABASE_URL` to it, run migrations, then `npm run test:integration`. The test refuses other database names and creates synthetic records. Never point this test at a production database. The integration test verifies rollback, concurrent approval, exactly one payout, lawyer scope, rejection, renewal history, expiry idempotency, and report data.

## Operational limits

Configure encrypted database transport, restricted database accounts, backups, monitoring, and Vercel deployment access for your organization before real use. No real-world security certification or load test is implied. The CSP permits inline Next.js hydration scripts; a nonce-based policy can further tighten deployment requirements. Login throttling is per username; configure Vercel's firewall rate limits for IP-level distributed abuse protection. Optional Discord logging, external payment processing, and external identity providers are outside this implementation.

Amounts are USD and displayed dates are UTC. No demo bypass, public registration, seeded fake citizens, or default production password is included.
