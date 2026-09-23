# Roadmap

The team's feature plan, sourced from the Mural feature decomposition board. Version tags (V1-V4) mirror the Mural Features Decomposition board; section names follow the Mural cards as closely as possible so this file can be cross-referenced directly against the board.

## Vision

Course directory navigator: help students build the schedule that best fits their own profile.

## V1

### Course Search & Filters — Partially done (base built by cloning the existing ScottyLabs site)

Done:
- Department dropdown
- Course Level dropdown (undergrad/grad)
- Unit slider (0-24)
- Offered in (**semester** only) dropdown — there is no mini option; see "Why there is no mini filter" below

Also done (these three were sitting in the Mural board's Done column with no implementation; Sprint Review deducts 1 point for anything in Done that turns out not to be done):
- [x] Restrict results to morning/afternoon/evening sections — the **Class Times** filter (`ClassTimesFilter.tsx`), matched server-side in the search aggregation
- [x] Sort or highlight results by best fit against saved availability — implemented as **highlight**: an availability badge on every course card, comparing `profile.busyBlocks` against the course's lecture times (`packages/profile/availability.ts`)
- [ ] ~~Modality filter (in-person/online/hybrid), which would override the profile's default~~ — **not possible with the current data; move this card out of Done.** Replaced by the "Time not set" option in the Class Times filter.

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

Measured against the catalog (`schedules` collection, 2026-09-23, ~48.8k schedule documents): fall and spring documents carry **no `session` value at all**, so CMU's Mini 1-4 cannot be told apart from a full semester. Only summer has sub-terms (`summer one` 545, `summer two` 802, `summer all` 1581, `qatar summer` 120, unset 310). The frontend has a `Session.session` type for these, but no filter ever sets it, and the backend keeps only `year`/`semester` from a `session` query parameter. So "Offered in" is a semester filter; a summer sub-session filter would be possible, a mini filter is not until the upstream data carries one.

#### Known gaps in V1 filters (found by the 2026-09-23 audit)

- **Time-window filter was broken and is fixed.** `timeBegin`/`timeEnd` returned HTTP 500 against any catalog containing `TBA` times (about half of Fall 2026): `catalogTimeToMinutes` ran `$toInt` on `"TB"` even when its regex guard rejected the value. It now converts with `onError: null`. The window also matched a course if *any single* meeting entry fit; it now requires a fitting lecture and a fitting section (each kind that states times), with TBA entries neutral. Checked against a local copy of the catalog by comparing the API to an independent JS implementation of that rule for three windows on Fall 2026 (592/592, 1051/1051 and 2415/2415 courses agree; the old rule admitted 135, 185 and 31 extra courses).
- **"Only courses that fit my availability" is client-side.** It filters the current results page in the browser (`courseFilterPredicates.ts`), so a page can come back short and `totalDocs` counts courses that were hidden. Making it server-side needs the busy blocks sent with the search request.

### Student Profiles & Preferences — Done

> Implemented on branch `feature/student-profile`; design in `docs/superpowers/specs/2026-09-11-student-profile-design.md`. Sign-in reuses Clerk — no separate account system. Beyond the items below, this also added career goals, skills, course load, per-section public/private visibility, and first-login onboarding.

- [x] Account creation (reuses Clerk sign-in)
- [x] Set a default modality preference
- [x] Set recurring weekly busy times (= availability)
- [x] Edit availability at any time
- [x] Edit profile/preferences at any time
- [x] Preferences persist across sessions
- [x] Record completed / in-progress courses
- [ ] (Optional) Save a default filter set as the homepage — not started

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
- [x] Balance degree requirements against career goals — **MISM only.** New `/requirements` page tracks the 13 core requirements from the MISM program handbook (`packages/profile/requirements/mism.ts`) against courses taken/in-progress, plus elective-unit progress and elective suggestions filtered by career goals (`recommendCourses`, excluding anything that already satisfies a core requirement). No other major's requirements have been transcribed yet — `requirementsForMajor` returns `null` for everything else, and the page says so rather than showing an empty shell.
  - `95-867` ("Tech Strategy & Governance"), listed in the MISM handbook, does not exist anywhere in the live course catalog (checked against the full ~8,400-course catalog, 2026-09-19). It stays in the requirement data and renders normally, marked "not in the course catalog" with no course link — see `requirements/mism.ts` for detail. `scripts/check-course-ids.ts` checks for this on every run and expects exactly this one miss.
- [ ] Plan courses across semesters — moved to V3 (Personalized Schedule Builder), where its status is tracked; a first version already exists (see there)
- [x] Explore alternative academic paths — moved to V3, where its status is tracked

## V3

### Personalized Schedule Builder — Partially done

> Updated 2026-09-18 to match the latest Mural Features Decomposition board: "Apply career & skill goals" was added under Generate, and "Generate alternative options" was removed from Finalize (the team's Product Backlog board still lists the old version under V3 — the two boards are out of sync with each other, not something this file needs to track). Updated 2026-09-19: "Plan courses across semesters" and "Explore alternative academic paths" moved here from V2's Academic Path — both are the same multi-semester planning surface this builder needs, so building them separately would have meant doing the work twice.
>
> Generator logic lives in `packages/profile/scheduleGenerator.ts`, unit-tested and wired into `/schedules` as a new Generate panel. It reuses `availabilityFit` (`packages/profile/availability.ts`, V1) to judge each pick against `busyBlocks` (the lecture × section options and course-to-course overlap check are its own `optionsFor`/`timePairOverlaps`; `meetingGroupsFor` is used by the search-side badge and filters, not here) and the same core/supporting/want weighting as `recommendCourses` (V2) for career/skill scoring — no overlap math or scoring rules were re-derived. **Scope decision:** candidates are built only from courses the student adds manually (reusing the existing `ScheduleSearch` picker), not auto-selected from filters; and generated schedules stay client-side in the existing `userSchedules` slice (localStorage) rather than a new backend model, since the manual builder already only saves locally.

**Generate**
- [x] Generate 1-3 personalized schedules — `generateSchedules`, beam-pruned so it stays fast without a full cartesian product over sections
- [x] Apply availability constraints — scored against `profile.busyBlocks`; a conflicting course is still scheduled (never silently dropped) but flagged and penalized in the ranking
- [ ] Apply saved course preferences during generation — not applicable as scoped; the student's own picks are the input, not a preference profile to select from
- [x] Apply career & skill goals during generation

**Compare & Refine**
- [x] Compare schedule options — up to 3 candidates shown with a score breakdown (availability / workload / career fit)
- [x] See why each schedule was recommended — per-candidate `reasons` text (time conflicts, unit-range fit, skills it builds toward)
- [x] Adjust course preferences and regenerate based on changes — each pick on a candidate can be **locked** (kept on the next run) or **excluded** (never chosen), shown as removable chips above a **Regenerate** button; the panel also takes an option count (1-3) and a units range for this run only. Locks and exclusions live in the panel's component state (not saved to the profile or Redux) and are cleared when the semester changes. No new preference types were added: "course preferences" here means which sections to keep or rule out, not a saved preference profile

**Finalize**
- [x] Select a preferred schedule — "Use this schedule" fills the existing manual builder's lecture/section selections
- [x] Save chosen schedule — reuses the existing local `userSchedules` save (see scope decision above)
- [x] Export/share schedule — the Copy link button builds `/schedules/shared?data=...` (the schedule encoded in the URL; `?courses=...` is only accepted as a fallback), and an **Export .ics** button downloads a calendar file (`buildScheduleICS` in `apps/frontend/src/app/scheduleSharing.ts`, tested)
- [ ] Plan courses across semesters (moved from V2's Academic Path) — **first version only.** `profile.plannedCourses` (course + semester + year, up to 100) is edited in Profile's "Future course plan" (`PlanSection.tsx`) and feeds PLANNED status on `/requirements`. Still missing: grouping by semester, per-semester unit totals or workload checks, and a schedule check per semester. Known bug: the picker hides courses already in the plan, so one course cannot be placed in two semesters
- [x] Explore alternative academic paths (moved from V2's Academic Path) — `/careers` "Alternative academic paths" (`AlternativeAcademicPaths`): up to 3 course bundles that each take a different suggested course for every skill gap. Skill-gap based; it does not consider degree requirements

### Course & Professor Insights — Partially done

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
- [ ] Aggregate workload/grading-fairness/transparency stats — not built; that data already exists separately via the FCE card on the same pages

## V4

### Scotty Circles — Partially done

> Updated 2026-09-20: built ahead of V1-V3 being finished, so treat V1-V3's remaining gaps as
> still the priority — this landing first doesn't move Circles up the roadmap. A directory of
> other students' public profiles, publishing your active schedule to it, following other
> students, and emoji reactions on a followed schedule (`packages/profile/social.ts`,
> `apps/frontend/src/pages/circles.tsx`). The directory highlights courses and
> careers/skills you share with each person (`ProfileCard` in `circles.tsx`).

- [x] Schedule sharing — publish your active `userSchedules` schedule to your public profile
  (`publishSocialSchedule`, `PATCH /user/social/schedule`)
- [x] Social connections — follow another student's profile (`updateFollow`,
  `PATCH /user/social/follow`)
- [x] Interactive features: schedule reactions — emoji reactions (👍🎉🔥📚) on a followed
  schedule (`updateScheduleReaction`, `PATCH /user/social/reaction`)
- [ ] Anything beyond follow/react/publish (comments, messaging, notifications) — not built

## Known issues (2026-09-23 audit, not yet fixed)

- Circles: the page's `published` state starts as `null` on every load (`circles.tsx`), so it does not know you already published; the directory endpoint (`controllers/social.ts`) does not check that a profile has any public section, contradicting the page's empty-state text.
- The backend has no tests (rating gating and the social controllers are unverified by anything but manual use).
