/// <reference types="bun-types" />
import { beforeEach, describe, expect, test } from "bun:test";
import { fakeDb, resetFakeDb } from "../test/fakeDb";
import { call } from "../test/http";
import { getProfile, patchProfile } from "./profile";

beforeEach(resetFakeDb);

const saved = {
  departments: ["Computer Science"],
  unitsMin: 9,
  unitsMax: 12,
  sessions: [
    { year: "2026", semester: "fall", session: null },
    { year: "2026", semester: "summer", session: "summer one" },
  ],
  levels: [1, 2],
  classTimes: ["morning"],
  meetingDays: [1, 3],
  timeBegin: 480,
  timeEnd: 1080,
  fitAvailability: true,
  matchGoals: false,
};

/** A stored profile document with every column the wire mapping reads. */
const doc = (extra: Record<string, unknown> = {}) => ({
  displayName: null,
  bio: null,
  careers: [],
  skillsHave: [],
  skillsWant: [],
  academic: null,
  workload: null,
  modality: null,
  busyBlocks: [],
  schedulePreferences: null,
  courses: [],
  plannedCourses: [],
  visibility: { academic: "PRIVATE", careers: "PRIVATE", skills: "PRIVATE", courses: "PRIVATE" },
  onboardedAt: null,
  updatedAt: new Date("2026-09-23T00:00:00Z"),
  ...extra,
});

describe("saved filters on the profile", () => {
  test("a profile that never saved any reads back as null", async () => {
    fakeDb.profiles!.findUnique!.mockResolvedValue(doc() as never);
    const { body } = await call(getProfile as never, "user_me");
    expect((body as { savedFilters: unknown }).savedFilters).toBeNull();
  });

  test("a stored set maps to the wire shape, with absent optional columns as null", async () => {
    fakeDb.profiles!.findUnique!.mockResolvedValue(
      doc({
        savedFilters: {
          ...saved,
          unitsMin: undefined, // absent, as MongoDB stores an unset optional
          unitsMax: undefined,
          timeBegin: undefined,
          timeEnd: undefined,
          sessions: [{ year: "2026", semester: "fall" }],
        },
      }) as never
    );
    const { body } = await call(getProfile as never, "user_me");
    expect((body as { savedFilters: unknown }).savedFilters).toEqual({
      ...saved,
      unitsMin: null,
      unitsMax: null,
      timeBegin: null,
      timeEnd: null,
      sessions: [{ year: "2026", semester: "fall", session: null }],
    });
  });

  test("saving one validates it and stores it as part of the profile", async () => {
    fakeDb.profiles!.upsert!.mockResolvedValue(doc({ savedFilters: saved }) as never);
    const { status, body } = await call(patchProfile as never, "user_me", { profile: { savedFilters: saved } });
    expect(status).toBe(200);
    const [args] = fakeDb.profiles!.upsert!.mock.calls[0] as [
      { update: Record<string, unknown>; create: Record<string, unknown> },
    ];
    expect(args.update.savedFilters).toEqual(saved);
    expect(args.create.savedFilters).toEqual(saved);
    expect((body as { savedFilters: unknown }).savedFilters).toEqual(saved);
  });

  test("clearing it sends null, so the stored set is removed", async () => {
    fakeDb.profiles!.upsert!.mockResolvedValue(doc() as never);
    await call(patchProfile as never, "user_me", { profile: { savedFilters: null } });
    const [args] = fakeDb.profiles!.upsert!.mock.calls[0] as [{ update: Record<string, unknown> }];
    expect(args.update.savedFilters).toBeNull();
  });

  test("400 for an invalid set, and nothing is written", async () => {
    const { status } = await call(patchProfile as never, "user_me", {
      profile: { savedFilters: { ...saved, timeBegin: 900, timeEnd: 600 } },
    });
    expect(status).toBe(400);
    expect(fakeDb.profiles!.upsert!.mock.calls).toHaveLength(0);
  });
});
