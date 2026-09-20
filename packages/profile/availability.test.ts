import { describe, expect, test } from "bun:test";
import { availabilityFit, meetingGroupsFor, parseCatalogTime, type MeetingTime } from "./availability";
import type { BusyBlock } from "./schema";

const block = (day: number, begin: number, end: number, label: string | null = null): BusyBlock => ({
  day,
  begin,
  end,
  label,
});

/** One lecture meeting Mon/Wed 10:00-10:50AM. */
const monWed10: MeetingTime[] = [{ days: [1, 3], begin: "10:00AM", end: "10:50AM" }];

describe("parseCatalogTime", () => {
  test("parses the zero-padded AM/PM form the catalog actually uses", () => {
    expect(parseCatalogTime("08:00AM")).toBe(8 * 60);
    expect(parseCatalogTime("10:50AM")).toBe(10 * 60 + 50);
    expect(parseCatalogTime("01:30PM")).toBe(13 * 60 + 30);
    expect(parseCatalogTime("11:59PM")).toBe(23 * 60 + 59);
  });

  test("12PM is noon and 12AM is midnight", () => {
    expect(parseCatalogTime("12:00PM")).toBe(12 * 60);
    expect(parseCatalogTime("12:30PM")).toBe(12 * 60 + 30);
    expect(parseCatalogTime("12:00AM")).toBe(0);
    expect(parseCatalogTime("12:45AM")).toBe(45);
  });

  test("returns null for TBA and for malformed input", () => {
    expect(parseCatalogTime("TBA")).toBeNull();
    expect(parseCatalogTime("")).toBeNull();
    expect(parseCatalogTime("25:00AM")).toBeNull();
    expect(parseCatalogTime("10:60AM")).toBeNull();
    expect(parseCatalogTime("10:00")).toBeNull();
    expect(parseCatalogTime("noon")).toBeNull();
  });
});

describe("availabilityFit", () => {
  test("no busy blocks means we cannot say anything", () => {
    expect(availabilityFit([monWed10], []).status).toBe("UNKNOWN");
  });

  test("a course with no lectures is UNKNOWN", () => {
    expect(availabilityFit([], [block(1, 600, 660)]).status).toBe("UNKNOWN");
  });

  test("a lecture whose times are all TBA is UNKNOWN", () => {
    const tba: MeetingTime[] = [{ days: [1], begin: "TBA", end: "TBA" }];
    expect(availabilityFit([tba], [block(1, 600, 660)]).status).toBe("UNKNOWN");
  });

  test("a busy block on an overlapping day and time conflicts", () => {
    const result = availabilityFit([monWed10], [block(1, 10 * 60 + 30, 11 * 60, "Work")]);
    expect(result.status).toBe("CONFLICTS");
    expect(result.conflict?.label).toBe("Work");
  });

  test("a busy block on a different day does not conflict", () => {
    expect(availabilityFit([monWed10], [block(2, 600, 660)]).status).toBe("FITS");
  });

  test("a busy block at a different time on the same day does not conflict", () => {
    expect(availabilityFit([monWed10], [block(1, 13 * 60, 14 * 60)]).status).toBe("FITS");
  });

  test("back-to-back blocks touch but do not overlap", () => {
    // block ends exactly when class begins
    expect(availabilityFit([monWed10], [block(1, 9 * 60, 10 * 60)]).status).toBe("FITS");
    // block begins exactly when class ends
    expect(availabilityFit([monWed10], [block(1, 10 * 60 + 50, 11 * 60)]).status).toBe("FITS");
  });

  test("conflict is detected on the second day of a multi-day lecture", () => {
    expect(availabilityFit([monWed10], [block(3, 10 * 60, 10 * 60 + 10)]).status).toBe("CONFLICTS");
  });

  test("an end of 1440 covers the rest of the day", () => {
    const evening: MeetingTime[] = [{ days: [1], begin: "07:00PM", end: "09:50PM" }];
    expect(availabilityFit([evening], [block(1, 18 * 60, 1440)]).status).toBe("CONFLICTS");
  });

  test("FITS when at least one lecture is free, even if another conflicts", () => {
    const lecA: MeetingTime[] = [{ days: [1], begin: "10:00AM", end: "10:50AM" }];
    const lecB: MeetingTime[] = [{ days: [1], begin: "02:00PM", end: "02:50PM" }];
    expect(availabilityFit([lecA, lecB], [block(1, 600, 660)]).status).toBe("FITS");
  });

  test("CONFLICTS only when every lecture conflicts", () => {
    const lecA: MeetingTime[] = [{ days: [1], begin: "10:00AM", end: "10:50AM" }];
    const lecB: MeetingTime[] = [{ days: [1], begin: "10:30AM", end: "11:20AM" }];
    expect(availabilityFit([lecA, lecB], [block(1, 600, 660)]).status).toBe("CONFLICTS");
  });

  test("a lecture with one TBA time is judged on its remaining known times", () => {
    const mixed: MeetingTime[] = [
      { days: [1], begin: "TBA", end: "TBA" },
      { days: [5], begin: "09:00AM", end: "09:50AM" },
    ];
    expect(availabilityFit([mixed], [block(5, 9 * 60, 10 * 60)]).status).toBe("CONFLICTS");
    expect(availabilityFit([mixed], [block(1, 9 * 60, 10 * 60)]).status).toBe("FITS");
  });

  test("lectures with no parseable time are ignored rather than counted as free", () => {
    const tba: MeetingTime[] = [{ days: [1], begin: "TBA", end: "TBA" }];
    const busy: MeetingTime[] = [{ days: [1], begin: "10:00AM", end: "10:50AM" }];
    expect(availabilityFit([tba, busy], [block(1, 600, 660)]).status).toBe("CONFLICTS");
  });
});

describe("meetingGroupsFor", () => {
  const lec = (begin: string): { times: MeetingTime[] } => ({
    times: [{ days: [1], begin, end: "10:50AM" }],
  });

  test("uses lectures when they carry real times", () => {
    const groups = meetingGroupsFor([lec("10:00AM")], [lec("02:00PM")]);
    expect(groups).toEqual([[{ days: [1], begin: "10:00AM", end: "10:50AM" }]]);
  });

  test("falls back to sections when there are no lectures at all", () => {
    // 61% of the live catalog looks like this: the meeting is recorded as a section.
    const groups = meetingGroupsFor([], [lec("02:00PM")]);
    expect(groups).toEqual([[{ days: [1], begin: "02:00PM", end: "10:50AM" }]]);
  });

  test("falls back to sections when every lecture time is TBA", () => {
    const groups = meetingGroupsFor([lec("TBA")], [lec("02:00PM")]);
    expect(groups).toEqual([[{ days: [1], begin: "02:00PM", end: "10:50AM" }]]);
  });

  test("returns [] when neither has anything", () => {
    expect(meetingGroupsFor([], [])).toEqual([]);
  });

  test("keeps lectures even if sections also have times", () => {
    expect(meetingGroupsFor([lec("09:00AM")], [lec("09:00AM"), lec("11:00AM")])).toHaveLength(1);
  });
});
