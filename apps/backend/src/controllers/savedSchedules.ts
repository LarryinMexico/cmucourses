import { RequestHandler } from "express";
import db from "@cmucourses/db";
import {
  PROFILE_SEMESTERS,
  SAVED_SCHEDULE_LIMIT,
  SAVED_SUMMER_SESSIONS,
  savedScheduleDeleteSchema,
  savedScheduleInputSchema,
  type SavedSchedule,
} from "@cmucourses/profile";
import { UserLocals } from "./user";

type ErrorBody = { error: string };

type Row = NonNullable<Awaited<ReturnType<typeof db.savedSchedules.findUnique>>>;

const toWire = (row: Row): SavedSchedule => ({
  id: row.id,
  name: row.name,
  semester: PROFILE_SEMESTERS.find((s) => s === row.semester) ?? "fall",
  year: row.year,
  session: SAVED_SUMMER_SESSIONS.find((s) => s === row.session) ?? null,
  courses: row.courses.map(({ courseID, lecture, section }) => ({
    courseID,
    lecture: lecture ?? null,
    section: section ?? null,
  })),
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

/** The caller's named schedules, newest first. Nobody else's are ever readable. */
export const listSavedSchedules: RequestHandler<
  unknown,
  SavedSchedule[] | ErrorBody,
  { token: string },
  unknown,
  UserLocals
> = async (_req, res, next) => {
  try {
    const rows = await db.savedSchedules.findMany({
      where: { clerkUserId: res.locals.userId },
      orderBy: { updatedAt: "desc" },
    });
    res.json(rows.map(toWire));
  } catch (error) {
    next(error);
  }
};

/** Creates a schedule, or replaces one the caller owns when `id` is given. */
export const saveSchedule: RequestHandler<
  unknown,
  SavedSchedule | ErrorBody,
  { token: string; schedule: unknown },
  unknown,
  UserLocals
> = async (req, res, next) => {
  const parsed = savedScheduleInputSchema.safeParse(req.body.schedule);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid schedule" });
    return;
  }
  const { id, ...data } = parsed.data;
  const me = res.locals.userId;
  try {
    if (id) {
      const existing = await db.savedSchedules.findUnique({ where: { id } });
      if (!existing || existing.clerkUserId !== me) {
        res.status(404).json({ error: "Schedule not found" });
        return;
      }
      res.json(toWire(await db.savedSchedules.update({ where: { id }, data })));
      return;
    }
    if ((await db.savedSchedules.count({ where: { clerkUserId: me } })) >= SAVED_SCHEDULE_LIMIT) {
      res.status(400).json({ error: `You can keep at most ${SAVED_SCHEDULE_LIMIT} schedules; delete one first` });
      return;
    }
    res.json(toWire(await db.savedSchedules.create({ data: { ...data, clerkUserId: me } })));
  } catch (error) {
    next(error);
  }
};

export const deleteSavedSchedule: RequestHandler<
  unknown,
  { ok: true } | ErrorBody,
  { token: string; id: unknown },
  unknown,
  UserLocals
> = async (req, res, next) => {
  const parsed = savedScheduleDeleteSchema.safeParse({ id: req.body.id });
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid schedule ID" });
    return;
  }
  try {
    const existing = await db.savedSchedules.findUnique({ where: { id: parsed.data.id } });
    if (!existing || existing.clerkUserId !== res.locals.userId) {
      res.status(404).json({ error: "Schedule not found" });
      return;
    }
    await db.savedSchedules.delete({ where: { id: existing.id } });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
};
