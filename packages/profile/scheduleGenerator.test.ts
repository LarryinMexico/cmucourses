import { describe, expect, test } from "bun:test";
import { generateSchedules, type CandidateCourse, type GeneratorInput } from "./scheduleGenerator";
import { DEFAULT_SCHEDULE_PREFERENCES, type BusyBlock } from "./schema";

const block = (day: number, begin: number, end: number): BusyBlock => ({ day, begin, end, label: null });

/** A course with a single lecture, no sections, at a fixed time. */
const simpleCourse = (courseID: string, units: number, begin: string, end: string, days = [1, 3]): CandidateCourse => ({
  courseID,
  units,
  lectures: [{ name: "Lec 1", times: [{ days, begin, end }], sections: [] }],
});

const baseInput: GeneratorInput = {
  courses: [],
  busyBlocks: [],
  workload: null,
  careers: [],
  skillsWant: [],
  skillsHave: [],
  preferences: DEFAULT_SCHEDULE_PREFERENCES,
  preferredModality: null,
};

describe("generateSchedules", () => {
  test("returns [] for no courses", () => {
    expect(generateSchedules({ ...baseInput, courses: [] })).toEqual([]);
  });

  test("two courses with no time overlap fit cleanly", () => {
    const result = generateSchedules({
      ...baseInput,
      courses: [simpleCourse("15-213", 12, "10:00AM", "10:50AM"), simpleCourse("15-122", 10, "02:00PM", "02:50PM")],
    });
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]!.availability.status).toBe("UNKNOWN"); // no busyBlocks given -> nothing to judge against
    expect(result[0]!.picks).toHaveLength(2);
  });

  test("a course with zero lecture options is excluded from picks but not dropped from the candidate", () => {
    const empty: CandidateCourse = { courseID: "99-999", units: 9, lectures: [] };
    const result = generateSchedules({ ...baseInput, courses: [empty] });
    expect(result).toHaveLength(1);
    expect(result[0]!.picks).toHaveLength(0);
    expect(result[0]!.reasons.some((r) => r.includes("99-999"))).toBe(true);
  });

  test("every option conflicting with busy blocks still produces a candidate, marked CONFLICTS", () => {
    const result = generateSchedules({
      ...baseInput,
      courses: [simpleCourse("15-213", 12, "10:00AM", "10:50AM")],
      busyBlocks: [block(1, 9 * 60, 12 * 60)],
    });
    expect(result).toHaveLength(1);
    expect(result[0]!.availability.status).toBe("CONFLICTS");
    expect(result[0]!.availability.conflicts).toEqual(["15-213"]);
  });

  test("returns no candidate when every combination has a cross-course conflict", () => {
    const a = simpleCourse("15-213", 12, "10:00AM", "10:50AM");
    const b = simpleCourse("15-122", 10, "10:00AM", "10:50AM"); // identical slot, same days
    const result = generateSchedules({ ...baseInput, courses: [a, b] });
    expect(result).toEqual([]);
  });

  test("chooses a non-conflicting option instead of an overlapping one", () => {
    const fixed = simpleCourse("15-213", 12, "10:00AM", "10:50AM");
    const flexible: CandidateCourse = {
      courseID: "15-122",
      units: 10,
      lectures: [
        {
          name: "Conflicting",
          times: [{ days: [1, 3], begin: "10:00AM", end: "10:50AM" }],
          sections: [],
        },
        {
          name: "Valid",
          times: [{ days: [1, 3], begin: "11:00AM", end: "11:50AM" }],
          sections: [],
        },
      ],
    };

    const result = generateSchedules({ ...baseInput, courses: [fixed, flexible] });

    expect(result.length).toBeGreaterThan(0);
    expect(result[0]!.picks.find((pick) => pick.courseID === "15-122")?.lecture).toBe("Valid");
  });

  test("workload UNKNOWN when profile.workload is null", () => {
    const result = generateSchedules({
      ...baseInput,
      courses: [simpleCourse("15-213", 12, "10:00AM", "10:50AM")],
      workload: null,
    });
    expect(result[0]!.workloadFit).toBe("UNKNOWN");
  });

  test("workload IN_RANGE / UNDER / OVER buckets", () => {
    const course = simpleCourse("15-213", 12, "10:00AM", "10:50AM");
    const inRange = generateSchedules({
      ...baseInput,
      courses: [course],
      workload: { unitsMin: 9, unitsMax: 15, hoursPerWeek: null },
    });
    expect(inRange[0]!.workloadFit).toBe("IN_RANGE");

    const under = generateSchedules({
      ...baseInput,
      courses: [course],
      workload: { unitsMin: 24, unitsMax: 36, hoursPerWeek: null },
    });
    expect(under[0]!.workloadFit).toBe("UNDER");

    const over = generateSchedules({
      ...baseInput,
      courses: [course],
      workload: { unitsMin: 0, unitsMax: 6, hoursPerWeek: null },
    });
    expect(over[0]!.workloadFit).toBe("OVER");
  });

  test("career scoring: a course teaching a primary career's core skill scores higher than one that doesn't", () => {
    // 15-213 teaches systems-programming, a core skill of systems-infra (per courseSkills.ts /
    // careerSkills.ts fixtures already covered in mapping.test.ts).
    const withGoal = generateSchedules({
      ...baseInput,
      courses: [simpleCourse("15-213", 12, "10:00AM", "10:50AM")],
      careers: ["systems-infra"],
    });
    const withoutGoal = generateSchedules({
      ...baseInput,
      courses: [simpleCourse("15-213", 12, "10:00AM", "10:50AM")],
      careers: [],
    });
    expect(withGoal[0]!.careerScore).toBeGreaterThan(withoutGoal[0]!.careerScore);
    expect(withGoal[0]!.totalScore).toBeGreaterThan(withoutGoal[0]!.totalScore);
  });

  test("skillsHave already covering a course's skills means no career score contribution from those skills", () => {
    const result = generateSchedules({
      ...baseInput,
      courses: [simpleCourse("15-213", 12, "10:00AM", "10:50AM")],
      careers: ["systems-infra"],
      skillsHave: ["systems-programming"],
    });
    // Still may score on other skills 15-213 teaches, but strictly less than having none of them.
    const withoutHave = generateSchedules({
      ...baseInput,
      courses: [simpleCourse("15-213", 12, "10:00AM", "10:50AM")],
      careers: ["systems-infra"],
      skillsHave: [],
    });
    expect(result[0]!.careerScore).toBeLessThanOrEqual(withoutHave[0]!.careerScore);
  });

  test("unknown career ids are ignored rather than throwing", () => {
    expect(() =>
      generateSchedules({
        ...baseInput,
        courses: [simpleCourse("15-213", 12, "10:00AM", "10:50AM")],
        careers: ["not-a-real-career"],
      })
    ).not.toThrow();
  });

  test("returns up to maxCandidates, sorted by score descending", () => {
    // Course with 3 non-overlapping lecture options, each a different quality of fit.
    const multi: CandidateCourse = {
      courseID: "15-213",
      units: 12,
      lectures: [
        { name: "Lec A", times: [{ days: [1], begin: "08:00AM", end: "08:50AM" }], sections: [] },
        { name: "Lec B", times: [{ days: [1], begin: "10:00AM", end: "10:50AM" }], sections: [] },
        { name: "Lec C", times: [{ days: [1], begin: "02:00PM", end: "02:50PM" }], sections: [] },
      ],
    };
    const result = generateSchedules({ ...baseInput, courses: [multi], maxCandidates: 2 });
    expect(result.length).toBeLessThanOrEqual(2);
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1]!.totalScore).toBeGreaterThanOrEqual(result[i]!.totalScore);
    }
  });

  test("saved time preferences rank matching sections first", () => {
    const multi: CandidateCourse = {
      courseID: "15-213",
      units: 12,
      lectures: [
        {
          name: "Early",
          times: [{ days: [1], begin: "08:00AM", end: "08:50AM" }],
          sections: [],
        },
        {
          name: "Preferred",
          times: [{ days: [2], begin: "11:00AM", end: "11:50AM" }],
          sections: [],
        },
      ],
    };
    const result = generateSchedules({
      ...baseInput,
      courses: [multi],
      preferences: {
        ...DEFAULT_SCHEDULE_PREFERENCES,
        earliestStart: 10 * 60,
        preferredDays: [2],
      },
    });
    expect(result[0]!.picks[0]!.lecture).toBe("Preferred");
  });

  test("respects sections nested under a lecture", () => {
    const withSections: CandidateCourse = {
      courseID: "15-213",
      units: 12,
      lectures: [
        {
          name: "Lec 1",
          times: [{ days: [1, 3], begin: "10:00AM", end: "10:50AM" }],
          sections: [
            { name: "A", times: [{ days: [5], begin: "10:00AM", end: "10:50AM" }] },
            { name: "B", times: [{ days: [5], begin: "11:00AM", end: "11:50AM" }] },
          ],
        },
      ],
    };
    const result = generateSchedules({ ...baseInput, courses: [withSections] });
    expect(result[0]!.picks[0]!.section).not.toBeNull();
    // Both lecture and section times are attended, so both show up.
    expect(result[0]!.picks[0]!.times.length).toBe(2);
  });

  test("large combinatorics stay fast (regression guard against full cartesian product)", () => {
    const manyOptions = (courseID: string, courseIndex: number): CandidateCourse => {
      const hour = 8 + courseIndex;
      const displayHour = hour > 12 ? hour - 12 : hour;
      const period = hour >= 12 ? "PM" : "AM";
      const begin = `${displayHour.toString().padStart(2, "0")}:00${period}`;
      const end = `${displayHour.toString().padStart(2, "0")}:50${period}`;

      return {
        courseID,
        units: 9,
        lectures: Array.from({ length: 5 }, (_, i) => ({
          name: `Lec ${i}`,
          // Every course has a distinct hour and five day choices. This retains the 5^8 search
          // space while guaranteeing that conflict-free complete schedules exist.
          times: [
            {
              days: [(i % 5) + 1],
              begin,
              end,
            },
          ],
          sections: [],
        })),
      };
    };
    const courses = Array.from({ length: 8 }, (_, i) => manyOptions(`10-${100 + i}`, i));
    const start = performance.now();
    const result = generateSchedules({ ...baseInput, courses });
    const elapsed = performance.now() - start;
    expect(result.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(1000);
  });
});

