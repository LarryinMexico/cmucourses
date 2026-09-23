import type { PlanGroup } from "@cmucourses/profile";
import { describeGroupTotal, unitsByCourse } from "./planUnits";

describe("unitsByCourse", () => {
  it("reads plain and decimal unit counts", () => {
    const units = unitsByCourse([
      { courseID: "15-213", units: "12" },
      { courseID: "33-104", units: "9.0" },
    ]);
    expect(units.get("15-213")).toBe(12);
    expect(units.get("33-104")).toBe(9);
  });

  it("gives null to variable units, ranges and lists, which are not one number", () => {
    const units = unitsByCourse([
      { courseID: "a", units: "VAR" },
      { courseID: "b", units: "1-4" },
      { courseID: "c", units: "3,5,9" },
      { courseID: "d", units: "" },
    ]);
    for (const id of ["a", "b", "c", "d"]) expect(units.get(id)).toBeNull();
  });
});

describe("describeGroupTotal", () => {
  const group = (over: Partial<PlanGroup>): PlanGroup => ({
    year: "2026",
    semester: "fall",
    courses: [],
    totalUnits: 40,
    unknownUnits: [],
    workloadFit: "UNKNOWN",
    ...over,
  });
  const range = { unitsMin: 36, unitsMax: 48, hoursPerWeek: null };

  it("says where the total sits against the range, and warns when outside it", () => {
    expect(
      describeGroupTotal(group({ workloadFit: "IN_RANGE" }), range)
    ).toEqual({
      text: "40 units, within your 36–48 range",
      warn: false,
    });
    expect(
      describeGroupTotal(group({ totalUnits: 30, workloadFit: "UNDER" }), range)
    ).toEqual({
      text: "30 units, below your 36–48 range",
      warn: true,
    });
    expect(
      describeGroupTotal(group({ totalUnits: 60, workloadFit: "OVER" }), range)
    ).toEqual({
      text: "60 units, above your 36–48 range",
      warn: true,
    });
  });

  it("just gives the total when there is no range to compare with", () => {
    expect(describeGroupTotal(group({}), null)).toEqual({
      text: "40 units",
      warn: false,
    });
    expect(describeGroupTotal(group({ totalUnits: 1 }), null).text).toBe(
      "1 unit"
    );
  });

  it("names a half-set range generically instead of inventing the other end", () => {
    const onlyMin = { unitsMin: 36, unitsMax: null, hoursPerWeek: null };
    expect(
      describeGroupTotal(group({ workloadFit: "OVER" }), onlyMin).text
    ).toBe("40 units, above your unit range");
  });

  it("mentions the courses whose units are not counted", () => {
    expect(
      describeGroupTotal(group({ unknownUnits: ["98-000"] }), null).text
    ).toBe("40 units · 1 course with variable units not counted");
    expect(
      describeGroupTotal(group({ unknownUnits: ["98-000", "99-000"] }), null)
        .text
    ).toBe("40 units · 2 courses with variable units not counted");
  });

  it("does not claim zero units when none are known", () => {
    expect(
      describeGroupTotal(
        group({ totalUnits: 0, unknownUnits: ["98-000"] }),
        range
      ).text
    ).toBe("Units not known · 1 course with variable units not counted");
  });
});
