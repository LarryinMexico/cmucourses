/// <reference types="bun-types" />
import { beforeEach, describe, expect, test } from "bun:test";
import { fakeDb, resetFakeDb } from "../test/fakeDb";
import { call } from "../test/http";
import { deleteSavedSchedule, listSavedSchedules, saveSchedule } from "./savedSchedules";

const ID = "64b7f0c2a1d3e4f5a6b7c8d9";
const row = (over: object = {}) => ({
  id: ID,
  clerkUserId: "user_me",
  name: "Fall plan",
  semester: "fall",
  year: "2026",
  session: null,
  courses: [{ courseID: "15-213", lecture: "Lec 1", section: null }],
  createdAt: new Date("2026-09-01T00:00:00Z"),
  updatedAt: new Date("2026-09-02T00:00:00Z"),
  ...over,
});
const input = {
  name: "Fall plan",
  semester: "fall",
  year: "2026",
  session: null,
  courses: [{ courseID: "15213", lecture: "Lec 1", section: null }],
};

beforeEach(resetFakeDb);

describe("listSavedSchedules", () => {
  test("lists only the caller's, newest first, without the owner id", async () => {
    fakeDb.savedSchedules!.findMany!.mockResolvedValue([row()] as never);
    const { body } = await call(listSavedSchedules as never, "user_me");
    expect(fakeDb.savedSchedules!.findMany!.mock.calls[0]).toEqual([
      { where: { clerkUserId: "user_me" }, orderBy: { updatedAt: "desc" } },
    ]);
    expect(body).toEqual([
      {
        id: ID,
        name: "Fall plan",
        semester: "fall",
        year: "2026",
        session: null,
        courses: [{ courseID: "15-213", lecture: "Lec 1", section: null }],
        createdAt: "2026-09-01T00:00:00.000Z",
        updatedAt: "2026-09-02T00:00:00.000Z",
      },
    ]);
  });
});

describe("saveSchedule", () => {
  const save = (schedule: unknown) => call(saveSchedule as never, "user_me", { schedule });

  test("creates a new one under the caller", async () => {
    fakeDb.savedSchedules!.count!.mockResolvedValue(3 as never);
    fakeDb.savedSchedules!.create!.mockResolvedValue(row() as never);
    const { status } = await save(input);
    expect(status).toBe(200);
    expect(fakeDb.savedSchedules!.create!.mock.calls[0]).toMatchObject([
      { data: { clerkUserId: "user_me", name: "Fall plan", courses: [{ courseID: "15-213" }] } },
    ]);
  });

  test("400 once the account holds 20", async () => {
    fakeDb.savedSchedules!.count!.mockResolvedValue(20 as never);
    const { status, body } = await save(input);
    expect(status).toBe(400);
    expect((body as { error: string }).error).toMatch(/20/);
    expect(fakeDb.savedSchedules!.create!.mock.calls).toHaveLength(0);
  });

  test("updates one the caller owns", async () => {
    fakeDb.savedSchedules!.findUnique!.mockResolvedValue(row() as never);
    fakeDb.savedSchedules!.update!.mockResolvedValue(row({ name: "Renamed" }) as never);
    const { status } = await save({ ...input, id: ID, name: "Renamed" });
    expect(status).toBe(200);
    expect(fakeDb.savedSchedules!.update!.mock.calls[0]).toMatchObject([
      { where: { id: ID }, data: { name: "Renamed" } },
    ]);
  });

  test("404 when updating someone else's or a missing one", async () => {
    fakeDb.savedSchedules!.findUnique!.mockResolvedValue(row({ clerkUserId: "user_other" }) as never);
    expect((await save({ ...input, id: ID })).status).toBe(404);
    fakeDb.savedSchedules!.findUnique!.mockResolvedValue(null as never);
    expect((await save({ ...input, id: ID })).status).toBe(404);
    expect(fakeDb.savedSchedules!.update!.mock.calls).toHaveLength(0);
  });

  test("400 for an invalid schedule", async () => {
    expect((await save({ ...input, name: "" })).status).toBe(400);
  });
});

describe("deleteSavedSchedule", () => {
  const remove = (id: unknown) => call(deleteSavedSchedule as never, "user_me", { id });

  test("deletes the caller's own", async () => {
    fakeDb.savedSchedules!.findUnique!.mockResolvedValue(row() as never);
    expect((await remove(ID)).status).toBe(200);
    expect(fakeDb.savedSchedules!.delete!.mock.calls[0]).toEqual([{ where: { id: ID } }]);
  });

  test("404 for someone else's, 400 for a malformed id", async () => {
    fakeDb.savedSchedules!.findUnique!.mockResolvedValue(row({ clerkUserId: "user_other" }) as never);
    expect((await remove(ID)).status).toBe(404);
    expect((await remove("x")).status).toBe(400);
    expect(fakeDb.savedSchedules!.delete!.mock.calls).toHaveLength(0);
  });
});