/** A lecture at one time, optionally with sections (each section is one extra time). */
const lecture = (
  name: string,
  begin: string,
  end: string,
  days: number[],
  sections: { name: string; begin: string; end: string; days: number[] }[] = []
) => ({
  name,
  times: [{ days, begin, end }],
  sections: sections.map((s) => ({ name: s.name, times: [{ days: s.days, begin: s.begin, end: s.end }] })),
});

describe("locks and excludes", () => {
  const twoLectures: CandidateCourse = {
    courseID: "15-213",
    units: 12,
    lectures: [lecture("Lec 1", "10:00AM", "10:50AM", [1, 3]), lecture("Lec 2", "02:00PM", "02:50PM", [2, 4])],
  };

  test("a lock pins the course to that option in every candidate", () => {
    const result = generateSchedules({
      ...baseInput,
      courses: [twoLectures],
      locks: [{ courseID: "15-213", lecture: "Lec 2", section: null }],
    });
    expect(result.length).toBeGreaterThan(0);
    for (const candidate of result) expect(candidate.picks.map((p) => p.lecture)).toEqual(["Lec 2"]);
  });

  test("a lock can pin one section of a lecture", () => {
    const course: CandidateCourse = {
      courseID: "15-122",
      units: 10,
      lectures: [
        lecture(
          "Lec A",
          "09:00AM",
          "09:50AM",
          [1, 3],
          [
            { name: "A1", begin: "11:00AM", end: "11:50AM", days: [5] },
            { name: "A2", begin: "01:00PM", end: "01:50PM", days: [5] },
          ]
        ),
      ],
    };
    const result = generateSchedules({
      ...baseInput,
      courses: [course],
      locks: [{ courseID: "15-122", lecture: "Lec A", section: "A2" }],
    });
    expect(result.length).toBeGreaterThan(0);
    for (const candidate of result) expect(candidate.picks[0]!.section).toBe("A2");
  });

  test("an excluded option never appears", () => {
    const result = generateSchedules({
      ...baseInput,
      courses: [twoLectures],
      excluded: [{ courseID: "15-213", lecture: "Lec 1", section: null }],
    });
    expect(result.length).toBeGreaterThan(0);
    for (const candidate of result) expect(candidate.picks.map((p) => p.lecture)).toEqual(["Lec 2"]);
  });

  test("a lock that clashes with another course returns no schedule instead of overlapping classes", () => {
    const fixed = simpleCourse("15-122", 10, "10:00AM", "10:50AM");
    const flexible: CandidateCourse = {
      courseID: "21-127",
      units: 9,
      lectures: [lecture("Lec 1", "10:00AM", "10:50AM", [1, 3]), lecture("Lec 2", "02:00PM", "02:50PM", [1, 3])],
    };
    expect(generateSchedules({ ...baseInput, courses: [fixed, flexible] })).not.toEqual([]);
    expect(
      generateSchedules({
        ...baseInput,
        courses: [fixed, flexible],
        locks: [{ courseID: "21-127", lecture: "Lec 1", section: null }],
      })
    ).toEqual([]);
  });

  test("a lock pointing at an option that no longer exists is ignored and says so", () => {
    const result = generateSchedules({
      ...baseInput,
      courses: [twoLectures],
      locks: [{ courseID: "15-213", lecture: "Lec 9", section: null }],
    });
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]!.picks).toHaveLength(1);
    expect(result[0]!.reasons.some((r) => r.includes("15-213") && r.includes("Lec 9"))).toBe(true);
  });

  test("excluding every option of a course leaves it unscheduled with an accurate reason", () => {
    const result = generateSchedules({
      ...baseInput,
      courses: [twoLectures],
      excluded: [
        { courseID: "15-213", lecture: "Lec 1", section: null },
        { courseID: "15-213", lecture: "Lec 2", section: null },
      ],
    });
    expect(result).toHaveLength(1);
    expect(result[0]!.picks).toHaveLength(0);
    expect(
      result[0]!.reasons.some((r) => r.includes("15-213") && /exclud/i.test(r) && !/No schedule data/.test(r))
    ).toBe(true);
  });
});

