/// <reference types="bun-types" />
import { beforeEach, describe, expect, test } from "bun:test";
import { fakeDb, resetFakeDb } from "../test/fakeDb";
import { fakeRes } from "../test/http";
import { getFilteredCourses } from "./courses";
import { searchQuerySchema } from "./courseQuery";

beforeEach(resetFakeDb);

const search = async (query: Record<string, unknown>) => {
  fakeDb.courses!.aggregateRaw!.mockResolvedValue([{ metadata: [{ totalDocs: 0 }], data: [] }] as never);
  const res = fakeRes("");
  const errors: unknown[] = [];
  await getFilteredCourses(
    { query, body: {}, params: {} } as never,
    res as never,
    ((e: unknown) => errors.push(e)) as never
  );
  return { status: res.statusCode, body: res.body as Record<string, unknown>, errors };
};

const pipelineSent = () =>
  (fakeDb.courses!.aggregateRaw!.mock.calls[0]![0] as { pipeline: Record<string, unknown>[] }).pipeline;

describe("searchQuerySchema", () => {
  // Every shape fetchCourseInfosByPage (apps/frontend/src/app/api/course.ts) can send.
  const frontendQueries: Record<string, unknown>[] = [
    { page: "1", schedules: "true" },
    { page: "3", schedules: "true", keywords: "15-122 machine learning" },
    { page: "1", schedules: "true", department: "Computer Science" },
    { page: "1", schedules: "true", department: ["Computer Science", "Mathematical Sciences"] },
    { page: "1", schedules: "true", unitsMin: "0", unitsMax: "12" },
    { page: "1", schedules: "true", session: JSON.stringify({ year: 2026, semester: "fall" }) },
    {
      page: "1",
      schedules: "true",
      session: [
        JSON.stringify({ year: 2026, semester: "summer", session: "summer one" }),
        JSON.stringify({ year: 2026, semester: "fall" }),
      ],
    },
    { page: "1", schedules: "true", classTimes: "tba" },
    { page: "1", schedules: "true", classTimes: ["morning", "afternoon", "evening", "tba"] },
    { page: "1", schedules: "true", meetingDays: ["1", "3", "5"] },
    { page: "1", schedules: "true", timeBegin: "480", timeEnd: "1440" },
    { page: "1", schedules: "true", busy: ["1,540,600", "3,0,1440"] },
    { page: "1", schedules: "true", levels: "0123456789" },
    { page: "1", schedules: "true", levels: "4" },
  ];

  test.each(frontendQueries)("accepts what the frontend sends: %j", (query) => {
    expect(searchQuerySchema.safeParse(query).success).toBe(true);
  });

  test("strips unknown parameters instead of rejecting them", () => {
    const parsed = searchQuerySchema.safeParse({ page: "1", sort: "x" });
    expect(parsed.success && "sort" in parsed.data).toBe(false);
  });

  const malicious: [string, Record<string, unknown>][] = [
    ["regex alternation in levels", { levels: "]|.*" }],
    ["catastrophic backtracking in levels", { levels: "(a+)+$" }],
    ["character class escape in levels", { levels: "0-9]\\d{99999}[" }],
    ["operator object in levels (qs levels[$ne]=1)", { levels: { $ne: "1" } }],
    ["levels given twice", { levels: ["1", "2"] }],
    ["keywords given twice", { keywords: ["a", "b"] }],
    ["object department", { department: { $regex: ".*" } }],
    ["meeting day 7", { meetingDays: "7" }],
    ["non-numeric time", { timeBegin: "abc", timeEnd: "600" }],
    ["time past midnight", { timeBegin: "0", timeEnd: "1441" }],
    ["non-numeric page", { page: "abc" }],
    ["page 0", { page: "0" }],
    ["unknown class time", { classTimes: "night" }],
    ["schedules not a boolean literal", { schedules: "yes" }],
    ["too many busy blocks", { busy: Array.from({ length: 51 }, () => "1,0,60") }],
    ["very long keywords", { keywords: "a".repeat(201) }],
  ];

  test.each(malicious)("rejects %s", (_name, query) => {
    expect(searchQuerySchema.safeParse(query).success).toBe(false);
  });
});

describe("getFilteredCourses: validation", () => {
  test("a malformed query is a 400 with issues and never reaches the database", async () => {
    const { status, body } = await search({ levels: "]|.*" });
    expect(status).toBe(400);
    expect(Array.isArray(body.issues)).toBe(true);
    expect(fakeDb.courses!.aggregateRaw!).not.toHaveBeenCalled();
  });

  test("a non-numeric page is a 400, not a 500", async () => {
    const { status, errors } = await search({ page: "abc" });
    expect(status).toBe(400);
    expect(errors).toHaveLength(0);
  });

  test("valid levels become a digits-only character class", async () => {
    const { status } = await search({ levels: "45" });
    expect(status).toBe(200);
    expect(pipelineSent()[0]).toEqual({ $match: { courseID: { $regex: "\\d\\d-[45]\\d\\d" } } });
  });
});
