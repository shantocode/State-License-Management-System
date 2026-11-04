# API performance investigation and changes

Investigated October 3, 2026. This package contains the optimized source, not a deployment.

## Main finding

Database round trips are the common cost across authenticated pages, server actions, and API handlers. The MariaDB server is in Singapore (confirmed by the owner), but the supplied Vercel configuration did not select a function region. Vercel's default is Washington, D.C. (`iad1`). Unless the project dashboard already overrode that default, requests were crossing regions repeatedly. This is the strongest explanation for application-wide slowness, including login; the deployed function region was not available to inspect.

The fix sets `regions: ["sin1"]` in `vercel.json`. It applies to a new deployment. Verify the deployed functions run in Singapore. See [Vercel's region documentation](https://vercel.com/docs/functions/configuring-functions/region).

Read-only measurements from the development machine to the supplied database:

| Measurement | Result |
| --- | --- |
| TCP connection, including DNS | 236 ms |
| First `SELECT 1`, including Prisma initialization and connection setup | 1,311 ms |
| Five subsequent `SELECT 1` calls | 214, 80, 83, 82, 82 ms |
| Warm median | 82 ms |

These are local-to-database measurements, not Vercel request times. Even trivial SQL has a meaningful fixed cost on this network path. There is no basis yet for promising a particular production response time or percentage improvement.

## Code bottlenecks fixed

| Finding | Change |
| --- | --- |
| Portal layout and page both call `requireUser()`, which loads session, user, and role | React `cache` deduplicates the session lookup within a server render, keyed by the current token. Session validity and permissions are still checked; there is no cross-request user cache. |
| Layout and dashboard independently load settings | One shared request-scoped settings lookup. |
| Dashboard executes five separate application counts, including values unused by some roles | One grouped count for admin/lawyer; two queries for reviewers, preserving their global pending queue and personal review totals. |
| Dashboard downloads every revenue/earnings record from the last six months, then groups in JavaScript | Parameterized MariaDB aggregation returns monthly totals; this independent query now starts alongside the other dashboard queries. |
| Production bundles could construct separate Prisma clients within the same process | Store the client globally in production as well as development so warm bundles can reuse its pool. Separate Vercel instances still have separate pools. |
| Unfiltered application/license lists lack indexes matching their ordering | Add `LicenseApplication(createdAt)` and `License(issuedAt)` in a new migration. |

Read-only `EXPLAIN` confirmed the original application list used `LicenseApplication_status_createdAt_idx` with `Using filesort`; the license list used a full scan (`ALL`, no key) with `Using filesort`. An index beginning with `status` cannot directly provide global date ordering when no status is selected. The new migration has not been applied to the live database. The optimizer may still prefer scans for very small tables.

React's cache is scoped to server rendering and invalidated across requests; route handlers do not gain this deduplication. See [React cache documentation](https://react.dev/reference/react/cache). API routes still benefit from locating their database work in Singapore.

## Other areas checked

- **Frontend:** forms use Next.js server actions with pending feedback. No custom fetch queue, artificial timeout, sleep, retry loop, or polling layer was found. Login redirects to a database-heavy dashboard, so the redirect's render contributes to perceived login time. Production build reports approximately 117 kB first-load JavaScript for login; no evidence establishes that as the shared delay.
- **Middleware:** there is no request middleware/proxy file in the supplied application. Security headers do not perform network calls.
- **Authentication:** password verification already uses asynchronous scrypt. Its work factor, rate-limit transaction, session writes, cookie policy, and audit ordering are unchanged. No authentication bypass or persistent authentication cache was added.
- **Database connections:** the supplied connection URL has no explicit pool parameters. The existing singleton already reused connections within a module, and there was no per-request `$disconnect()`. Pool exhaustion is a possible load-related contributor, not a measured finding. The included example uses `connection_limit=3` as a starting point; tune against database connection capacity and concurrent Vercel instances. Raising `pool_timeout` only increases waiting. See [Prisma v6 connection pools](https://www.prisma.io/docs/orm/v6/prisma-client/setup-and-configuration/databases-connections/connection-pool).
- **Search/report scale:** substring `contains` filters across several relations and exports of up to 10,000 records remain comparatively expensive at scale. Ordinary name indexes do not solve arbitrary substring searches. They do not explain slow login; search semantics and report limits were preserved.

## Validation

- `npm test`: **7 tests passed**, including new checks for role-specific count scopes, empty data, query counts, money conversion, and parameterized user/date SQL.
- `npm run build`: **passed**, including TypeScript validation and generation of all routes, using the existing locked dependencies.
- Production-server HTTP smoke checks: login page 200; unauthenticated search/report requests 401; an invalid session token 401; dashboard redirects to `/login`.
- Read-only comparison with the original queries: admin and lawyer displayed counts and monthly totals matched. No account with role code `REVIEWER` was available for that comparison; all three reviewer role codes are covered by the unit checks.
- Three local trials per available role: count-query medians were **193 → 151 ms** for admin and **168 → 179 ms** for lawyer. Parallel queries and network variation mean fewer queries did not consistently reduce local elapsed time. The structural reduction is **5 → 1 queries** for those roles. Payment records transferred were **4 → 1** for each available account. This small dataset is not a load test.
- No production records, sessions, or schema were modified. The write-based workflow integration suite was not run because no disposable test database was supplied.
- The running Vercel app's region, cold starts, end-to-end login timing, and performance under production load remain unverified.

## Deploy and measure

1. Use the patched source with your existing environment variables. The archive excludes the original `.env` and includes only `.env.example` placeholders. Do not replace working credentials with the example.
2. Run `npm ci`. With your migration database credentials, run `npm run db:migrate` once during an appropriate release window. It adds two indexes; large tables can take time or hold locks. Do not seed or reset the existing database.
3. Deploy to Vercel and verify the function region is `sin1`. The region and query changes work independently of the index migration.
4. Review the runtime `DATABASE_URL` pool limit against available database connections. Preserve provider-required TLS/CA settings. Do not enlarge the pool blindly: each Vercel instance owns a separate pool.
5. Compare cold and warm login, dashboard, search, and a representative mutation before/after deployment. In browser Network timings, distinguish request queueing from time waiting for the server and response download. In Vercel logs, confirm region, function duration, and database/pool errors. Compare the same account, filters, and dataset.

Read-only diagnostic commands, run from the application directory:

```sh
node --env-file=.env scripts/db-latency.mjs
npm test
node --env-file=.env .test-build/scripts/check-dashboard-performance.js
```

The first command isolates connection/query latency without reading application records. The second diagnostic checks old/new results without printing personal data. Run the latency probe from a host in the application's region when evaluating server-to-database distance; local measurements cannot establish Vercel latency.

If warm requests remain slow after the region change, inspect slow-query plans and pool wait time under representative concurrency before introducing persistent caches, full-text search, or a different database. No new dependency is required by this update.
