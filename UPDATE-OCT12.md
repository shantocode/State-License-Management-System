# SLMS update — 12 October 2026

## Included changes

- Administrators can revoke any non-revoked license, including active/no-expiry licenses, with a reason, directly from the registry or detail page.
- Administrators can remove any license from the registry using a reason and confirmation. Removal is a soft deletion: audit records, applications, allocations and earnings are preserved. Removed licenses are excluded from registry/search, license counts, expiration processing and active/expired exports. They cannot be renewed or directly opened.
- State employees, state assistants and reviewers can revoke expired licenses with a reason from the registry/detail page. Expiry is checked on the server, including licenses whose expiry has passed before the cron job runs. They cannot remove or edit licenses, or revoke active/no-expiry licenses.
- Lawyers can read the entire license registry and license records. Application/payment details remain restricted to their own applications. Only their own eligible licenses can be renewed.
- New role: Driving Instructor. Admins can create or change accounts to this role in User accounts. Instructors can submit driving applications, follow their own reviews and earnings, and read only driving licenses in the registry and search. They cannot review, edit, remove or revoke licenses.
- Driving applications use the existing reviewer approval workflow. Price is fixed at $3,000 in the app's existing USD/game currency, with $2,100 (70%) allocated to the submitting instructor, $900 (30%) to government and $0 to the reviewer. Global split settings do not override these terms. Existing internal applicant allocation fields are reused to preserve report compatibility.
- New driving licenses have a NULL expiry (displayed as No expiry), remain active until revoked, and are excluded from expiry notifications. They cannot be renewed. Admins may edit their citizen/CID details without assigning an expiry.
- Driving is a protected catalog type reserved for instructors; lawyers retain the other catalog types. The migration and seed create the new role and catalog entry. Existing records and revenue allocations are retained.
- Reviewers approve the duration priced/requested in the application; changing it requires a new application. This prevents issuing a longer duration at the short-term price.

## Two-month application error

The supplied code already accepts 60 days, but the older database migration restricts requestedDays to 90/180/365. A deployed database missing the October migrations can reject two-month inserts. The release retains the compatible `price90Cents` storage mapping for the `price60Cents` field and adds a duration-constraint migration supporting 60 days and no-expiry driving records. Schema/constraint errors now explain that migrations are required instead of a generic unavailable message.

This is a code/schema diagnosis, not confirmation of the live server's exact error: the production database and logs were not accessed. If the problem persists after migration, inspect server logs and database availability.

## Apply the update

Back up the database, pause application traffic during migration, and replace the source with this ZIP. Keep your existing production environment variables/.env. The ZIP excludes credentials, node_modules and build caches.

Run these commands with the deployment's existing DATABASE_URL:

```sh
npm ci
npm run db:migrate
npm run db:generate
npm run build
```

Restart the app (or redeploy it). Both pending October 9 migrations and the new `202610120001_driving_permissions` migration must be applied before serving the new app. Running a build alone does not migrate the database. Seeding is not required on existing installations: the migration inserts the role and driving catalog entry.

If Prisma reports a previously failed migration, run `npx prisma migrate status`, inspect that migration's recorded error and actual schema, and repair that failure before retrying. Do not reset production data or mark an incomplete migration as applied. Historical migration files have not been rewritten.

## Verification

- TypeScript type check and production build passed.
- 13 automated tests passed, covering revocation roles/expiry boundaries, role/type tampering, instructor payout, no-expiry formatting/status, registry/application scopes, and 60-day approval through the service with an in-memory transaction stub.
- No live or disposable MySQL/MariaDB instance was available for this run. SQL migrations and real database workflow tests require staging verification.

After migration, verify in staging: create an instructor account; submit and approve a driving application; confirm the $2,100/$900 allocation, no expiry and instructor-only driving registry; submit a two-month normal application and approve it; verify lawyer read-only access, expired-only staff revocation, and admin active revocation/removal.
