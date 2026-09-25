import { describe, expect, test } from "bun:test";
import { SAVED_SCHEDULE_LIMIT, savedScheduleInputSchema } from "./savedSchedules";

const base = {
  name: "Fall plan",
  semester: "fall",
  year: "2026",
  session: null,
  courses: [{ courseID: "15213", lecture: "Lec 1", section: "A" }],
};

describe("savedScheduleInputSchema", () => {
  test("accepts a schedule and standardizes course ids", () => {
    const parsed = savedScheduleInputSchema.parse(base);
    expect(parsed.courses[0]!.courseID).toBe("15-213");
    expect(parsed.id).toBeUndefined();
  });

  test("an update names the schedule by id", () => {
    expect(savedScheduleInputSchema.safeParse({ ...base, id: "64b7f0c2a1d3e4f5a6b7c8d9" }).success).toBe(true);
    expect(savedScheduleInputSchema.safeParse({ ...base, id: "nope" }).success).toBe(false);
  });

  test("trims the name and rejects an empty or long one", () => {
    expect(savedScheduleInputSchema.parse({ ...base, name: "  Plan A  " }).name).toBe("Plan A");
    expect(savedScheduleInputSchema.safeParse({ ...base, name: "  " }).success).toBe(false);
    expect(savedScheduleInputSchema.safeParse({ ...base, name: "x".repeat(81) }).success).toBe(false);
  });

  test("a summer sub-session only on a summer", () => {
    expect(savedScheduleInputSchema.safeParse({ ...base, semester: "summer", session: "summer one" }).success).toBe(
      true
    );
    expect(savedScheduleInputSchema.safeParse({ ...base, session: "summer one" }).success).toBe(false);
  });

  test("caps courses at 30 and rejects unknown keys", () => {
    const many = Array.from({ length: 31 }, (_, i) => ({ courseID: `15-${100 + i}`, lecture: null, section: null }));
    expect(savedScheduleInputSchema.safeParse({ ...base, courses: many }).success).toBe(false);
    expect(savedScheduleInputSchema.safeParse({ ...base, owner: "user_x" }).success).toBe(false);
  });

  test("the per-account limit is 20", () => {
    expect(SAVED_SCHEDULE_LIMIT).toBe(20);
  });
});
