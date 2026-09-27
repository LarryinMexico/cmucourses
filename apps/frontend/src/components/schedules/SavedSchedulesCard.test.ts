/**
 * @jest-environment node
 */
jest.mock("@clerk/nextjs", () => ({ useAuth: () => ({}) }));
jest.mock("~/app/api/savedSchedules", () => ({}));
import { toSavedInput } from "./SavedSchedulesCard";
import type { UserSchedule } from "~/app/userSchedules";

const schedule = (over: Partial<UserSchedule> = {}): UserSchedule => ({
  id: "local",
  name: "My Schedule",
  courses: ["15-213", "21-127"],
  selected: ["15-213", "21-127"],
  session: { year: "2026", semester: "summer", session: "summer one" },
  courseSessions: {
    "15-213": { Lecture: "Lec 1", Section: "A", Color: "c1" },
    "21-127": { Lecture: "", Section: "", Color: "c2" },
  },
  numColors: 2,
  ...over,
});

describe("toSavedInput", () => {
  it("takes the semester, sub-session and picks; empty picks become null", () => {
    expect(toSavedInput(schedule(), "  Plan A ", false)).toEqual({
      name: "Plan A",
      semester: "summer",
      year: "2026",
      session: "summer one",
      courses: [
        { courseID: "15-213", lecture: "Lec 1", section: "A" },
        { courseID: "21-127", lecture: null, section: null },
      ],
    });
  });

  it("falls back to the schedule's own name and updates the copy it came from", () => {
    const input = toSavedInput(
      schedule({ savedId: "64b7f0c2a1d3e4f5a6b7c8d9" }),
      "",
      true
    );
    expect(input).toMatchObject({
      id: "64b7f0c2a1d3e4f5a6b7c8d9",
      name: "My Schedule",
    });
  });

  it("saves as new when the saved copy it came from is gone", () => {
    const input = toSavedInput(
      schedule({ savedId: "64b7f0c2a1d3e4f5a6b7c8d9" }),
      "",
      false
    );
    expect(input).not.toHaveProperty("id");
  });

  it("explains what is missing instead of saving", () => {
    expect(
      toSavedInput(
        schedule({ session: { year: "", semester: "" } }),
        "x",
        false
      )
    ).toBe("Pick a semester first");
    expect(toSavedInput(schedule({ courses: [] }), "x", false)).toBe(
      "Add courses first"
    );
  });

  it("drops a Qatar summer sub-session, which a saved schedule cannot hold", () => {
    const input = toSavedInput(
      schedule({
        session: { year: "2026", semester: "summer", session: "qatar summer" },
      }),
      "x",
      false
    );
    expect(input).toMatchObject({ session: null });
  });
});
