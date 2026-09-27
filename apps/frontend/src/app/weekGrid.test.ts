import { GRID_END, GRID_START, layoutWeek, unplacedCourses } from "./weekGrid";

const meeting = (
  courseID: string,
  days: number[],
  begin: string,
  end: string,
  label = "Lec 1"
) => ({
  courseID,
  label,
  time: { days, begin, end, building: "", room: "" },
});

describe("layoutWeek", () => {
  it("places a class on each of its weekdays, positioned within the 8:00-22:00 grid", () => {
    const { blocks } = layoutWeek(
      [meeting("15-213", [2, 4], "12:30PM", "01:50PM")],
      [],
      { "15-213": "c1" }
    );
    expect(blocks.map((b) => b.day)).toEqual([2, 4]);
    const total = GRID_END - GRID_START;
    expect(blocks[0]).toMatchObject({
      kind: "class",
      title: "15-213",
      subtitle: "Lec 1",
      color: "c1",
      top: ((750 - GRID_START) / total) * 100,
      height: ((830 - 750) / total) * 100,
    });
  });

  it("draws busy times with their reason, or just 'Busy'", () => {
    const { blocks } = layoutWeek(
      [],
      [
        { day: 1, begin: 540, end: 600, label: null },
        { day: 3, begin: 540, end: 600, label: "Work" },
      ],
      {}
    );
    expect(blocks.map((b) => [b.kind, b.day, b.title])).toEqual([
      ["busy", 1, "Busy"],
      ["busy", 3, "Work"],
    ]);
  });

  it("clips to the grid instead of spilling out of it", () => {
    const { blocks } = layoutWeek(
      [],
      [{ day: 1, begin: 7 * 60, end: 9 * 60, label: null }],
      {}
    );
    expect(blocks[0]!.top).toBe(0);
    expect(blocks[0]!.height).toBeCloseTo((60 / (GRID_END - GRID_START)) * 100);
  });

  it("lists what cannot be drawn: TBA times, weekends, and times outside the grid", () => {
    const { blocks, offGrid } = layoutWeek(
      [
        meeting("98-000", [1], "TBA", "TBA"),
        meeting("99-000", [6], "10:00AM", "10:50AM"),
        meeting("97-000", [1], "11:00PM", "11:50PM"),
      ],
      [{ day: 0, begin: 600, end: 660, label: null }],
      {}
    );
    expect(blocks).toEqual([]);
    expect(offGrid).toEqual([
      "98-000 Lec 1 (time not set)",
      "99-000 Lec 1 (Sat 10:00AM)",
      "97-000 Lec 1 (Mon 11:00PM)",
    ]);
  });
});

describe("layoutWeek columns for overlapping blocks", () => {
  const cols = (blocks: { title: string; col: number; cols: number }[]) =>
    Object.fromEntries(blocks.map((b) => [b.title, [b.col, b.cols]]));

  it("a block that overlaps nothing takes the whole width", () => {
    const { blocks } = layoutWeek(
      [meeting("15-213", [1], "10:00AM", "10:50AM")],
      [],
      {}
    );
    expect(cols(blocks)).toEqual({ "15-213": [0, 1] });
  });

  it("two overlapping blocks sit side by side", () => {
    const { blocks } = layoutWeek(
      [meeting("15-213", [1], "10:00AM", "10:50AM")],
      [{ day: 1, begin: 630, end: 690, label: "Work" }],
      {}
    );
    expect(cols(blocks)).toEqual({ "15-213": [0, 2], Work: [1, 2] });
  });

  it("a chain where only neighbours overlap shares one group and reuses a free column", () => {
    const { blocks } = layoutWeek(
      [
        meeting("A", [1], "09:00AM", "10:00AM"),
        meeting("B", [1], "09:30AM", "10:30AM"),
        meeting("C", [1], "10:15AM", "11:00AM"),
      ],
      [],
      {}
    );
    expect(cols(blocks)).toEqual({ A: [0, 2], B: [1, 2], C: [0, 2] });
  });

  it("blocks on different days never share columns", () => {
    const { blocks } = layoutWeek(
      [
        meeting("A", [1], "09:00AM", "10:00AM"),
        meeting("B", [2], "09:00AM", "10:00AM"),
      ],
      [],
      {}
    );
    expect(cols(blocks)).toEqual({ A: [0, 1], B: [0, 1] });
  });
});

describe("unplacedCourses", () => {
  const withFall = (courseID: string) => ({
    courseID,
    schedules: [
      { courseID, year: 2026, semester: "fall", lectures: [], sections: [] },
    ],
  });

  it("names courses that produced no meetings, and why", () => {
    const entries = unplacedCourses(
      ["95-867", "15-213", "21-127", "15-122"],
      [
        withFall("15-213"),
        { courseID: "21-127", schedules: [] },
        withFall("15-122"),
      ] as never,
      "Fall 2026",
      [meeting("15-122", [1], "10:00AM", "10:50AM")],
      ["95-867"]
    );
    expect(entries).toEqual([
      "95-867 (not in the catalog)",
      "15-213 (no section picked)",
      "21-127 (not offered Fall 2026)",
    ]);
  });

  it("says nothing about a course whose details are still unknown", () => {
    expect(unplacedCourses(["15-213"], [], "Fall 2026", [], [])).toEqual([]);
  });
});
