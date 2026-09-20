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
- Offered in (mini/semester) dropdown

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
- [ ] Plan courses across semesters — moved to V3 (Personalized Schedule Builder): it's the same multi-semester planning surface that builder needs, so it belongs with that work rather than duplicated here
- [ ] Explore alternative academic paths — moved to V3, same reason

## V3

### Personalized Schedule Builder — Not started

> Updated 2026-09-18 to match the latest Mural Features Decomposition board: "Apply career & skill goals" was added under Generate, and "Generate alternative options" was removed from Finalize (the team's Product Backlog board still lists the old version under V3 — the two boards are out of sync with each other, not something this file needs to track). Updated 2026-09-19: "Plan courses across semesters" and "Explore alternative academic paths" moved here from V2's Academic Path — both are the same multi-semester planning surface this builder needs, so building them separately would have meant doing the work twice.
>
> The availability-conflict logic this needs already exists: `parseCatalogTime` / `availabilityFit` / `meetingGroupsFor` in `packages/profile/availability.ts` (built for the search page's availability badge, V1) bridge catalog meeting times against `profile.busyBlocks` and are unit-tested — reuse them rather than re-deriving the overlap math.

- Generate 1-3 candidate schedules from filters + profile
- Apply saved course preferences during generation
- Apply career & skill goals during generation
- Exclude times that conflict with saved availability
- Compare schedule options and show why each was recommended
- Adjust course preferences and regenerate based on changes
- Select a preferred schedule and save/export it
- Plan courses across semesters (moved from V2's Academic Path)
- Explore alternative academic paths (moved from V2's Academic Path)

### Course & Professor Insights — Not started

> Mural doesn't tag this with a version number; placed here (after Personalized Schedule Builder, before Scotty Circles) for now.

- Course ratings (1-5 stars) + comments
- Professor ratings (1-5 stars) + comments
- Data source: try ScottyLabs' course-api CSV-based FCE parser first; fall back to dummy data if that doesn't work
- Show workload, grading fairness/transparency, and similar stats

## V4 (out of scope for now)

### Scotty Circles

- Schedule sharing, social connections, interactive features (follow, schedule reactions, etc.)