describe("candidate scores", () => {
  test("exposes the four component scores that totalScore is built from", () => {
    const result = generateSchedules({
      ...baseInput,
      courses: [simpleCourse("15-213", 12, "10:00AM", "10:50AM")],
      workload: { unitsMin: 30, unitsMax: 40, hoursPerWeek: null },
    });
    const candidate = result[0]!;
    // no busy blocks -> availability UNKNOWN (50); 12 units is under a 30-40 target
    expect(candidate.scores.availability).toBe(50);
    expect(candidate.workloadFit).toBe("UNDER");
    expect(candidate.scores.workload).toBeLessThan(100);
    expect(candidate.scores.career).toBe(candidate.careerScore);
    expect(candidate.scores.preference).toBe(candidate.preferenceScore);
    const { availability, workload, career, preference } = candidate.scores;
    expect(candidate.totalScore).toBeCloseTo(
      0.35 * availability + 0.25 * workload + 0.2 * career + 0.2 * preference,
      6
    );
  });

  test("unknown workload scores 100, not the 75 the candidate card used to show", () => {
    const result = generateSchedules({ ...baseInput, courses: [simpleCourse("15-213", 12, "10:00AM", "10:50AM")] });
    expect(result[0]!.workloadFit).toBe("UNKNOWN");
    expect(result[0]!.scores.workload).toBe(100);
  });
});

