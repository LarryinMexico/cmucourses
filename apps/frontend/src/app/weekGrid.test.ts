import { GRID_END, GRID_START, layoutWeek } from "./weekGrid";

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
