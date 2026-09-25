import { emptyProfile } from "@cmucourses/profile";
import type { Course } from "./types";
import {
  MAX_POOL,
  buildGeneratorInput,
  candidateToCourseSessions,
  standaloneSectionKeys,
  plannedCourseIDsForSession,
  poolCourseIDs,
} from "./scheduleGenerator";

const profile = {
  ...emptyProfile(),
  workload: { unitsMin: 36, unitsMax: 48, hoursPerWeek: 40 },
};

describe("buildGeneratorInput refinement", () => {
  it("passes locks, excludes and the option count through to the generator", () => {
    const locks = [{ courseID: "15-213", lecture: "Lec 1", section: "A" }];
    const excluded = [{ courseID: "15-122", lecture: "Lec 2", section: null }];
    const input = buildGeneratorInput(["15-213"], [], "fall 2026", profile, {
      locks,
      excluded,
      maxCandidates: 2,
    });
    expect(input.locks).toEqual(locks);
    expect(input.excluded).toEqual(excluded);
    expect(input.maxCandidates).toBe(2);
  });

  it("uses the profile's workload unless a units range overrides it for this run", () => {
    expect(
      buildGeneratorInput(["15-213"], [], "fall 2026", profile).workload
    ).toEqual(profile.workload);

    const overridden = buildGeneratorInput(
      ["15-213"],
      [],
      "fall 2026",
      profile,
      { unitsRange: { min: 9, max: 30 } }
    );
    expect(overridden.workload).toEqual({
      unitsMin: 9,
      unitsMax: 30,
      hoursPerWeek: 40,
    });
    // the profile object itself is untouched
    expect(profile.workload).toEqual({
      unitsMin: 36,
      unitsMax: 48,
      hoursPerWeek: 40,
    });
  });
});

const planned = (
  courseID: string,
  semester: "fall" | "spring" | "summer",
  year: string
) => ({
  courseID,
  semester,
  year,
});

describe("plannedCourseIDsForSession", () => {
  const plan = [
    planned("15-213", "fall", "2026"),
    planned("15-122", "spring", "2027"),
    planned("21-127", "fall", "2026"),
    planned("33-104", "summer", "2026"),
    planned("15-213", "fall", "2026"), // a duplicate must not repeat
  ];

  it("picks the courses planned for the chosen semester", () => {
    expect(plannedCourseIDsForSession(plan, "Fall 2026")).toEqual([
      "15-213",
      "21-127",
    ]);
    expect(plannedCourseIDsForSession(plan, "Spring 2027")).toEqual(["15-122"]);
  });

  it("treats every summer sub-session as the planned summer", () => {
    for (const session of [
      "Summer One 2026",
      "Summer Two 2026",
      "Summer All 2026",
    ]) {
      expect(plannedCourseIDsForSession(plan, session)).toEqual(["33-104"]);
    }
    expect(plannedCourseIDsForSession(plan, "Summer One 2025")).toEqual([]);
  });

  it("finds nothing when no semester is chosen", () => {
    expect(plannedCourseIDsForSession(plan, "")).toEqual([]);
  });
});

describe("poolCourseIDs", () => {
  const base = {
    saved: ["15-213", "21-127"],
    planned: ["15-122", "21-127"],
    scheduled: [] as string[],
    includeSaved: true,
    includePlanned: true,
  };

  it("joins saved and planned courses once each, planned first", () => {
    expect(poolCourseIDs(base).ids).toEqual(["15-122", "21-127", "15-213"]);
  });

  it("uses only the sources that are switched on", () => {
    expect(poolCourseIDs({ ...base, includePlanned: false }).ids).toEqual([
      "15-213",
      "21-127",
    ]);
    expect(poolCourseIDs({ ...base, includeSaved: false }).ids).toEqual([
      "15-122",
      "21-127",
    ]);
    expect(
      poolCourseIDs({ ...base, includeSaved: false, includePlanned: false }).ids
    ).toEqual([]);
  });

  it("leaves out courses that are already in the schedule", () => {
    expect(poolCourseIDs({ ...base, scheduled: ["21-127"] }).ids).toEqual([
      "15-122",
      "15-213",
    ]);
  });

  it("caps the pool and says how many were cut", () => {
    const many = Array.from(
      { length: MAX_POOL + 5 },
      (_, i) => `10-${100 + i}`
    );
    const pool = poolCourseIDs({ ...base, saved: many, planned: [] });
    expect(pool.ids).toHaveLength(MAX_POOL);
    expect(pool.cut).toBe(5);
  });
});