describe("beam pruning", () => {
  test("keeps the one schedule that avoids every busy block when 625 combinations compete for 200 slots", () => {
    // Four courses, five lectures each (Mon..Fri), one distinct hour per course, so courses never
    // clash with each other. Mon-Thu are busy all day, so only the all-Friday combination fits.
    const courses: CandidateCourse[] = Array.from({ length: 4 }, (_, index) => {
      const hour = String(8 + index).padStart(2, "0");
      return {
        courseID: `10-${200 + index}`,
        units: 9,
        lectures: Array.from({ length: 5 }, (_, day) =>
          lecture(`Lec ${day}`, `${hour}:00AM`, `${hour}:50AM`, [day + 1])
        ),
      };
    });
    const busyBlocks = [1, 2, 3, 4].map((day) => block(day, 7 * 60, 20 * 60));
    const result = generateSchedules({ ...baseInput, courses, busyBlocks });
    expect(result[0]!.availability.status).toBe("FITS");
    expect(result[0]!.picks.every((p) => p.lecture === "Lec 4")).toBe(true);
  });
});

describe("candidate pool (optionalCourses)", () => {
  const at = (hour: number) => `${String(hour).padStart(2, "0")}:00AM`;
  /** A course of `units` units on Mon/Wed at a distinct hour, so pool courses never clash by accident. */
  const course = (id: string, units: number, hour: number) =>
    simpleCourse(id, units, at(hour), at(hour).replace(":00", ":50"));
  const required = course("15-213", 12, 8);
  const pool = [
    course("21-127", 12, 9),
    course("15-122", 12, 10),
    course("33-104", 12, 11),
    course("18-100", 12, 12),
  ].map((c) =>
    // 12:00AM would be midnight; keep the last one in the afternoon
    c.courseID === "18-100" ? simpleCourse("18-100", 12, "01:00PM", "01:50PM") : c
  );
  const range = (unitsMin: number | null, unitsMax: number | null) => ({ unitsMin, unitsMax, hoursPerWeek: null });
  const run = (over: Partial<GeneratorInput> = {}) =>
    generateSchedules({ ...baseInput, courses: [required], optionalCourses: pool, workload: range(36, 48), ...over });
  const ids = (candidate: { picks: { courseID: string }[] }) => candidate.picks.map((p) => p.courseID);

  test("chooses which pool courses to add so the total lands in the units range", () => {
    const result = run();
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]!.totalUnits).toBeGreaterThanOrEqual(36);
    expect(result[0]!.totalUnits).toBeLessThanOrEqual(48);
    expect(result[0]!.workloadFit).toBe("IN_RANGE");
  });

  test("never goes over the maximum, whatever the pool holds", () => {
    // Ask for plenty of candidates: the top few would stay in range even without a hard limit.
    const result = run({ workload: range(null, 30), maxCandidates: 20 });
    expect(result.length).toBeGreaterThan(0);
    for (const candidate of result) expect(candidate.totalUnits).toBeLessThanOrEqual(30);
  });

  test("required courses are in every candidate", () => {
    for (const candidate of run()) expect(ids(candidate)).toContain("15-213");
  });

  test("a pool course left out is not reported as unscheduled, and the pool is summarised once", () => {
    const [first] = run({ workload: range(24, 24) }); // room for exactly one more 12-unit course
    expect(first!.picks).toHaveLength(2);
    expect(first!.reasons.some((r) => /No schedule data|excluded from this candidate/.test(r))).toBe(false);
    expect(first!.reasons.filter((r) => r.startsWith("Not added from your pool"))).toHaveLength(1);
  });

  test("says which pool courses were added", () => {
    const [first] = run({ workload: range(24, 24) });
    const added = ids(first!).find((id) => id !== "15-213")!;
    expect(first!.reasons).toContain(`Added ${added} from your pool`);
  });

  test("a locked pool course is always in the schedule", () => {
    const result = run({ locks: [{ courseID: "33-104", lecture: "Lec 1", section: null }] });
    expect(result.length).toBeGreaterThan(0);
    for (const candidate of result) expect(ids(candidate)).toContain("33-104");
  });

  test("an excluded pool option never appears", () => {
    const result = run({ excluded: [{ courseID: "21-127", lecture: "Lec 1", section: null }] });
    for (const candidate of result) expect(ids(candidate)).not.toContain("21-127");
  });

  test("a pool course that clashes with a required one is simply left out, not a reason to fail", () => {
    const clash = simpleCourse("99-100", 9, "08:00AM", "08:50AM"); // same slot as 15-213
    const result = run({ optionalCourses: [clash, ...pool], maxCandidates: 20 });
    expect(result.length).toBeGreaterThan(0);
    for (const candidate of result) expect(ids(candidate)).not.toContain("99-100");
  });

  test("without a units range there is nothing to choose by: every pool course that fits is added, and it says why", () => {
    const [first] = run({ workload: null });
    expect(ids(first!).sort()).toEqual(["15-122", "15-213", "18-100", "21-127", "33-104"]);
    expect(first!.reasons).toContain("Set a units range to let the generator choose from your pool");
  });

  test("works from a pool alone, with no required courses", () => {
    const result = run({ courses: [], workload: range(24, 24) });
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]!.totalUnits).toBe(24);
    expect(result.every((candidate) => candidate.picks.length > 0)).toBe(true);
  });

  test("no candidate is an empty schedule", () => {
    for (const candidate of run({ workload: range(0, 100) })) expect(candidate.picks.length).toBeGreaterThan(0);
  });

  test("a large pool stays fast", () => {
    const manyRequired = Array.from({ length: 4 }, (_, i) => course(`10-${100 + i}`, 9, 8 + i));
    // Twelve pool courses, each with five lecture days at its own afternoon hour, so they can all
    // coexist and the search really has to choose.
    const manyPool: CandidateCourse[] = Array.from({ length: 12 }, (_, i) => {
      const hour = String(1 + (i % 11)).padStart(2, "0");
      return {
        courseID: `20-${100 + i}`,
        units: 9,
        lectures: Array.from({ length: 5 }, (_, day) =>
          lecture(`Lec ${day}`, `${hour}:00PM`, `${hour}:50PM`, [day + 1])
        ),
      };
    });
    const start = performance.now();
    const result = generateSchedules({
      ...baseInput,
      courses: manyRequired,
      optionalCourses: manyPool,
      workload: range(36, 45),
    });
    const elapsed = performance.now() - start;
    console.log(`pool of 12 + 4 required: ${elapsed.toFixed(0)} ms`);
    expect(result.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(1000);
  });
});
