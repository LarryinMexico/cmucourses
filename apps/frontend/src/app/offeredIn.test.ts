import { offeredInSessions } from "./offeredIn";

describe("offeredInSessions", () => {
  it("starts with next spring and ends with Fall 2020", () => {
    const sessions = offeredInSessions(2026);
    expect(sessions[0]).toEqual({ year: "2027", semester: "spring" });
    expect(sessions[1]).toEqual({ year: "2026", semester: "fall" });
    expect(sessions[sessions.length - 1]).toEqual({
      year: "2020",
      semester: "fall",
    });
  });

  it("lists each year's summer sub-sessions after its summer", () => {
    const sessions = offeredInSessions(2026);
    expect(sessions.slice(2, 6)).toEqual([
      { year: "2026", semester: "summer" },
      { year: "2026", semester: "summer", session: "summer one" },
      { year: "2026", semester: "summer", session: "summer two" },
      { year: "2026", semester: "summer", session: "summer all" },
    ]);
    // next spring + 6 years x 6 entries + Fall 2020
    expect(sessions).toHaveLength(1 + 6 * 6 + 1);
  });
});