describe("buildGeneratorInput with a pool", () => {
  const withLecture = (courseID: string): Course =>
    ({
      courseID,
      units: "12",
      schedules: [
        {
          courseID,
          year: "2026",
          semester: "fall",
          lectures: [
            {
              name: "Lec 1",
              instructors: [],
              location: "Pittsburgh",
              times: [{ days: [1], begin: "10:00AM", end: "10:50AM" }],
            },
          ],
          sections: [],
        },
      ],
    }) as unknown as Course;

  it("builds the pool's candidate courses the same way as the required ones", () => {
    const input = buildGeneratorInput(
      ["15-213"],
      [withLecture("15-213"), withLecture("21-127")],
      "Fall 2026",
      profile,
      { poolIDs: ["21-127"] }
    );
    expect(input.courses.map((c) => c.courseID)).toEqual(["15-213"]);
    expect(input.optionalCourses?.map((c) => c.courseID)).toEqual(["21-127"]);
    expect(input.optionalCourses?.[0]).toMatchObject({ units: 12 });
    expect(input.optionalCourses?.[0]?.lectures).toHaveLength(1);
  });

  it("has no pool unless one is given", () => {
    expect(
      buildGeneratorInput(
        ["15-213"],
        [withLecture("15-213")],
        "Fall 2026",
        profile
      ).optionalCourses
    ).toEqual([]);
  });

  it("a pool course whose details have not loaded yet has no options rather than failing", () => {
    const input = buildGeneratorInput(
      ["15-213"],
      [withLecture("15-213")],
      "Fall 2026",
      profile,
      { poolIDs: ["99-999"] }
    );
    expect(input.optionalCourses).toEqual([
      { courseID: "99-999", units: 0, lectures: [] },
    ]);
  });
});

describe("candidateToCourseSessions", () => {
  const current = {
    "15-213": { Lecture: "Lec 1", Section: "A", Color: "c1" },
    "95-703": { Lecture: "Lec 2", Section: "", Color: "c2" },
  };
  const pick = (courseID: string, lecture: string, section: string | null) => ({
    courseID,
    lecture,
    section,
    times: [],
  });

  it("sets the picked lecture and section", () => {
    const next = candidateToCourseSessions(current, [
      pick("15-213", "Lec 2", "D"),
    ]);
    expect(next["15-213"]).toEqual({
      Lecture: "Lec 2",
      Section: "D",
      Color: "c1",
    });
  });

  it("leaves a course the candidate could not place exactly as it was", () => {
    const next = candidateToCourseSessions(current, [
      pick("15-213", "Lec 2", "D"),
    ]);
    expect(next["95-703"]).toEqual(current["95-703"]);
  });

  it("a pick without a section clears only the section", () => {
    const next = candidateToCourseSessions(current, [
      pick("15-213", "Lec 3", null),
    ]);
    expect(next["15-213"]).toEqual({
      Lecture: "Lec 3",
      Section: "",
      Color: "c1",
    });
  });

  it("does not change the input", () => {
    const copy = JSON.parse(JSON.stringify(current));
    candidateToCourseSessions(current, [pick("15-213", "Lec 2", "D")]);
    expect(current).toEqual(copy);
  });
});

describe("buildGeneratorInput for a schedule with sections but no lectures", () => {
  const sectionsOnly = {
    courseID: "95-703",
    units: "12",
    schedules: [
      {
        courseID: "95-703",
        year: "2026",
        semester: "fall",
        lectures: [],
        sections: [
          {
            name: "A",
            lecture: "",
            instructors: [],
            location: "Pittsburgh",
            times: [{ days: [1], begin: "10:00AM", end: "10:50AM" }],
          },
          {
            name: "B",
            lecture: "",
            instructors: [],
            location: "Pittsburgh",
            times: [{ days: [2], begin: "10:00AM", end: "10:50AM" }],
          },
        ],
      },
    ],
  } as unknown as Course;

  it("offers each section as an option instead of nothing", () => {
    const input = buildGeneratorInput(
      ["95-703"],
      [sectionsOnly],
      "Fall 2026",
      profile
    );
    const options = input.courses[0]!.lectures;
    expect(options.map((l) => l.name)).toEqual(["A", "B"]);
    expect(options[0]!.times).toHaveLength(1);
  });

  it("keeps sections whose lecture name matches nothing as their own options", () => {
    const orphan = JSON.parse(JSON.stringify(sectionsOnly));
    orphan.schedules[0].lectures = [
      {
        name: "Lec 1",
        instructors: [],
        location: "Pittsburgh",
        times: [{ days: [3], begin: "09:00AM", end: "09:50AM" }],
      },
    ];
    orphan.schedules[0].sections[0].lecture = "Lec 1";
    orphan.schedules[0].sections[1].lecture = "Lec 9";
    const input = buildGeneratorInput(
      ["95-703"],
      [orphan],
      "Fall 2026",
      profile
    );
    const names = input.courses[0]!.lectures.map((l) => l.name);
    expect(names).toEqual(["Lec 1", "B"]);
    expect(input.courses[0]!.lectures[0]!.sections.map((s) => s.name)).toEqual([
      "A",
    ]);
  });
});

describe("standalone sections round-trip", () => {
  const course = {
    courseID: "95-703",
    units: "12",
    schedules: [
      {
        courseID: "95-703",
        year: "2026",
        semester: "fall",
        lectures: [],
        sections: [
          { name: "D", lecture: "", instructors: [], location: "", times: [] },
        ],
      },
    ],
  } as unknown as Course;

  it("finds sections that have no lecture of their own", () => {
    expect([...standaloneSectionKeys([course], "Fall 2026")]).toEqual([
      "95-703:D",
    ]);
    expect([...standaloneSectionKeys([course], "Spring 2026")]).toEqual([]);
  });

  it("a standalone section the generator picked is written back as the Section", () => {
    const next = candidateToCourseSessions(
      { "95-703": { Lecture: "", Section: "", Color: "c" } },
      [{ courseID: "95-703", lecture: "D", section: null }],
      standaloneSectionKeys([course], "Fall 2026")
    );
    expect(next["95-703"]).toEqual({ Lecture: "", Section: "D", Color: "c" });
  });
});
