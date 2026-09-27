# Vercel + MariaDB deployment

## 1. Database

Use a new MariaDB database with `utf8mb4` encoding. MariaDB 10.11+ is the recommended target; the project also targets MySQL 8.0.16+. Keep it in a region near your Vercel functions. The hostname must be reachable from Vercel; `localhost` on a separate host will not work.

Create a migration account with DDL rights for the initial deployment. Use a runtime account with only the required SELECT/INSERT/UPDATE/DELETE permissions after migration. Keep external database access restricted using your provider's network controls. Configure TLS with CA verification using your provider's Prisma-compatible connection settings. Do not disable certificate checks. See [Prisma's MySQL/MariaDB connector documentation](https://docs.prisma.io/docs/orm/v6/overview/databases/mysql).

Example shape (replace placeholders; URL-encode the password):

```text
mysql://slms:ENCODED_PASSWORD@DATABASE_HOST:3306/slms?connection_limit=3&pool_timeout=20&sslaccept=strict
```

Add the CA/certificate parameters required by your provider. `sslaccept=strict` is certificate validation, not a substitute for your server/provider requiring encrypted connections. For a custom CA, securely supply the certificate and the appropriate `sslcert` setting. `connection_limit=3` is a per-function-instance starting point, not a global cap; tune it against your provider's connection limit and concurrency.

## 2. Prepare and migrate

1. Put this directory in your own private Git repository.
2. On a trusted machine, run `npm ci`.
3. Create `.env` from `.env.example` with the migration database URL and bootstrap administrator fields.
4. Run `npm run db:generate`, then `npm run db:migrate` against the new database.
5. Run `node --env-file=.env --import tsx prisma/seed.ts` to create roles, settings, default catalog entries, and the initial administrator. The initial password must have at least 8 characters.
6. Remove bootstrap password values after use. Do not commit `.env`, credentials, database backups, or test data.

Migrations are intentionally **not** run in every Vercel build. Apply each migration once as a controlled release step; this avoids concurrent preview builds altering your production schema. Do not use `prisma db push` against an existing production database.

## 3. Vercel project

Import the repository into Vercel. If SLMS is nested in another repository, set the Root Directory to the SLMS directory.

| Setting          | Value           |
| ---------------- | --------------- |
| Framework        | Next.js         |
| Node.js          | 22.x LTS        |
| Install command  | `npm ci`        |
| Build command    | `npm run build` |
| Output directory | Leave default   |

Set these variables in Vercel's encrypted environment settings:

| Variable       | Required value                                                      |
| -------------- | ------------------------------------------------------------------- |
| `DATABASE_URL` | Runtime MariaDB connection string with your provider's TLS settings |
| `CRON_SECRET`  | A cryptographically random secret of at least 32 characters         |
| `TRUST_PROXY`  | `true` behind Vercel's trusted proxy                                |

Generate a cron secret on your trusted machine with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Paste the result into Vercel, not the source or a chat. Set separate preview and production databases to prevent preview mutations of real records. Do not add bootstrap administrator variables to the running application unless you deliberately execute the seed there.

Deploy through your Vercel project. The code is configured for Node.js server functions; do not switch Prisma routes to Edge Runtime.

## 4. Expiration scheduler

`vercel.json` schedules `/api/cron/expiration` daily at 00:00 UTC. Vercel supplies the `Authorization` header from `CRON_SECRET`. Unauthenticated calls are rejected. See [Vercel's cron configuration](https://vercel.com/docs/cron-jobs/manage-cron-jobs) and [scheduling limits](https://vercel.com/docs/cron-jobs/usage-and-pricing).

The job processes up to 500 records per transaction and repeats within its time budget. Monitor failures and `remaining: true`; invoke again with the secret or move to a more frequent schedule on a suitable plan for larger volumes. Expired licenses display as expired even before the job runs. Daily notice timing is approximate.

## 5. Verify the deployed system

- Sign in as the seeded administrator; change the initial password.
- Create one lawyer and one reviewer account with temporary passwords; each changes its password on first use.
- Submit an application from the lawyer with a valid payment proof and exact fee.
- Approve it from the reviewer after verifying the proof; confirm the license expiry and 50/30/20 allocations.
- Try a second review of the same application and confirm it cannot allocate money twice.
- Verify the lawyer cannot open another lawyer's records, use the account management page, or retrieve private proofs belonging to others.
- Download each report format and check the audit trail and notifications.
- Run the configured expiration job once from Vercel and check its logs.
- Check your database backup and restore process, and monitor database connections and function failures.

## Delivery status

This package contains the application and deployment configuration. It does not contain your database credentials, a Vercel project connection, or a hosted URL. Deployment to your account remains a separate environment step.
