/// <reference types="bun-types" />
import { beforeEach, describe, expect, test } from "bun:test";
import { fakeDb, resetFakeDb } from "../test/fakeDb";
import { call } from "../test/http";
import { deleteRating, submitRating } from "./ratings";

beforeEach(resetFakeDb);

const takenProfile = { courses: [{ courseID: "15-122", status: "TAKEN" }] };
const submit = (rating: Record<string, unknown>) => call(submitRating as never, "user_me", { rating });
const upsertArgs = () =>
  fakeDb.ratings!.upsert!.mock.calls[0]![0] as { update: Record<string, unknown>; create: Record<string, unknown> };

describe("submitRating: aggregate answers", () => {
  const course = { targetType: "COURSE", targetID: "15122", stars: 4 };

  test("stores workload, grading fairness and transparency on create and on update", async () => {
    fakeDb.profiles!.findUnique!.mockResolvedValue(takenProfile as never);
    const { status } = await submit({ ...course, workload: 5, gradingFairness: 2, transparency: 3 });
    expect(status).toBe(200);
    for (const data of [upsertArgs().update, upsertArgs().create]) {
      expect(data).toMatchObject({ workload: 5, gradingFairness: 2, transparency: 3 });
    }
  });

  test("an answer left out on an edit is cleared, like comment and wishIKnew", async () => {
    fakeDb.profiles!.findUnique!.mockResolvedValue(takenProfile as never);
    await submit(course);
    expect(upsertArgs().update).toMatchObject({ workload: null, gradingFairness: null, transparency: null });
  });

  test("an instructor rating never keeps workload, because that is a question about a course", async () => {
    fakeDb.profiles!.findUnique!.mockResolvedValue(takenProfile as never);
    fakeDb.schedules!.findMany!.mockResolvedValue([{ instructors: ["Jane Doe"] }] as never);
    const { status } = await submit({
      targetType: "INSTRUCTOR",
      targetID: "Jane Doe",
      stars: 5,
      workload: 4,
      gradingFairness: 4,
      transparency: 5,
    });
    expect(status).toBe(200);
    for (const data of [upsertArgs().update, upsertArgs().create]) {
      expect(data).toMatchObject({ workload: null, gradingFairness: 4, transparency: 5 });
    }
  });

  test("400 for an out-of-range answer, and nothing is stored", async () => {
    fakeDb.profiles!.findUnique!.mockResolvedValue(takenProfile as never);
    expect((await submit({ ...course, workload: 6 })).status).toBe(400);
    expect(fakeDb.ratings!.upsert!.mock.calls).toHaveLength(0);
  });
});

describe("submitRating: gating (unchanged, previously untested)", () => {
  test("403 for a course you have not taken", async () => {
    fakeDb.profiles!.findUnique!.mockResolvedValue({
      courses: [{ courseID: "15-122", status: "IN_PROGRESS" }],
    } as never);
    const { status } = await submit({ targetType: "COURSE", targetID: "15-122", stars: 4 });
    expect(status).toBe(403);
    expect(fakeDb.ratings!.upsert!.mock.calls).toHaveLength(0);
  });

  test("403 for an instructor who taught none of your taken courses", async () => {
    fakeDb.profiles!.findUnique!.mockResolvedValue(takenProfile as never);
    fakeDb.schedules!.findMany!.mockResolvedValue([{ instructors: ["Someone Else"] }] as never);
    expect((await submit({ targetType: "INSTRUCTOR", targetID: "Jane Doe", stars: 4 })).status).toBe(403);
  });

  test("403 without a profile", async () => {
    fakeDb.profiles!.findUnique!.mockResolvedValue(null as never);
    expect((await submit({ targetType: "COURSE", targetID: "15-122", stars: 4 })).status).toBe(403);
  });
});

describe("instructor names differ in case across the catalog", () => {
  test("a lower-case name matches a mixed-case schedule entry and is stored upper-cased", async () => {
    fakeDb.profiles!.findUnique!.mockResolvedValue(takenProfile as never);
    fakeDb.schedules!.findMany!.mockResolvedValue([{ instructors: ["Steier, David"] }] as never);
    const { status } = await submit({ targetType: "INSTRUCTOR", targetID: "steier, david", stars: 4 });
    expect(status).toBe(200);
    expect(upsertArgs().create).toMatchObject({ targetID: "STEIER, DAVID" });
  });
});

describe("deleteRating", () => {
  const remove = (body: Record<string, unknown>) => call(deleteRating as never, "user_me", body);

  test("deletes only the caller's own rating, under the normalized target", async () => {
    fakeDb.ratings!.deleteMany!.mockResolvedValue({ count: 1 } as never);
    const { status, body } = await remove({ targetType: "INSTRUCTOR", targetID: "Steier, David" });
    expect(status).toBe(200);
    expect(body).toEqual({ deleted: 1 });
    expect(fakeDb.ratings!.deleteMany!.mock.calls[0]![0]).toEqual({
      where: { clerkUserId: "user_me", targetType: "INSTRUCTOR", targetID: "STEIER, DAVID" },
    });
  });

  test("400 for an unknown target type, and nothing is deleted", async () => {
    expect((await remove({ targetType: "PROFESSOR", targetID: "x" })).status).toBe(400);
    expect(fakeDb.ratings!.deleteMany!.mock.calls).toHaveLength(0);
  });
});
