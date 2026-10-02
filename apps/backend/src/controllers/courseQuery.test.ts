/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";
import { courseIDsInKeywords, MAX_BUSY_BLOCKS, parseBusyBlocks, parseSessions } from "./courseQuery";

const session = (value: object) => JSON.stringify(value);

describe("parseSessions", () => {
  test("reads a year and semester", () => {
    expect(parseSessions([session({ year: "2026", semester: "fall" })])).toEqual([{ year: 2026, semester: "fall" }]);
  });

  test("keeps a summer sub-session", () => {
    expect(parseSessions([session({ year: "2026", semester: "summer", session: "summer one" })])).toEqual([
      { year: 2026, semester: "summer", session: "summer one" },
    ]);
    for (const name of ["summer one", "summer two", "summer all"]) {
      expect(parseSessions([session({ year: "2025", semester: "summer", session: name })])).toHaveLength(1);
    }
  });

  test("a plain summer entry stays plain, so it matches every summer sub-session", () => {
    const [parsed] = parseSessions([session({ year: "2026", semester: "summer" })]);
    expect(parsed).toEqual({ year: 2026, semester: "summer" });
    expect("session" in parsed!).toBe(false);
  });

  test("drops entries it cannot honour rather than widening them", () => {
    expect(
      parseSessions([
        "not json",
        session({ year: "soon", semester: "fall" }),
        session({ year: "2026", semester: "winter" }),
        session({ year: "2026", semester: "summer", session: "qatar summer" }),
        session({ year: "2026", semester: "summer", session: "summer nine" }),
        session({ year: "2026", semester: "fall", session: "summer one" }),
      ])
    ).toEqual([]);
  });

  test("keeps the valid ones next to invalid ones", () => {
    expect(parseSessions(["nope", session({ year: "2024", semester: "spring" })])).toEqual([
      { year: 2024, semester: "spring" },
    ]);
  });
});

describe("parseBusyBlocks", () => {
  test("reads day,begin,end triples", () => {
    expect(parseBusyBlocks(["1,480,540", "3,600,660"])).toEqual([
      { day: 1, begin: 480, end: 540 },
      { day: 3, begin: 600, end: 660 },
    ]);
  });

  test("ignores anything malformed or out of range", () => {
    expect(
      parseBusyBlocks([
        "",
        "x",
        "1,2",
        "1,2,3,4",
        "7,0,10", // no day 7
        "-1,0,10",
        "1,-5,10",
        "1,600,500", // ends before it begins
        "1,600,600", // empty
        "1,0,1441", // past midnight
        "1.5,0,10",
        "1,0,ten",
      ])
    ).toEqual([]);
  });

  test("accepts the whole day, Sunday through Saturday", () => {
    expect(parseBusyBlocks(["0,0,1440", "6,0,1"])).toHaveLength(2);
  });

  test(`keeps at most ${MAX_BUSY_BLOCKS}`, () => {
    const many = Array.from({ length: MAX_BUSY_BLOCKS + 20 }, (_, i) => `1,${i},${i + 1}`);
    expect(parseBusyBlocks(many)).toHaveLength(MAX_BUSY_BLOCKS);
  });
});

describe("courseIDsInKeywords", () => {
  test("finds course numbers with or without the hyphen, standardized and deduplicated", () => {
    expect(courseIDsInKeywords("36-613")).toEqual(["36-613"]);
    expect(courseIDsInKeywords("36613 and 15-122, 36-613")).toEqual(["36-613", "15-122"]);
  });

  test("ignores plain words and longer numbers", () => {
    expect(courseIDsInKeywords("machine learning")).toEqual([]);
    expect(courseIDsInKeywords("1234567")).toEqual([]);
  });
});
