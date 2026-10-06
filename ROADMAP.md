# Roadmap

The team's feature plan, sourced from the Mural feature decomposition board. Version tags (V1-V4) mirror the Mural Features Decomposition board; section names follow the Mural cards as closely as possible so this file can be cross-referenced directly against the board.

> **Status, 2026-10-03.** Every item below is built except the two filter cards marked **Not applicable** (modality and mini), which the catalog cannot support. The 2026-10-02 round (see "Mural round 2026-10-02" below) was verified by unit tests (profile 192, backend 156, frontend 137), by running the changed queries against a real local MongoDB replica set, by production builds of both apps, and in a signed-in browser against the real Atlas database on 2026-10-03 (two real accounts for the friend features). Atlas has the `kind` migration and the new post index.

## Vision

Course directory navigator: help students build the schedule that best fits their own profile.

## V1

### Course Search & Filters — Done (base built by cloning the existing ScottyLabs site)

Done:
- Department dropdown
- Course Level dropdown (undergrad/grad)
- Unit slider (0-24)
- Offered in dropdown — semesters, plus Summer One / Two / All. A **mini** option is not applicable; see "Why there is no mini filter" below

Also done (the first two were sitting in the Mural board's Done column with no implementation; Sprint Review deducts 1 point for anything in Done that turns out not to be done):
- [x] Restrict results to morning/afternoon/evening sections — the **Class Times** filter (`ClassTimesFilter.tsx`), matched server-side in the search aggregation
- [x] Sort or highlight results by best fit against saved availability — implemented as **highlight**: an availability badge on every course card, comparing `profile.busyBlocks` against the course's lecture times (`packages/profile/availability.ts`)
- [x] Only courses that fit my availability — a checkbox in the schedule filters, decided **on the backend** so every page is full and the page count is right (`fitAvailabilityStage`, `apps/backend/src/controllers/courseQuery.ts`); Match-my-goals lists, which never call `/search`, keep the client-side check
- [x] Filter by summer sub-session (Summer One / Two / All) — the catalog records them; a chosen sub-session matches only itself and a plain Summer matches all of them
- [ ] ~~Modality filter (in-person/online/hybrid), which would override the profile's default~~ — **Not applicable: the catalog has no modality data** (decision 2026-09-23, re-measured 2026-10-02). This card should leave the Done column. See below.
- [ ] ~~Mini semester filter~~ — **Not applicable: the catalog has no mini field for fall or spring** (decision 2026-09-23); see below.

#### Why there is no modality filter

The catalog has no modality field, and the only proxies (a meeting's building, room and location) are empty for every current term. Measured 2026-10-02 on the cached catalog (snapshot of 2026-09-19) with `node scripts/catalog/measure-modality.mjs`:

| Term | Meeting times | With building | With room | With location | Remote-like | DNM |
| --- | --- | --- | --- | --- | --- | --- |
| Fall 2024 | 8,607 | 6,121 | 4,481 | 0 | 141 | 1,781 |
| Spring 2025 | 8,417 | 5,761 | 4,195 | 0 | 99 | 1,665 |
| Fall 2025 | 8,147 | 238 | 171 | 0 | 6 | 73 |
| Spring 2026 | 7,894 | 0 | 0 | 0 | 0 | 0 |
| Fall 2026 | 8,122 | 0 | 0 | 0 | 0 | 0 |

A filter built on these would return nothing for the terms students browse. The **profile's modality preference** is kept (stored, editable) but has no effect: the generator's `inferredModality` returns null for every 2026 meeting, so the preference never changes a score. Since 2026-10-02 the Profile says so under the control ("Saved for later…") and the Time & format section counts as complete with busy times instead of a modality. The "Time not set" Class Times option (`begin` is `TBA` in about half of Fall 2026) is what the data does support.

#### Why there is no mini filter

Measured against the catalog (`schedules` collection, 2026-09-23, ~48.8k schedule documents): fall and spring documents carry **no `session` value at all**, so CMU's Mini 1-4 cannot be told apart from a full semester. Only summer has sub-terms (`summer one` 545, `summer two` 802, `summer all` 1581, `qatar summer` 120, unset 310). A mini filter is not possible until the upstream data carries one.

#### V1 filter fixes (from the 2026-09-23 audit)

- **Time-window filter was broken and is fixed.** `timeBegin`/`timeEnd` returned HTTP 500 against any catalog containing `TBA` times (about half of Fall 2026): `catalogTimeToMinutes` ran `$toInt` on `"TB"` even when its regex guard rejected the value. It now converts with `onError: null`. The window also matched a course if *any single* meeting entry fit; it now requires a fitting lecture and a fitting section (each kind that states times), with TBA entries neutral. Checked against a local copy of the catalog by comparing the API to an independent JS implementation of that rule for three windows on Fall 2026 (592/592, 1051/1051 and 2415/2415 courses agree; the old rule admitted 135, 185 and 31 extra courses).
- **"Only courses that fit my availability" moved to the backend.** It used to filter one results page in the browser, so a page could come back short and `totalDocs` counted hidden courses. The browser now sends the busy blocks (`busy=day,begin,end`, repeated) and the aggregation applies the same rule as the client (`courseMatchesClientFilters` / `availabilityFit`): the chosen Offered-in schedules or only the most recent offering, lectures if any lecture states a time and sections otherwise, at least one stated time and no overlap. Checked against a real local catalog (923 courses, 5,903 schedules) by comparing the API with the frontend's own predicate as the oracle: 16 configurations, with and without Offered-in and for each 2025 summer sub-session, all returned identical course sets and `totalDocs`.

### Student Profiles & Preferences — Done

> Implemented on branch `feature/student-profile`; design in `docs/superpowers/specs/2026-09-11-student-profile-design.md`. Sign-in reuses Clerk — no separate account system. Beyond the items below, this also added career goals, skills, course load, per-section public/private visibility, and first-login onboarding.

- [x] Account creation (reuses Clerk sign-in)
- [x] Set a default modality preference — stored and editable, but **no effect** until the catalog has modality data (see "Why there is no modality filter"); the Profile says so
- [x] Set recurring weekly busy times (= availability)
- [x] Edit availability at any time
- [x] Edit profile/preferences at any time
- [x] Preferences persist across sessions
- [x] Record completed / in-progress courses
- [x] (Optional) Save a default filter set as the homepage — the search sidebar has **Save as default**, **Use my default** and **Clear default** (signed in only). Stored on the profile as `savedFilters` (private to the student, never in social output): departments, units range, semesters incl. sub-sessions, course levels, class times, meeting days, time window, fit-availability and match-my-goals. Search text and page are not kept. It is applied once per browser tab session when the search page opens

## V2

### Career Path & Skills Navigator — Done

> Merged into `main`. Design in `docs/superpowers/specs/2026-09-14-career-skills-mapping-and-audit.md`. The course-to-skill and skill-to-career mapping is hand-curated static data (`packages/profile/mapping/`); which careers a course serves is derived from skill overlap, so no new DB or API was needed. The first pass covers about 94 courses and still needs team review and expansion. "Match my goals" uses `recommendCourses` to list courses that match the profile; it can be narrowed further with the search box and doesn't block normal search.
>
> "Skills you have" throughout this section means `profile.skillsHave` plus skills implied by courses marked taken/in-progress (`skillsForCourse` on each) — taking 15-213 counts as having `systems-programming` without re-declaring it, per `careerProgress()` in `packages/profile/mapping/careerProgress.ts`.

**Career Goals**
- [x] Select career goals (Profile's Career goals — up to 3, ranked by priority)
- [x] Explore career paths — new `/careers` page: browse every career's core/supporting skills, with your own skills and goals highlighted (`allCareerProgress`)
- [x] Save career interests

**Skills Mapping**
- [x] Map courses to the skills they teach (`skillsForCourse`)
- [x] Map which skills each career needs (`careerSkills.ts`)
- [x] Show skill/career tags on course cards (search, Saved, course detail pages)
- [x] Recommend electives toward career goals (`recommendCourses` + the search page's "Match my goals")
- [x] Identify skill gaps — `/careers` "Your progress": each target career shows a core-skill progress bar, covered skills, and gap skills with up to 3 suggested courses per gap (`coursesForSkill`, the reverse of `skillsForCourse`)
- [x] Track skill progress — the same computation as skill gaps, shown as `coreCovered / coreTotal` per career; building these separately would have duplicated the logic

**Academic Path**
- [x] Balance degree requirements against career goals — **MISM only, by decision (2026-09-23): no other major will be added for now.** New `/requirements` page tracks the 13 core requirements from the MISM program handbook (`packages/profile/requirements/mism.ts`) against courses taken/in-progress, plus elective-unit progress and elective suggestions filtered by career goals (`recommendCourses`, excluding anything that already satisfies a core requirement). No other major's requirements have been transcribed yet — `requirementsForMajor` returns `null` for everything else, and the page says so rather than showing an empty shell.
  - `95-867` ("Tech Strategy & Governance"), listed in the MISM handbook, does not exist anywhere in the live course catalog (checked against the full ~8,400-course catalog, 2026-09-19). It stays in the requirement data and renders normally, marked "not in the course catalog" with no course link — see `requirements/mism.ts` for detail. `scripts/check-course-ids.ts` checks for this on every run and expects exactly this one miss.
- [x] Plan courses across semesters — moved to V3 (Personalized Schedule Builder), where it is done
- [x] Explore alternative academic paths — moved to V3, where its status is tracked

## V3

### Personalized Schedule Builder — Done

> Updated 2026-09-18 to match the latest Mural Features Decomposition board: "Apply career & skill goals" was added under Generate, and "Generate alternative options" was removed from Finalize (the team's Product Backlog board still lists the old version under V3 — the two boards are out of sync with each other, not something this file needs to track). Updated 2026-09-19: "Plan courses across semesters" and "Explore alternative academic paths" moved here from V2's Academic Path — both are the same multi-semester planning surface this builder needs, so building them separately would have meant doing the work twice.
>
> Generator logic lives in `packages/profile/scheduleGenerator.ts`, unit-tested and wired into `/schedules` as a new Generate panel. It reuses `availabilityFit` (`packages/profile/availability.ts`, V1) to judge each pick against `busyBlocks` (the lecture × section options and course-to-course overlap check are its own `optionsFor`/`timePairOverlaps`; `meetingGroupsFor` is used by the search-side badge and filters, not here) and the same core/supporting/want weighting as `recommendCourses` (V2) for career/skill scoring — no overlap math or scoring rules were re-derived. **Scope decision:** the required courses are the ones the student adds manually (reusing the existing `ScheduleSearch` picker), not auto-selected from filters; an optional **pool** of Saved and planned courses can be added for the generator to choose from (below); and generated schedules stay client-side in the existing `userSchedules` slice (localStorage) rather than a new backend model, since the manual builder already only saves locally.

**Generate**
- [x] Generate 1-3 personalized schedules — `generateSchedules`, beam-pruned so it stays fast without a full cartesian product over sections
- [x] Apply availability constraints — scored against `profile.busyBlocks`; a conflicting course is still scheduled (never silently dropped) but flagged and penalized in the ranking
- [x] Apply saved course preferences during generation — the Generate panel can pool the student's **Saved courses** and/or the courses **planned for the selected semester** (any summer sub-session picks up a planned summer, at most 12 pooled). The generator (`optionalCourses`) then chooses which of them to add so the total fits the units range: it never passes the maximum, a pool course that clashes is simply left out, a locked pool course counts as required, and with no units range it adds every pool course that fits and says so. "Use this schedule" adds the chosen ones to the schedule
- [x] Apply career & skill goals during generation

**Compare & Refine**
- [x] Compare schedule options — up to 3 candidates shown with a score breakdown (availability / workload / career fit)
- [x] See why each schedule was recommended — per-candidate `reasons` text (time conflicts, unit-range fit, skills it builds toward)
- [x] Adjust course preferences and regenerate based on changes — each pick on a candidate can be **locked** (kept on the next run) or **excluded** (never chosen), shown as removable chips above a **Regenerate** button; the panel also takes an option count (1-3) and a units range for this run only. Locks and exclusions live in the panel's component state (not saved to the profile or Redux) and are cleared when the semester changes. No new preference types were added: "course preferences" here means which sections to keep or rule out, not a saved preference profile

**Finalize**
- [x] Select a preferred schedule — "Use this schedule" fills the builder's lecture/section picks and marks the card "In use". Since 2026-09-25 it changes only the courses it placed (it used to blank the rest, which vanished from the calendar), offers sections-only courses, waits for course data, and a reload no longer resets the semester
- [x] Save chosen schedule — named schedules saved **to the account** ("My saved schedules" on /schedules: save, update, open, rename, delete; 20 per account). These are what Circles shares. The builder's working copy stays in the browser but is now per account
- [x] Export/share schedule — the Copy link button builds `/schedules/shared?data=...` (the schedule encoded in the URL; `?courses=...` is only accepted as a fallback), and an **Export .ics** button downloads a calendar file (`buildScheduleICS` in `apps/frontend/src/app/scheduleSharing.ts`, tested)
- [x] Plan courses across semesters (moved from V2's Academic Path) — Profile's "Future course plan" and `/requirements` show one block per semester in calendar order, with each course's units, a total, and how it sits against the profile's units range (`groupPlanBySemester`, `packages/profile/plan.ts`). Variable-unit courses are listed but not counted, and the line says so. The same course can be planned in two semesters (the picker used to hide it). **Limits:** the workload check is units only (hours per week need FCE data, unavailable without a production sign-in), and a semester's actual meeting times are checked by the schedule builder, not by the plan
- [x] Explore alternative academic paths (moved from V2's Academic Path) — `/careers` "Alternative academic paths" (`AlternativeAcademicPaths`): up to 3 course bundles that each take a different suggested course for every skill gap. Skill-gap based; it does not consider degree requirements

### Course & Professor Insights — Done

> Mural doesn't tag this with a version number; placed here (after Personalized Schedule Builder, before Scotty Circles) for now. Updated 2026-09-20: implemented as genuine user-submitted ratings (new `ratings` model in `packages/db/schema.prisma`, one row per user per course/instructor) rather than the originally-planned FCE-derived or dummy data — closer to what "rate a completed course" / "leave written feedback" actually call for. Validation (`ratingPatchSchema`) lives in `packages/profile/schema.ts` and is shared by both apps, same convention as the profile patch schema. Both course and instructor ratings are gated server-side on `profile.courses` having a matching `TAKEN` entry (an instructor rating additionally cross-checks `schedules.instructors` for that course, since professors have no stable id anywhere in this codebase — only free-text names).

**Course Insights**
- [x] View course ratings — average stars + count on the course page's new Ratings card
- [x] Read student feedback — written comments listed
- [x] "What I wish I knew before taking this course" — dedicated course-only field

**Professor Insights**
- [x] View professor ratings — same Ratings card, keyed by instructor name, on the instructor page
- [x] Read professor feedback

**Contribute**
- [x] Rate a completed course — blocked unless the course is marked Taken on your profile
- [x] Rate a professor — blocked unless you have a Taken course that instructor taught
- [x] Leave written feedback — the comment field on either rating type
- [x] Aggregate workload/grading-fairness/transparency stats — the rating form takes three optional 1-5 answers next to the stars, and the ratings card shows each average over only the ratings that answered it (or "No data yet"). Workload is asked for courses only (1 light, 5 heavy) and the backend drops it from instructor ratings; grading fairness and transparency apply to both. These are student-submitted, separate from the FCE data, so they start empty and grow as students rate

## V4

### Scotty Circles — Done

> Updated 2026-09-20: built ahead of V1-V3. Completed 2026-09-23 together with the remaining V1-V3 gaps. A directory of
> other students' public profiles, publishing your active schedule to it, following other
> students, and emoji reactions on a followed schedule (`packages/profile/social.ts`,
> `apps/frontend/src/pages/circles.tsx`). The directory highlights courses and
> careers/skills you share with each person (`ProfileCard` in `circles.tsx`).

- [x] Schedule sharing — **one post per student per semester** (`circlePosts`), copied from a
  schedule saved on the account; sharing another schedule for that semester replaces the post. Each
  post shows the schedule as a Mon–Fri week grid, the author's busy times on the same grid (what each
  is for only if the author sets it Public in Profile › Time & format), their public profile
  details, the courses with units, courses you share, reactions and comments (2026-09-25)
- [x] Feed — Circles is Feed / People / Messages; the feed scrolls newest-first and loads more as you
  go, filterable to Everyone / Following / My posts
- [x] Social connections — follow, with the state spelled out: Follow / Following / Follow back /
  Connected, plus "Follows you". Circles warns you when nobody can find you yet
- [x] Reactions and comments — on a post, for followers of its author (reactions had no checks at
  all before 2026-09-23). The author of a comment, or of the post, can delete it
- [x] Direct messages — between mutual follows, in a Messenger-style panel (chat list, bubbles, Enter
  to send, auto-scroll, "Sending…" / "Not sent · Retry"), polled rather than pushed. The 2026-09-25
  rework fixed why two real accounts could not message: invisible profiles, a directory that never
  refreshed, one-way follows labelled "Connected", Message doing nothing visible, hidden errors, and
  caches shared between accounts in one browser
- [x] Share planned schedule / Share actual schedule (2026-10-02) — a post is **Planned** or **Actual** (`circlePosts.kind`), one of each per student per semester; Share asks which, posts show a badge, and the feed filters by it. Existing posts become Actual through `bun run migrate-post-kind` (must run before `db-migrate`; see below)
- [x] See friends taking the same course (2026-10-02) — a course page's "Friends in this course" card lists the people you follow who are taking or planning it, with how (taking now, planning for a term, on their planned/actual post)
- [x] Discover courses through friends (2026-10-02) — Circles' **Courses** tab lists what the people you follow are taking or planning that is not on your profile yet, most friends first
  - Both read `POST /social/friend-courses`. "Friend" = someone you follow. Their in-progress and planned courses count only if their **Courses** section is public (the same rule the directory already used); their Circles posts always count (followers can read them anyway). Only the current term or later counts, and taken courses never do
- Demo data: `bun run demo-seed` (dry run first; `--yes`, `--with-real-users`, `--remove`,
  `--migrate-old`) fills Circles with fake `demo_` students

## Mural round 2026-10-02

Branch `fix/mural-round-2026-10`, one commit per item.

| Item | Status | How it was verified |
| --- | --- | --- |
| Rate limiting (tech debt) | Done | Unit tests (per-user keys, cache TTL); curl loop on a local backend: at the then-limit of 300, request 301 → 429 with `Retry-After` (since raised to 1000, see below); in the browser the "Too many requests" message shows. **Not checked on the deployment**: assumes one instance and one proxy hop |
| Course filter input validation (tech debt) | Done | 34 unit tests (malicious inputs, every parameter shape the frontend sends); 12 frontend query shapes against the local catalog return the same `totalDocs` and first results as `main`; malicious inputs → 400 |
| SSO failure handling (tech debt) | Done for the agreed cases (missing / expired / not-yet-valid token) | 23 unit tests with real RS256 tokens; curl shows the new `{ error, code }` 401s; browser: with a wrong `CLERK_PEM_KEY` the Profile shows the reason at once. "Sign in again" signs out, then opens sign-in (browser, 2026-10-06) |
| Remove ScottyLabs redirect | Done | `GET /?__clerk_status=verified` answers 200, no redirect; browser: sign out and back in stays on the site |
| Detect time conflicts | Done | 8 jest + 5 profile tests; **browser-checked** on /schedules (count, "Conflicts with …" lines, "(conflicts)" options; nothing blocked) |
| Share planned / actual | Done | Unit tests; local replica set: `main` schema + old posts → migration → `db push` → both kinds coexist, re-share replaces, kind filter. **Atlas**: 19 posts migrated to ACTUAL, index `circlePosts_authorUserId_semester_year_kind_key`; browser: old posts show Actual, Planned and Actual coexist |
| See friends taking a course | Done | Unit tests; local replica set: private in-progress course hidden, no Clerk id returned; browser with two real accounts: reasons shown, and switching Courses to Private removes "Taking now" / "Planning for" |
| Discover courses through friends | Done | Jest for ranking/exclusion; browser with two real accounts |
| Modality | Card not applicable; Profile labelled | Measured (table above); completeness test; browser shows the note |

Details:
- **Search validation.** `/courses/search` runs every query parameter through `searchQuerySchema` (`apps/backend/src/controllers/courseQuery.ts`); invalid input is a 400 with `issues`, unknown keys are ignored. Before this, `levels` went into a MongoDB regex unescaped, `levels[$ne]=1` reached the pipeline as an operator, and `?page=abc` **crashed the whole backend process** (the parse threw outside the `try`).
- **Rate limits** (`apps/backend/src/rateLimit.ts`): every route 1000 requests/min per IP (raised from 300 before the demo: a room of students behind one campus NAT shares an IP); routes that verify a token 120/min per user (token subject, else IP). The plan said 60, but polling alone (thread 5s, conversations 15s, feed head 30s) is ~18/min per tab and tabs share the budget. Counters are in memory, so per instance. Sign-in itself is Clerk's: 3 attempts per 10s per IP and a 1-hour lockout after 10 failures by default ([rate limits](https://clerk.com/docs/guides/how-clerk-works/system-limits), [user lockout](https://clerk.com/docs/guides/secure/user-lockout)). The CMU-email answer from Clerk is cached 5 minutes per user, because Clerk's Backend API allows 1000 requests/10s for the whole production app.
- **Sign-in errors.** `verifyUserToken` throws `AuthError` with a code; both middlewares answer 401 `{ error, code }`. The old manual `exp`/`nbf` checks could never run (jsonwebtoken throws first) and `isUser` sent an Error that serialized to `{}`. The frontend no longer retries a 401/429 and shows the reason with "Sign in again" on Profile, Careers, Requirements, Circles (feed, people, share) and saved schedules. A Clerk outage is still a 401 (code `auth_service_error`), not a 503; azp mismatch and non-CMU accounts are tested but not changed.
- **Fixed in the final review (2026-10-03):** "Sign in again" now signs the stale Clerk session out before opening sign-in. Clerk will not open sign-in while a session exists (single-session mode; in development it throws), and in this app the backend refuses tokens Clerk still holds. Browser-checked 2026-10-06.
- **Not done in this round:** other handlers may also throw outside a `try` and crash the process the way `/courses/search` did; not audited.

## Known limitations (2026-09-23)

- **UX fix round (2026-09-27).** Landed: Circles (feed load-more errors, Share card on phones, inline confirms for deleting posts/comments/saved schedules and a mutual unfollow, Messages unread count, message retry and scroll, Back closes a thread, week-grid overlaps and unplaced courses), Schedules (applying a generated option keeps the options and swaps earlier pool picks; saved-schedule rename/delete/stale-id fixes), Search (empty/error states, Offered-in from the current year, Match my goals filtered before paging, schedule-filter pills), Profile (header badges, busy-label switch beside busy times, 00:00 latest end saves, phone widths), and loading/error/variable-unit fixes on Careers, Requirements and Ratings. Verified by unit tests and `tsc` only — **no browser check yet** for this round (the automation Chrome tab would not load Clerk); an earlier partial browser check on 2026-09-23 covered the pre-fix flows.
- **Backend tests** (`bun test` in `apps/backend`, 72) mock the database, so they prove what a handler asks for, not that MongoDB accepts it; every query added this round was also run against a real local replica set, which found two bugs a mock cannot (Prisma's `readAt: null` does not match a missing field, so unread counts were always 0). Not covered by any automated test: the search aggregation itself (verified by comparison against the client, not in CI) and FCE. Token verification has tests since 2026-10-02.
- Messages are polled, not pushed. Conversation lists scan the latest 1,000 messages, threads show the latest 100, comments the latest 200, the directory the first 100 profiles.
- The semester plan checks units only, not hours per week; requirements exist for MISM only; the generator pool holds at most 12 courses.
- Modality and mini filters will not be built (decided 2026-10-03): the catalog data does not exist.

## Browser checks

Every item of the 2026-10-02 round has been checked in a signed-in browser; the last one, "Sign in again" (signs out, then opens sign-in), on 2026-10-06.
