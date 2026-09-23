import { describe, expect, test } from "bun:test";
import { groupPlanBySemester } from "./plan";
import type { PlannedCourse, Workload } from "./schema";

const planned = (courseID: string, semester: PlannedCourse["semester"], year: string): PlannedCourse => ({
  courseID,
  semester,
  year,
});
const target: Workload = { unitsMin: 36, unitsMax: 48, hoursPerWeek: null };
const units = (entries: [string, number | null][]) => new Map(entries);

describe("groupPlanBySemester", () => {
  test("returns nothing for an empty plan", () => {
    expect(groupPlanBySemester([], units([]), target)).toEqual([]);
  });

  test("groups by semester and orders them in time: spring, summer, fall, then the next year", () => {
    const groups = groupPlanBySemester(
      [
        planned("15-213", "fall", "2026"),
        planned("15-122", "spring", "2027"),
        planned("21-127", "spring", "2026"),
        planned("15-150", "summer", "2026"),
      ],
      units([]),
      null
    );
    expect(groups.map((g) => `${g.semester} ${g.year}`)).toEqual([
      "spring 2026",
      "summer 2026",
      "fall 2026",
      "spring 2027",
    ]);
  });

  test("lists each semester's courses by id with their units", () => {
    const [group] = groupPlanBySemester(
      [planned("15-213", "fall", "2026"), planned("15-122", "fall", "2026")],
      units([
        ["15-213", 12],
        ["15-122", 10],
      ]),
      null
    );
    expect(group!.courses).toEqual([
      { courseID: "15-122", units: 10 },
      { courseID: "15-213", units: 12 },
    ]);
    expect(group!.totalUnits).toBe(22);
  });

  test("the same course can be planned in two semesters and shows in both", () => {
    const groups = groupPlanBySemester(
      [planned("15-213", "fall", "2026"), planned("15-213", "spring", "2027")],
      units([["15-213", 12]]),
      null
    );
    expect(groups).toHaveLength(2);
    expect(groups.every((g) => g.courses[0]?.courseID === "15-213")).toBe(true);
  });

  test("variable or unknown units are listed but not counted in the total", () => {
    const [group] = groupPlanBySemester(
      [planned("15-213", "fall", "2026"), planned("98-000", "fall", "2026"), planned("99-000", "fall", "2026")],
      units([
        ["15-213", 12],
        ["98-000", null], // variable units
        // 99-000: details not loaded yet
      ]),
      null
    );
    expect(group!.totalUnits).toBe(12);
    expect(group!.unknownUnits).toEqual(["98-000", "99-000"]);
  });

  describe("workload check against the profile's unit range", () => {
    const fitFor = (total: number, workload: Workload | null) =>
      groupPlanBySemester([planned("15-213", "fall", "2026")], units([["15-213", total]]), workload)[0]!.workloadFit;

    test("within, below and above the range", () => {
      expect(fitFor(36, target)).toBe("IN_RANGE");
      expect(fitFor(48, target)).toBe("IN_RANGE");
      expect(fitFor(30, target)).toBe("UNDER");
      expect(fitFor(60, target)).toBe("OVER");
    });

    test("unknown when no range is set", () => {
      expect(fitFor(60, null)).toBe("UNKNOWN");
      expect(fitFor(60, { unitsMin: null, unitsMax: null, hoursPerWeek: 40 })).toBe("UNKNOWN");
    });

    test("unknown, not 'under', when none of the semester's units are known", () => {
      const [group] = groupPlanBySemester([planned("98-000", "fall", "2026")], units([["98-000", null]]), target);
      expect(group!.totalUnits).toBe(0);
      expect(group!.workloadFit).toBe("UNKNOWN");
    });
  });
});
