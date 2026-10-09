# SLMS themes, rounded navigation, and database compatibility update

## Changes

- Introduced a formal civic design: locally hosted Noto Sans for interface text, Georgia serif headings, warm white surfaces, navy and gold accents, and a city licensing masthead.
- Added a rounded light/dark mode button at the top right of the login page and portal. White mode keeps the civic light design; dark mode restores the original navy colors (`#101a29` background, `#172438` surfaces, and `#10263f` sidebar). Your choice is saved in browser storage and restored on later visits. Switching still works when browser storage is disabled.
- Navigation links now use rounded pill tabs with hover, pressed, selected, and keyboard focus states. Selecting a tab opens its page and closes the mobile menu. Nested pages keep the correct navigation tab selected. Buttons use matching rounded styling.
- Improved spacing, responsive layouts, catalog price readability, dropdown sizing, and footer styling. The supplied seal is displayed in a circular frame to hide its black square corners; the original image is preserved.
- Retained the earlier updates: no Citizen ID picture link requirement, two-month (60-day) licensing, and the supplied City of Los Santos logo. The CID text field, six-month option, and twelve-month option remain.

## Fix for the reported missing-column error

The previous application version expected a physical `LicenseType.price60Cents` column, while the installed database still had `price90Cents`. Prisma now exposes `price60Cents` through `@map("price90Cents")`, so the application reads the established column while treating its price as the two-month price.

The original released migration is retained unchanged. The additional migration `202610090002_compatible_short_term_price` restores the established column name when the earlier rename was already applied. It preserves the price values. Running all pending migrations brings either installation to the same schema.

`npm run dev` now generates the Prisma client before starting Next.js to avoid using a client generated from the previous schema.

## Install on Windows

1. Stop the running development server with Ctrl+C.
2. Extract this ZIP into `C:\slms`, replacing application source files and retaining your existing `.env`.
3. In Command Prompt, run:

```bat
cd /d C:\slms
npm ci
npm run db:migrate
npm run dev
```

Run each command after the previous one succeeds. The migration must complete before starting the application. For production, run `npm run build` and deploy using your existing settings.

The earlier duration migration changes pending 90-day requests to 60 days. Already reviewed application history and issued license expiry dates remain unchanged. Existing short-term price values are preserved; administrators can adjust the two-month price in the catalog. Existing Citizen ID picture links remain in storage, but the application no longer collects or displays them.

## Verification

- Nine tests passed, including a regression check that the generated Prisma client maps the two-month price to the established database column.
- Local component interaction checks passed for theme switching in both directions, saved preferences, blocked browser storage, selected navigation routes, and opening/closing the mobile menu. CSS syntax checking passed.
- TypeScript checking, Prisma client generation, and Prisma schema validation passed.
- Login, portal, and application UI components rendered successfully with sample data. Browser screenshot verification could not complete because the preview browser could not reach the local server.
- Live database migrations and database integration tests were not run because no database connection was supplied.
- Production build verification remains limited by a Windows compiler path access error in this workspace. Run the build in your deployment environment.

The ZIP contains source code and assets. Local dependency folders, caches, generated build output, sample preview files, and verification workarounds are excluded.
