# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

CMU Courses (ScottyLabs Course Tool) — a Next.js frontend + Express backend over a MongoDB course/FCE/schedule dataset, deployed at cmucourses.com. Bun workspaces orchestrated by Nx: `apps/frontend`, `apps/backend`, `packages/db`.

## Commands

Run from the repo root (Bun 1.2.3 is the package manager; do not use npm/yarn/pnpm):

```bash
bun install
bun run dev      # nx run-many -t dev --parallel  → frontend :3010, backend :3000
bun run build
bun run format   # prettier --write . --ignore-path .gitignore
```

Per-workspace (cd into `apps/frontend` or `apps/backend`):

```bash
bun run lint       # eslint
bunx tsc --noEmit  # type-check — CI runs this, not `bun run build`
bun run test       # frontend only (jest); no test files exist in the repo yet
bunx jest path/to/file.test.ts   # single test file
```

Prisma client generation lives in `packages/db` (`bun run db-generate`, `db-migrate` = `prisma db push`, `db-validate` = `prisma format`). Nx `targetDefaults` make `dev` and `build` depend on `^db-generate`, so the client is generated automatically for those; CI generates it explicitly before linting. If imports from `@cmucourses/db` fail to resolve, run `db-generate` first.

CI (`.github/workflows/lint.yml`, on PRs) = generate prisma client → eslint + `tsc --noEmit` for both apps. `next.config.mjs` sets `typescript.ignoreBuildErrors` and `eslint.ignoreDuringBuilds`, so a green `next build` proves nothing about types — run `tsc --noEmit` yourself.

## Environment

- Frontend: `NEXT_PUBLIC_BACKEND_URL` (no trailing slash), `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`, Clerk publishable/secret keys.
- Backend: `MONGODB_URI` (read by `schema.prisma`), `PORT`, `AUTH_ENABLED`, `CLERK_PEM_KEY`, `BACKEND_ENV`, `CLERK_LOGIN_HOST`.
- Note `.env.template` ships `BACKEND_URL`, but the frontend actually reads `NEXT_PUBLIC_BACKEND_URL` — the README's instruction is the correct one. Production env comes from Doppler via `netlify.toml`.

## Architecture

### packages/db

`index.ts` constructs one `PrismaClient` as the default export and re-exports all of `@prisma/client`, so backend code does `import db, { Prisma } from "@cmucourses/db"`. Datasource is MongoDB. Models: `courses`, `fces`, `professors`, `schedules`, `geneds`, with `@@fulltext` indexes on `courses` (name/department/desc/prereqString) and `professors.name`.

### apps/backend

Thin Express app. All routes are declared in `src/app.ts`; one controller file per resource in `src/controllers/`. Conventions:

- **Paired public/authenticated routes.** Endpoints that need auth are registered twice — `GET /x` and `POST /x` with the `isUser` middleware. The frontend calls the POST form with a Clerk JWT in the request *body* (`{ token }`), not an `Authorization` header. `isUser` (`controllers/user.ts`) verifies RS256 against `CLERK_PEM_KEY` and is a no-op unless `AUTH_ENABLED === "true"`. FCE data is the gated resource.
- **Typed handlers.** Each controller exports an interface with `params`/`resBody`/`reqBody`/`query` and uses it to parameterize `RequestHandler`. Response types are derived from Prisma via the `PrismaReturn`/`ElemType` helpers in `src/util.ts` rather than hand-written.
- **Errors** are forwarded with `next(e)` to a single error handler that 500s with the error JSON.
- **`getFilteredCourses` builds a raw MongoDB aggregation pipeline** (`db.courses.aggregateRaw`) because Prisma lacks MongoDB full-text search. It layers `$match` (text/department/level regex), `$addFields` + `$match` for a units range coerced from the string `units` field, an optional `$lookup` of `schedules`, a session `$elemMatch`, then `$facet` for pagination. Page size is capped at `MAX_LIMIT = 10`.
- **`GET /courses/all` is served from a module-level cache** in `controllers/courses.ts` (`allCoursesEntry`), refreshed on a 24-hour TTL check.
- `standardizeID` in `src/util.ts` normalizes `"15122"` → `"15-122"`; apply it to any user-supplied course ID before querying.
- Path alias `~/*` → `apps/backend/src/*`. ESM (`"type": "module"`), run and bundled by Bun.

### apps/frontend

Next.js 15, **Pages Router**. Routes live in `src/pages/` (`index`, `search`, `saved`, `schedules`, `geneds`, `finals`, `instructors`, plus dynamic `course/[courseID]`, `instructor/[name]`, `schedules/shared`).

**`src/app/` is not the App Router.** It is the shared client-logic layer: Redux slices, the react-query API layer, and domain helpers. `src/app/layout.tsx` is an unused leftover Next scaffold stub — providers actually live in `src/pages/_app.tsx` (QueryClientProvider → PostHog → Clerk → redux `Provider` → `PersistGate`). Don't treat files in `src/app/` as server components.

Two state systems, split by ownership:

- **Server data → `src/app/api/*.ts`.** One module per resource exporting `useFetch*` react-query hooks. Multi-item fetches go through `@yornaath/batshit` batchers (`create` + `keyResolver` + `windowScheduler(10)`) so per-card `useFetchCourseInfo(courseID)` calls coalesce into one request. `STALE_TIME` is 1 day. Authenticated fetchers take Clerk's `getToken` and are `memoize`d over `(isSignedIn, getToken)`.
- **User/UI state → Redux Toolkit slices** in `src/app/` (`user`, `filters`, `ui`, `userSchedules`, `instructors`, `finals`), combined in `store.ts`. Each slice is individually wrapped in `persistReducer` with its own key and `autoMergeLevel2`, so adding a slice means adding its persist config too. Use the typed `useAppSelector`/`useAppDispatch` from `src/app/hooks.ts`. Search inputs dispatch through the debounced `throttledFilter`/`throttledInstructorFilter` exported from `store.ts`.

The filters slice is the query key for course search: `useFetchCourseInfosByPage` serializes the whole `FiltersState` into URL params, so filter shape changes must be mirrored in both `src/app/api/course.ts` and the backend's `GetFilteredCourses` query type.

FCE aggregation math (weighting by `numRespondents`, dropping zero-response-rate entries, semester counting) lives client-side in `src/app/fce.ts`.

Styling is Tailwind v4 via `@tailwindcss/postcss`, with a fully custom `colors` palette in `tailwind.config.ts` (no default Tailwind colors) and **nightwind** for dark mode — dark variants are generated from the light classes, so write light-mode classes only and use `nightwind`'s class toggling rather than hand-authored `dark:` variants. `prettier-plugin-tailwindcss` orders classes.

Path alias `~/*` → `apps/frontend/src/*`.

`src/components/finals/` contains a Python scraper (`scripts/generate-final.py`) whose output is committed as `finals.json` and imported directly — finals data does not come from the backend.

## Conventions

Prettier: 120 cols, 2 spaces, double quotes, semicolons, es5 trailing commas. The frontend eslint config downgrades the `@typescript-eslint/no-unsafe-*` family, `no-explicit-any`, `no-unused-vars`, and `react-hooks/rules-of-hooks` to warnings — warnings there are pre-existing noise, but don't add new ones.
