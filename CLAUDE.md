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
bun run test       # frontend only (jest) — e.g. `courseFilterPredicates`, `scheduleSharing`, `events`
bunx jest path/to/file.test.ts   # single test file
```

`packages/profile` has its own tests (`bun test` from that package): mapping, availability, careerProgress, requirements, scheduleGenerator, schema, social.

Prisma client generation lives in `packages/db` (`bun run db-generate`, `db-migrate` = `prisma db push`, `db-validate` = `prisma format`). Nx `targetDefaults` make `dev` and `build` depend on `^db-generate`, so the client is generated automatically for those; CI generates it explicitly before linting. If imports from `@cmucourses/db` fail to resolve, run `db-generate` first.

CI (`.github/workflows/lint.yml`, on PRs) = generate prisma client → eslint + `tsc --noEmit` for both apps. `next.config.mjs` sets `typescript.ignoreBuildErrors` and `eslint.ignoreDuringBuilds`, so a green `next build` proves nothing about types — run `tsc --noEmit` yourself.

## Environment

- Frontend: `NEXT_PUBLIC_BACKEND_URL` (no trailing slash), `NEXT_PUBLIC_PROFILE_BACKEND_URL` (backend serving `/user/profile`; falls back to `NEXT_PUBLIC_BACKEND_URL`, which has no profile routes when it points at the public API), `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`, Clerk publishable/secret keys.
- Backend: `MONGODB_URI` (read by `schema.prisma`), `PORT`, `AUTH_ENABLED`, `CLERK_PEM_KEY`, `BACKEND_ENV`, `CLERK_LOGIN_HOST`. `CLERK_PEM_KEY` must be the public key of the Clerk instance the frontend signs in with (derive it from `https://<frontendApi>/.well-known/jwks.json`); profile routes need it even when `AUTH_ENABLED=false`.
- Local profile development needs a MongoDB **replica set** (Atlas M0; Prisma rejects a standalone `mongod`) — `bun run db-migrate` to create the indexes. The course catalog lives only in ScottyLabs' production DB, not ours, so two setups are possible:
  - **`NEXT_PUBLIC_BACKEND_URL` on the public API** — courses come from ScottyLabs' deployed backend (always current), but it runs *their* code, so any query parameter this repo's backend adds (`classTimes`, the schedule filters) is silently ignored.
  - **`NEXT_PUBLIC_BACKEND_URL=http://localhost:3000`, catalog synced into our own Atlas** — `bun run catalog-sync -- --yes` (from the repo root, so it picks up `MONGODB_URI`; dry-run without `--yes` first) copies `courses`/`schedules`/`geneds` from the public API into our own database via `scripts/catalog/sync-atlas.mjs`, touching only those three collections — never `profiles`/`ratings`/anything else. After this, `bun run dev` alone exercises every backend change, with real profile data persisting across sessions. The catalog is a point-in-time snapshot; re-run after a new semester's schedules are published upstream. `scripts/local-catalog/start.sh` (a separate, in-memory, throwaway rig — see below) remains useful when you want a guaranteed-clean database or don't have Atlas access, but is no longer the *only* way to exercise a backend search change once the sync has been run once.
  - Atlas Network Access: if Profile 500s with `Server selection timeout` / `I/O error: timed out`, this machine's IP is not allowed (Atlas drops non-whitelisted clients; it looks like a hang, not 401). In Atlas → Network Access, add the current IP, or for a student/dev cluster use `0.0.0.0/0` (Allow Access from Anywhere) so home/campus/cafe all work. Also check the cluster is not paused. Separate from whitelist: **CMU campus Wi‑Fi often blocks outbound MongoDB (`:27017`)**, so even `0.0.0.0/0` still times out on campus — use a phone hotspot (or VPN) to confirm; that is a network firewall issue, not an Atlas pause/IP-list fix.
  - Known limitation, either setup: `POST /fces` on ScottyLabs' public API requires their production Clerk token, so a token from your *local* dev Clerk instance 401s (`CLERK_PEM_KEY` differs between instances) — that's why pointing at the public API leaves FCE cards / hrs-per-week empty. Pointing at our own backend doesn't fix this: `/fces` can't be synced the way courses can (still 401s, even to a script with no browser session), so our own `fces` collection is simply empty, and anything that reads it (FCE cards, hrs/week, the Instructors page, a Geneds row's FCE columns) is empty too, for a different reason but the same user-visible result. FCE queries skip retries on 401; `CourseCard` renders as soon as course info arrives. Signed-out rendering is unaffected either way. Work around it by testing signed-out for layout-only checks, or by reading the react-query cache / calling shared logic directly (e.g. `bun run` a script against `packages/profile`) when you need to confirm signed-in goal matching.
- `scripts/local-catalog/start.sh` runs this repo's own backend against a local **in-memory** MongoDB replica set seeded from the same cached catalog `catalog-sync` uses (`~/.cache/cmucourses-local-catalog`, shared between the two - first run of either downloads it, the other reuses it). One command, fully self-contained, and Ctrl+C tears everything down including the `mongod` child process, which does not die with its parent otherwise. Its profiles start empty every run - sign in and re-enter test data - and it never touches the real Atlas profiles `bun run dev` uses. `scripts/catalog/load.mjs` holds the page-parsing/ObjectId-conversion logic both this and `catalog-sync` share; don't duplicate it if you touch either.
- Production env comes from Doppler via `netlify.toml`.

## Architecture

### packages/db

`index.ts` constructs one `PrismaClient` as the default export and re-exports all of `@prisma/client`, so backend code does `import db, { Prisma } from "@cmucourses/db"`. Datasource is MongoDB. Models: `courses`, `fces`, `professors`, `schedules`, `geneds`, `profiles` (one document per Clerk user, sections as embedded composite types), plus `ratings`, `socialSchedules`, and `follows` for user-submitted ratings and Scotty Circles, with `@@fulltext` indexes on `courses` (name/department/desc/prereqString) and `professors.name`.

### packages/profile

Shared by both apps (TypeScript source; the frontend lists it in `transpilePackages`). `taxonomy/` holds the fixed career/skill/college/major/minor lists — an entry's `id` is stored in profiles, so never rename or remove one; change `label` or set `deprecated`. Majors are filtered by college (`majorsForCollege`); minors are not. `schema.ts` holds the zod `profilePatchSchema` (validation + normalization, e.g. course-ID standardization) and the wire `Profile` type — the backend validates requests with it and the frontend validates forms with it, so change rules here, not in either app.

`mapping/` is the career/skills-to-course data: `courseSkills.ts` is the one hand-curated fact (which skills a course teaches, checked against the live catalog), `careerSkills.ts` maps each career to core/supporting skills, and `index.ts` derives everything else (`skillsForCourse`, `careersForCourse`, `coursesForSkill`, `recommendCourses`) — never edit the derived data by hand. Precomputed indices shared across the derived functions (`courseSkillsIndex`, `isCareerID`, `CAREER_CORE_SKILLS`, the `coursesForSkill` reverse index) live in `mapping/internal.ts`, not `index.ts` itself: `index.ts` re-exports `careerProgress.ts` (`export * from`), so anything `careerProgress.ts` needs must come from `internal.ts` rather than `index.ts` or the two form a circular import. `careerProgress.ts` scores a profile's core-skill coverage per career (`careerProgress` for the student's own goals, `allCareerProgress` for browsing every career) — "skills you have" there means `skillsHave` plus skills implied by taken/in-progress courses, so a course counts even before the student manually adds its skill. `scripts/check-course-ids.ts` and `scripts/suggest-courses.ts` are manual, network-using maintenance tools (not run in CI); `check-course-ids.ts` also checks every course id referenced by `requirements/` (see below), and expects `95-867` to be reported missing. The frontend reads this in `CourseTags.tsx` (tags on every `CourseCard`), `pages/careers.tsx`, and the search page's "Match my goals" checkbox (`ui.matchGoals`): when on, the list is `recommendCourses` (all mapped courses that score against the profile), optionally narrowed by the search box, with client-side pagination — not a filter of the current API search page.

