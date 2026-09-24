# Roadmap

The team's feature plan, sourced from the Mural feature decomposition board. Version tags (V1-V4) mirror the Mural Features Decomposition board; section names follow the Mural cards as closely as possible so this file can be cross-referenced directly against the board.

> **Status, 2026-09-23.** Every item below is built, or marked **not applicable** or **out of scope** with the reason. This round was verified by unit tests (profile 168, backend 72, frontend 48) and by running the real handlers and search queries against a real local MongoDB replica set. **The UI was not exercised in a browser** — the dev environment here has no Clerk keys — so the visual behaviour of the new screens is untested; see "Known limitations" at the end.

## Vision

Course directory navigator: help students build the schedule that best fits their own profile.

## V1

### Course Search & Filters — Done, apart from two cards the data cannot support (base built by cloning the existing ScottyLabs site)

Done:
- Department dropdown
- Course Level dropdown (undergrad/grad)
- Unit slider (0-24)
- Offered in dropdown — semesters, plus Summer One / Two / All. A **mini** option is not applicable; see "Why there is no mini filter" below

Also done (these three were sitting in the Mural board's Done column with no implementation; Sprint Review deducts 1 point for anything in Done that turns out not to be done):
- [x] Restrict results to morning/afternoon/evening sections — the **Class Times** filter (`ClassTimesFilter.tsx`), matched server-side in the search aggregation
- [x] Sort or highlight results by best fit against saved availability — implemented as **highlight**: an availability badge on every course card, comparing `profile.busyBlocks` against the course's lecture times (`packages/profile/availability.ts`)
- [x] Only courses that fit my availability — a checkbox in the schedule filters, decided **on the backend** so every page is full and the page count is right (`fitAvailabilityStage`, `apps/backend/src/controllers/courseQuery.ts`); Match-my-goals lists, which never call `/search`, keep the client-side check
- [x] Filter by summer sub-session (Summer One / Two / All) — the catalog records them; a chosen sub-session matches only itself and a plain Summer matches all of them
- [ ] ~~Modality filter (in-person/online/hybrid), which would override the profile's default~~ — **Not applicable: the catalog has no modality field** (decision 2026-09-23). This card should not be in Done. Replaced by the "Time not set" option in the Class Times filter.
- [ ] ~~Mini semester filter~~ — **Not applicable: the catalog has no mini field for fall or spring** (decision 2026-09-23); see below.

#### Why the modality filter was replaced

The course catalog has no modality field, and the nearest proxies are dead for current terms. Measured against the live catalog (`https://course.apis.scottylabs.org/courses/search?schedules=true`, ~390-course sample):

| Signal | Fall 2020 | Spring 2025 | Fall 2026 |
| --- | --- | --- | --- |
| `room: "CMU REMOTE"` | 171 | 3 | 0 |
| `building: "DNM"` | 64 | 198 | 0 |
| `building` empty/null | 266 | 122 | 673 / 673 (100%) |

`CMU REMOTE` is a COVID-era artifact that stops after 2021; `DNM` stops after Spring 2025; for Spring/Fall 2026 every time entry has an empty building. `location` holds a city (`Pittsburgh, Pennsylvania`, `Doha, Qatar`, `Los Angeles, California`), not a delivery mode. Any modality filter inferred from these fields would return zero results for exactly the terms students browse.

What the data *does* support is whether a course has a stated meeting time at all: `begin` is the literal string `"TBA"` in ~54% of Fall 2026 time entries. That is shipped as the fourth Class Times option, so students can still isolate courses with no fixed meeting time. `profile.modality` remains stored and unused until the upstream ScottyLabs data carries a modality field.

#### Why there is no mini filter

Measured against the catalog (`schedules` collection, 2026-09-23, ~48.8k schedule documents): fall and spring documents carry **no `session` value at all**, so CMU's Mini 1-4 cannot be told apart from a full semester. Only summer has sub-terms (`summer one` 545, `summer two` 802, `summer all` 1581, `qatar summer` 120, unset 310). The summer sub-terms are now filterable (Offered in lists Summer One / Two / All beside each Summer). A mini filter is not possible until the upstream data carries one.

#### V1 filter fixes (from the 2026-09-23 audit)

- **Time-window filter was broken and is fixed.** `timeBegin`/`timeEnd` returned HTTP 500 against any catalog containing `TBA` times (about half of Fall 2026): `catalogTimeToMinutes` ran `$toInt` on `"TB"` even when its regex guard rejected the value. It now converts with `onError: null`. The window also matched a course if *any single* meeting entry fit; it now requires a fitting lecture and a fitting section (each kind that states times), with TBA entries neutral. Checked against a local copy of the catalog by comparing the API to an independent JS implementation of that rule for three windows on Fall 2026 (592/592, 1051/1051 and 2415/2415 courses agree; the old rule admitted 135, 185 and 31 extra courses).
- **"Only courses that fit my availability" moved to the backend.** It used to filter one results page in the browser, so a page could come back short and `totalDocs` counted hidden courses. The browser now sends the busy blocks (`busy=day,begin,end`, repeated) and the aggregation applies the same rule as the client (`courseMatchesClientFilters` / `availabilityFit`): the chosen Offered-in schedules or only the most recent offering, lectures if any lecture states a time and sections otherwise, at least one stated time and no overlap. Checked against a real local catalog (923 courses, 5,903 schedules) by comparing the API with the frontend's own predicate as the oracle: 16 configurations, with and without Offered-in and for each 2025 summer sub-session, all returned identical course sets and `totalDocs`.

### Student Profiles & Preferences — Done

> Implemented on branch `feature/student-profile`; design in `docs/superpowers/specs/2026-09-11-student-profile-design.md`. Sign-in reuses Clerk — no separate account system. Beyond the items below, this also added career goals, skills, course load, per-section public/private visibility, and first-login onboarding.

- [x] Account creation (reuses Clerk sign-in)
- [x] Set a default modality preference
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
- [x] Select a preferred schedule — "Use this schedule" fills the existing manual builder's lecture/section selections
- [x] Save chosen schedule — reuses the existing local `userSchedules` save (see scope decision above)
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

### Scotty Circles — Done (notifications out of scope)

> Updated 2026-09-20: built ahead of V1-V3. Completed 2026-09-23 together with the remaining V1-V3 gaps. A directory of
> other students' public profiles, publishing your active schedule to it, following other
> students, and emoji reactions on a followed schedule (`packages/profile/social.ts`,
> `apps/frontend/src/pages/circles.tsx`). The directory highlights courses and
> careers/skills you share with each person (`ProfileCard` in `circles.tsx`).

- [x] Schedule sharing — publish your active `userSchedules` schedule to your public profile
  (`publishSocialSchedule`, `PATCH /user/social/schedule`)
- [x] Social connections — follow another student's profile (`updateFollow`,
  `PATCH /user/social/follow`)
