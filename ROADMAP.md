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

**Not done** (these three are currently in the Mural board's Done column, but there is no implementation for them in the code — Sprint Review has a rule that the team loses 1 point if something in Done turns out not to be done, so we should either implement these or move the cards out of Done before moving further down this roadmap):
- Restrict results to morning/afternoon/evening sections
- Modality filter (in-person/online/hybrid), which would override the profile's default
- Sort or highlight results by best fit against saved availability

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

### Career Path & Skills Navigator — In progress

> Merged into `main`. Design in `docs/superpowers/specs/2026-09-14-career-skills-mapping-and-audit.md`. The course-to-skill and skill-to-career mapping is hand-curated static data (`packages/profile/mapping/`); which careers a course serves is derived from skill overlap, so no new DB or API was needed. The first pass covers about 94 courses and still needs team review and expansion. "Match my goals" uses `recommendCourses` to list courses that match the profile; it can be narrowed further with the search box and doesn't block normal search.

**Career Goals**
- [x] Select career goals (Profile's Career goals — up to 3, ranked by priority)
- [ ] Explore career paths (browse/compare what a career path itself involves) — not started
- [x] Save career interests

**Skills Mapping**
- [x] Map courses to the skills they teach (`skillsForCourse`)
- [x] Map which skills each career needs (`careerSkills.ts`)
- [x] Show skill/career tags on course cards (search, Saved, course detail pages)
- [x] Recommend electives toward career goals (`recommendCourses` + the search page's "Match my goals")
- [ ] Identify skill gaps (skills you have vs. want are stored, but there's no dedicated "gap" view yet) — not started

**Academic Path**
- [ ] Plan courses across semesters — not started
- [ ] Balance degree requirements against career goals — not started
- [ ] Track skill progress — not started
- [ ] Explore alternative academic paths — not started

## V3

### Personalized Schedule Builder — Not started

> Updated 2026-09-18 to match the latest Mural Features Decomposition board: "Apply career & skill goals" was added under Generate, and "Generate alternative options" was removed from Finalize (the team's Product Backlog board still lists the old version under V3 — the two boards are out of sync with each other, not something this file needs to track).

- Generate 1-3 candidate schedules from filters + profile
- Apply saved course preferences during generation
- Apply career & skill goals during generation
- Exclude times that conflict with saved availability
- Compare schedule options and show why each was recommended
- Adjust course preferences and regenerate based on changes
- Select a preferred schedule and save/export it

### Course & Professor Insights — Not started

> Mural doesn't tag this with a version number; placed here (after Personalized Schedule Builder, before Scotty Circles) for now.

- Course ratings (1-5 stars) + comments
- Professor ratings (1-5 stars) + comments
- Data source: try ScottyLabs' course-api CSV-based FCE parser first; fall back to dummy data if that doesn't work
- Show workload, grading fairness/transparency, and similar stats

## V4 (out of scope for now)

### Scotty Circles

- Schedule sharing, social connections, interactive features (follow, schedule reactions, etc.)