`requirements/` is hand-transcribed degree-requirement data, separate from `mapping/` because it's curated academic policy rather than derived career/skill data. `requirementsForMajor(majorID)` returns `null` for every major except `mism` — MISM is the only one with data because the user supplied the program handbook; don't assume other majors are covered. `degreeProgress(majorID, courses)` matches profile courses against a major's core requirements (including choice requirements with multiple `options`) and ranks fulfillment **TAKEN > IN_PROGRESS > PLANNED**; core units earned count only TAKEN. `requirements/mism.ts` documents a known gap: `95-867` ("Tech Strategy & Governance") is in the MISM handbook but does not exist anywhere in the live course catalog — it stays in the data and the frontend (`pages/requirements.tsx`) renders it with a "not in the course catalog" note rather than dropping it. Elective units aren't computed here (this package has no catalog access); the frontend sums catalog units of **TAKEN-only** courses that satisfy no core requirement, and elective suggestions likewise exclude planned courses.

`social.ts` is the shared Circles wire types/schemas (`publishedScheduleSchema`, follow/reaction inputs). The directory API (`controllers/social.ts`) returns `academicSummary` only when `profile.visibility.academic === "PUBLIC"`; otherwise that field is `null` even if academic data exists.

### apps/backend

Thin Express app. All routes are declared in `src/app.ts`; one controller file per resource in `src/controllers/`. Conventions:

- **Paired public/authenticated routes.** Endpoints that need auth are registered twice — `GET /x` and `POST /x` with the `isUser` middleware. The frontend calls the POST form with a Clerk JWT in the request *body* (`{ token }`), not an `Authorization` header. `isUser` (`controllers/user.ts`) verifies RS256 against `CLERK_PEM_KEY` and is a no-op unless `AUTH_ENABLED === "true"`. FCE data is the gated resource.
- **`requireUser`** (also `controllers/user.ts`) is for routes that act on the caller's own data: it always verifies the token (ignoring `AUTH_ENABLED`) and sets `res.locals.userId` to the token's `sub`. Never take a user id from the request body.
- **Profiles** (`controllers/profile.ts`): `POST /user/profile` reads (returns an empty default without writing), `PATCH /user/profile` with `{ token, profile }` validates against `profilePatchSchema` (400 with `issues` on failure) and upserts; each top-level section present replaces the stored one wholesale.
- **Typed handlers.** Each controller exports an interface with `params`/`resBody`/`reqBody`/`query` and uses it to parameterize `RequestHandler`. Response types are derived from Prisma via the `PrismaReturn`/`ElemType` helpers in `src/util.ts` rather than hand-written.
- **Errors** are forwarded with `next(e)` to a single error handler that 500s with the error JSON.
- **`getFilteredCourses` builds a raw MongoDB aggregation pipeline** (`db.courses.aggregateRaw`) because Prisma lacks MongoDB full-text search. It layers `$match` (text/department/level regex), `$addFields` + `$match` for a units range coerced from the string `units` field, an optional `$lookup` of `schedules`, then schedule predicates that must all hold for the *same* schedule document (session, `classTimes`, `meetingDays`, and optional `timeBegin`/`timeEnd` minutes-from-midnight window via `$expr` — applied separately they'd wrongly match a course whose morning lecture and target semester are in different terms), then `$facet` for pagination. Page size is capped at `MAX_LIMIT = 10`. The `$lookup` is forced on whenever `session`, `classTimes`, `meetingDays`, or a time window is present, not only when the caller asks for `schedules=true` — without it those filters silently match nothing. `classTimes` buckets (`morning`/`afternoon`/`evening`/`tba`) are matched by regex on the stored `"HH:MMAM"`/`"HH:MMPM"` string, since Mongo can't order those lexicographically; the four patterns are `CLASS_TIME_PATTERNS` in `courses.ts`. `meetingDays` matches any selected weekday on lecture/section `times.days`. There is no modality filter — the catalog has no reliable modality field (see `ROADMAP.md`).
- **`GET /courses/all` is served from a module-level cache** in `controllers/courses.ts` (`allCoursesEntry`), refreshed on a 24-hour TTL check.
- `standardizeID` in `src/util.ts` normalizes `"15122"` → `"15-122"`; apply it to any user-supplied course ID before querying.
- Path alias `~/*` → `apps/backend/src/*`. ESM (`"type": "module"`), run and bundled by Bun.

### apps/frontend

Next.js 15, **Pages Router**. Routes live in `src/pages/` (`index`, `search`, `saved`, `schedules`, `geneds`, `finals`, `instructors`, `profile`, `careers`, `requirements`, `circles`, plus dynamic `course/[courseID]`, `instructor/[name]`, `schedules/shared`). `search.tsx` is not the search page — it's a redirect shim to `/` for a `?q=` query param; `index.tsx` is the real search page. `careers.tsx` and `requirements.tsx` render `@cmucourses/profile`'s `careerProgress`/`allCareerProgress` and `degreeProgress` respectively; both are registered in `SideNav.tsx` and follow the `profile.tsx` idiom (auth branching inside a content component, not the `NextPage` itself). `circles.tsx` is the Scotty Circles directory (public profiles, published schedules, follow/react).

**`src/app/` is not the App Router.** It is the shared client-logic layer: Redux slices, the react-query API layer, and domain helpers. `src/app/layout.tsx` is an unused leftover Next scaffold stub — providers actually live in `src/pages/_app.tsx` (QueryClientProvider → PostHog → Clerk → redux `Provider` → `PersistGate`). Don't treat files in `src/app/` as server components.

Two state systems, split by ownership:

- **Server data → `src/app/api/*.ts`.** One module per resource exporting `useFetch*` react-query hooks. Multi-item fetches go through `@yornaath/batshit` batchers (`create` + `keyResolver` + `windowScheduler(10)`) so per-card `useFetchCourseInfo(courseID)` calls coalesce into one request. `STALE_TIME` is 1 day. Authenticated fetchers take Clerk's `getToken` and are `memoize`d over `(isSignedIn, getToken)`.
- **User/UI state → Redux Toolkit slices** in `src/app/` (`user`, `filters`, `ui`, `userSchedules`, `instructors`, `finals`), combined in `store.ts`. Each slice is individually wrapped in `persistReducer` with its own key and `autoMergeLevel2`, so adding a slice means adding its persist config too. Server-owned user data (the profile) does **not** go here — it lives in react-query (`src/app/api/profile.ts`) so it isn't duplicated in localStorage or leaked across accounts. Use the typed `useAppSelector`/`useAppDispatch` from `src/app/hooks.ts`. Search inputs dispatch through the debounced `throttledFilter`/`throttledInstructorFilter` exported from `store.ts`.

The filters slice is the query key for course search: `useFetchCourseInfosByPage` serializes the whole `FiltersState` into URL params, so filter shape changes must be mirrored in both `src/app/api/course.ts` and the backend's `GetFilteredCourses` query type.

FCE aggregation math (weighting by `numRespondents`, dropping zero-response-rate entries, semester counting) lives client-side in `src/app/fce.ts`.

`components/filters/ClassTimesFilter.tsx` is the morning/afternoon/evening/"time not set" filter; `components/filters/AdvancedScheduleFilter.tsx` adds meeting-days and a clock time-window (`timeBegin`/`timeEnd`), plus the client-side "fit my availability" highlight toggle — all schedule filters that hit the API are matched server-side (see `getFilteredCourses` above). Empty selected sets should flip the matching `active` flag off in the filters slice so stale empty filters don't keep searching. There is no modality UI. `app/availability.ts` + `components/AvailabilityBadge.tsx` compare a course's most recent schedule against `profile.busyBlocks` and render a fit/conflict badge on `CourseCard`; the actual overlap math (`parseCatalogTime`, `availabilityFit`, `meetingGroupsFor` — preferring lecture times but falling back to section times, since only ~17% of the catalog puts real times on lectures vs. ~61% on sections) lives in `packages/profile/availability.ts` so it's shared with anything else that needs it (including the V3 schedule generator).

Styling is Tailwind v4 via `@tailwindcss/postcss`, using **Tailwind's default palette**: `globals.css` has no `@config`, so `tailwind.config.ts` (its custom `colors`, `animation`, and the `nightwind` plugin) is not loaded — nightwind can't run under v4 anyway. Write light-mode classes only; dark mode is handled in `src/styles/globals.css`, which redefines the `--color-*` variables under `.dark` (mirror shades, gray→zinc, white→`#101015`) for the color families the app uses — add a family there before using a new one. `nightwind/helper` still toggles the `.dark` class, and `nightwind-prevent`/`nightwind-prevent-block` keep an element's light colors. `prettier-plugin-tailwindcss` orders classes. **Always give text an explicit `text-gray-N` (or other family) class** — nightwind only inverts classes it recognizes, so text left to inherit its color from an ancestor (e.g. a `<Link>` or `<span>` with no color class) renders unreadably dark-on-dark in dark mode instead of being flipped.

Profile UI lives in `src/components/profile/`: one card per section built on `ProfileSection` (draft state via `useDraft`, per-card Save), shared form controls in `fields.tsx` that reuse the existing filter/modal class strings, and `OnboardingModal` mounted in `Page.tsx` for signed-in users whose `onboardedAt` is null. `fields.tsx`'s `TaxonomyMultiSelect` takes an opt-in `closeOnSelect` prop (default off) that closes the dropdown after each pick by simulating Escape on the underlying input — Headless UI's `Combobox` has no `close()` render prop and doesn't close on programmatic `blur()`, unlike `Listbox`/`Menu`/`Popover`. Only Majors/Minors turn it on; Skills reuses the same component for picking up to `LIMITS.skills` (30) in a row, where auto-closing after each pick would be a regression. Use `@heroicons/react` for icons — no emoji in the UI. `components/ProgressBar.tsx` is the shared labeled progress bar (used by `careers.tsx`/`requirements.tsx`); it's the only one in the app — reuse it rather than building another.

Path alias `~/*` → `apps/frontend/src/*`.

`src/components/finals/` contains a Python scraper (`scripts/generate-final.py`) whose output is committed as `finals.json` and imported directly — finals data does not come from the backend.

## Conventions

Prettier: 2 spaces, double quotes, semicolons, es5 trailing commas; 120 cols from the root `.prettierrc`, but `apps/frontend/src/.prettierrc` sets 80 cols for frontend source. Many existing frontend files predate the formatter — format files you create, but don't reformat untouched lines of existing files. The frontend eslint config downgrades the `@typescript-eslint/no-unsafe-*` family, `no-explicit-any`, `no-unused-vars`, and `react-hooks/rules-of-hooks` to warnings — warnings there are pre-existing noise, but don't add new ones.
