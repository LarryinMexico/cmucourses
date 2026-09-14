# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

CMU Courses (ScottyLabs Course Tool) — a Next.js frontend + Express backend over a MongoDB course/FCE/schedule dataset, deployed at cmucourses.com. Bun workspaces orchestrated by Nx: `apps/frontend`, `apps/backend`, `packages/db`, `packages/profile`.

This fork adds per-user **Student Profiles** (career goals, academic background, busy times, course history) — the repo's first user data and first write path. See `ROADMAP.md` and `docs/superpowers/specs/2026-09-11-student-profile-design.md`.

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

`packages/profile` has its own tests: `cd packages/profile && bun test`.

Prisma client generation lives in `packages/db` (`bun run db-generate`, `db-migrate` = `prisma db push`, `db-validate` = `prisma format`). Nx `targetDefaults` make `dev` and `build` depend on `^db-generate`, so the client is generated automatically for those; CI generates it explicitly before linting. If imports from `@cmucourses/db` fail to resolve, run `db-generate` first.

CI (`.github/workflows/lint.yml`, on PRs) = generate prisma client → eslint + `tsc --noEmit` for both apps. `next.config.mjs` sets `typescript.ignoreBuildErrors` and `eslint.ignoreDuringBuilds`, so a green `next build` proves nothing about types — run `tsc --noEmit` yourself.

## Environment

- Frontend: `NEXT_PUBLIC_BACKEND_URL` (no trailing slash), `NEXT_PUBLIC_PROFILE_BACKEND_URL` (backend serving `/user/profile`; falls back to `NEXT_PUBLIC_BACKEND_URL`, which has no profile routes when it points at the public API), `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`, Clerk publishable/secret keys.
- Backend: `MONGODB_URI` (read by `schema.prisma`), `PORT`, `AUTH_ENABLED`, `CLERK_PEM_KEY`, `BACKEND_ENV`, `CLERK_LOGIN_HOST`. `CLERK_PEM_KEY` must be the public key of the Clerk instance the frontend signs in with (derive it from `https://<frontendApi>/.well-known/jwks.json`); profile routes need it even when `AUTH_ENABLED=false`.
- Local profile development: the course catalog lives only in ScottyLabs' production DB, so run the backend against an empty MongoDB **replica set** (Atlas M0; Prisma rejects a standalone `mongod`), `bun run db-migrate` to create the indexes, and keep `NEXT_PUBLIC_BACKEND_URL` on the public API for course data.
  - Known limitation: with this split setup, `/fces` requests (`app/api/fce.ts`) still go to the public `NEXT_PUBLIC_BACKEND_URL`, carrying a token signed by your *local* dev Clerk instance. Production's `CLERK_PEM_KEY` is a different Clerk instance's key, so it 401s. FCE queries skip retries on 401, and `CourseCard` renders as soon as course info arrives (hrs/week and FCEDetail stay empty until FCE succeeds). Signed-out rendering is unaffected. Work around missing FCE data by testing signed-out for layout-only checks, or by reading the react-query cache / calling shared logic directly (e.g. `bun run` a script against `packages/profile`) when you need to confirm signed-in goal matching.
- Production env comes from Doppler via `netlify.toml`.

## Architecture

### packages/db

`index.ts` constructs one `PrismaClient` as the default export and re-exports all of `@prisma/client`, so backend code does `import db, { Prisma } from "@cmucourses/db"`. Datasource is MongoDB. Models: `courses`, `fces`, `professors`, `schedules`, `geneds`, and `profiles` (one document per Clerk user, sections as embedded composite types), with `@@fulltext` indexes on `courses` (name/department/desc/prereqString) and `professors.name`.

### packages/profile

Shared by both apps (TypeScript source; the frontend lists it in `transpilePackages`). `taxonomy/` holds the fixed career/skill/college/major/minor lists — an entry's `id` is stored in profiles, so never rename or remove one; change `label` or set `deprecated`. Majors are filtered by college (`majorsForCollege`); minors are not. `schema.ts` holds the zod `profilePatchSchema` (validation + normalization, e.g. course-ID standardization) and the wire `Profile` type — the backend validates requests with it and the frontend validates forms with it, so change rules here, not in either app.

`mapping/` is the career/skills-to-course data: `courseSkills.ts` is the one hand-curated fact (which skills a course teaches, checked against the live catalog), `careerSkills.ts` maps each career to core/supporting skills, and `index.ts` derives everything else (`skillsForCourse`, `careersForCourse`, `recommendCourses`) — never edit the derived data by hand. `scripts/check-course-ids.ts` and `scripts/suggest-courses.ts` are manual, network-using maintenance tools (not run in CI). The frontend reads this in `CourseTags.tsx` (tags on every `CourseCard`) and the search page's "Match my goals" checkbox (`ui.matchGoals`): when on, the list is `recommendCourses` (all mapped courses that score against the profile), optionally narrowed by the search box, with client-side pagination — not a filter of the current API search page.

### apps/backend

Thin Express app. All routes are declared in `src/app.ts`; one controller file per resource in `src/controllers/`. Conventions:

- **Paired public/authenticated routes.** Endpoints that need auth are registered twice — `GET /x` and `POST /x` with the `isUser` middleware. The frontend calls the POST form with a Clerk JWT in the request *body* (`{ token }`), not an `Authorization` header. `isUser` (`controllers/user.ts`) verifies RS256 against `CLERK_PEM_KEY` and is a no-op unless `AUTH_ENABLED === "true"`. FCE data is the gated resource.
- **`requireUser`** (also `controllers/user.ts`) is for routes that act on the caller's own data: it always verifies the token (ignoring `AUTH_ENABLED`) and sets `res.locals.userId` to the token's `sub`. Never take a user id from the request body.
- **Profiles** (`controllers/profile.ts`): `POST /user/profile` reads (returns an empty default without writing), `PATCH /user/profile` with `{ token, profile }` validates against `profilePatchSchema` (400 with `issues` on failure) and upserts; each top-level section present replaces the stored one wholesale.
- **Typed handlers.** Each controller exports an interface with `params`/`resBody`/`reqBody`/`query` and uses it to parameterize `RequestHandler`. Response types are derived from Prisma via the `PrismaReturn`/`ElemType` helpers in `src/util.ts` rather than hand-written.
- **Errors** are forwarded with `next(e)` to a single error handler that 500s with the error JSON.
- **`getFilteredCourses` builds a raw MongoDB aggregation pipeline** (`db.courses.aggregateRaw`) because Prisma lacks MongoDB full-text search. It layers `$match` (text/department/level regex), `$addFields` + `$match` for a units range coerced from the string `units` field, an optional `$lookup` of `schedules`, a session `$elemMatch`, then `$facet` for pagination. Page size is capped at `MAX_LIMIT = 10`.
- **`GET /courses/all` is served from a module-level cache** in `controllers/courses.ts` (`allCoursesEntry`), refreshed on a 24-hour TTL check.
- `standardizeID` in `src/util.ts` normalizes `"15122"` → `"15-122"`; apply it to any user-supplied course ID before querying.
- Path alias `~/*` → `apps/backend/src/*`. ESM (`"type": "module"`), run and bundled by Bun.

### apps/frontend

Next.js 15, **Pages Router**. Routes live in `src/pages/` (`index`, `search`, `saved`, `schedules`, `geneds`, `finals`, `instructors`, `profile`, plus dynamic `course/[courseID]`, `instructor/[name]`, `schedules/shared`).

**`src/app/` is not the App Router.** It is the shared client-logic layer: Redux slices, the react-query API layer, and domain helpers. `src/app/layout.tsx` is an unused leftover Next scaffold stub — providers actually live in `src/pages/_app.tsx` (QueryClientProvider → PostHog → Clerk → redux `Provider` → `PersistGate`). Don't treat files in `src/app/` as server components.

Two state systems, split by ownership:

- **Server data → `src/app/api/*.ts`.** One module per resource exporting `useFetch*` react-query hooks. Multi-item fetches go through `@yornaath/batshit` batchers (`create` + `keyResolver` + `windowScheduler(10)`) so per-card `useFetchCourseInfo(courseID)` calls coalesce into one request. `STALE_TIME` is 1 day. Authenticated fetchers take Clerk's `getToken` and are `memoize`d over `(isSignedIn, getToken)`.
- **User/UI state → Redux Toolkit slices** in `src/app/` (`user`, `filters`, `ui`, `userSchedules`, `instructors`, `finals`), combined in `store.ts`. Each slice is individually wrapped in `persistReducer` with its own key and `autoMergeLevel2`, so adding a slice means adding its persist config too. Server-owned user data (the profile) does **not** go here — it lives in react-query (`src/app/api/profile.ts`) so it isn't duplicated in localStorage or leaked across accounts. Use the typed `useAppSelector`/`useAppDispatch` from `src/app/hooks.ts`. Search inputs dispatch through the debounced `throttledFilter`/`throttledInstructorFilter` exported from `store.ts`.

The filters slice is the query key for course search: `useFetchCourseInfosByPage` serializes the whole `FiltersState` into URL params, so filter shape changes must be mirrored in both `src/app/api/course.ts` and the backend's `GetFilteredCourses` query type.

FCE aggregation math (weighting by `numRespondents`, dropping zero-response-rate entries, semester counting) lives client-side in `src/app/fce.ts`.

Styling is Tailwind v4 via `@tailwindcss/postcss`, using **Tailwind's default palette**: `globals.css` has no `@config`, so `tailwind.config.ts` (its custom `colors`, `animation`, and the `nightwind` plugin) is not loaded — nightwind can't run under v4 anyway. Write light-mode classes only; dark mode is handled in `src/styles/globals.css`, which redefines the `--color-*` variables under `.dark` (mirror shades, gray→zinc, white→`#101015`) for the color families the app uses — add a family there before using a new one. `nightwind/helper` still toggles the `.dark` class, and `nightwind-prevent`/`nightwind-prevent-block` keep an element's light colors. `prettier-plugin-tailwindcss` orders classes.

Profile UI lives in `src/components/profile/`: one card per section built on `ProfileSection` (draft state via `useDraft`, per-card Save), shared form controls in `fields.tsx` that reuse the existing filter/modal class strings, and `OnboardingModal` mounted in `Page.tsx` for signed-in users whose `onboardedAt` is null. Use `@heroicons/react` for icons — no emoji in the UI.

Path alias `~/*` → `apps/frontend/src/*`.

`src/components/finals/` contains a Python scraper (`scripts/generate-final.py`) whose output is committed as `finals.json` and imported directly — finals data does not come from the backend.

## Conventions

Prettier: 2 spaces, double quotes, semicolons, es5 trailing commas; 120 cols from the root `.prettierrc`, but `apps/frontend/src/.prettierrc` sets 80 cols for frontend source. Many existing frontend files predate the formatter — format files you create, but don't reformat untouched lines of existing files. The frontend eslint config downgrades the `@typescript-eslint/no-unsafe-*` family, `no-explicit-any`, `no-unused-vars`, and `react-hooks/rules-of-hooks` to warnings — warnings there are pre-existing noise, but don't add new ones.
