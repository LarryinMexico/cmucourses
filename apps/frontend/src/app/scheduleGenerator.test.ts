import { emptyProfile } from "@cmucourses/profile";
import type { Course } from "./types";
import {
  MAX_POOL,
  buildGeneratorInput,
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