- [x] Interactive features: schedule reactions — emoji reactions (👍🎉🔥📚) on a followed
  schedule (`updateScheduleReaction`, `PATCH /user/social/reaction`). **Reactions had no checks at
  all** until 2026-09-23 (any signed-in user could react to any profile id); they now need a real
  profile, not yourself, a published schedule, and following the owner
- [x] Schedule comments — followers can comment on a published schedule (`controllers/comments.ts`,
  `PATCH/DELETE /user/social/comment`, `POST /social/comments`). Anyone signed in can read; the author
  deletes their own and the schedule's owner can delete any; unpublishing deletes the comments, republishing
  keeps them. Newest 200 are shown, up to 500 characters each
- [x] Direct messages — between **mutual follows** only (`controllers/messages.ts`,
  `POST /user/messages/conversations`, `POST /user/messages/thread`, `PATCH /user/messages`). The
  Circles page has a Messages card with unread counts and a Message button on the card of anyone who follows you back.
  New messages arrive by **polling** (list every 15 s, an open thread every 5 s, paused in a hidden tab):
  the backend is a plain Express app with no long-lived connections. Unfollowing stops sending; history stays readable
- [ ] ~~Notifications~~ — **Out of scope (decision 2026-09-23).** No bell, no email; unread counts appear only in the Messages list
- Fixed alongside: the page forgot what you had published after a reload (the directory now returns your own
  published schedule), and the directory listed every profile even with nothing public (it now returns those with a
  public section or a published schedule)

## Known limitations (2026-09-23)

- **The UI has not been exercised in a browser this round.** The dev environment used had no Clerk keys, so the new screens (default filters, semester plan, generator pool, rating answers, comments, messages) are covered by types, lint, unit tests and real-database runs of the handlers, not by looking at them. Direct messages and commenting also need two accounts that follow each other.
- **Backend tests** (`bun test` in `apps/backend`, 72) mock the database, so they prove what a handler asks for, not that MongoDB accepts it; every query added this round was also run against a real local replica set, which found two bugs a mock cannot (Prisma's `readAt: null` does not match a missing field, so unread counts were always 0). Not covered by any automated test: the search aggregation itself (verified by comparison against the client, not in CI), token verification, and FCE.
- Messages are polled, not pushed; there are no notifications. Conversation lists scan the latest 1,000 messages, threads show the latest 100, comments the latest 200, the directory the first 100 profiles.
- The semester plan checks units only, not hours per week; requirements exist for MISM only; the generator pool holds at most 12 courses.
- Modality and mini filters are not applicable until the catalog carries those fields.
