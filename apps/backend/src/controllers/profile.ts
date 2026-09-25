import { RequestHandler } from "express";
import db from "@cmucourses/db";
import {
  CLASS_TIME_BUCKETS,
  DEFAULT_SCHEDULE_PREFERENCES,
  DEFAULT_VISIBILITY,
  emptyProfile,
  Profile,
  PROFILE_SEMESTERS,
  profilePatchSchema,
  ProfilePatchInput,
  ProfileSemester,
  SAVED_SUMMER_SESSIONS,
} from "@cmucourses/profile";
import { PrismaReturn } from "~/util";
import { UserLocals } from "~/controllers/user";

type ProfileDoc = NonNullable<PrismaReturn<typeof db.profiles.findUnique>>;

type ValidationError = {
  error: "ValidationError";
  issues: { path: (string | number)[]; message: string }[];
};

// Semesters are plain strings in Mongo; anything unexpected reads back as unset.
const toSemester = (semester: string | null | undefined): ProfileSemester | null =>
  PROFILE_SEMESTERS.find((known) => known === semester) ?? null;

const isClassTimeBucket = (value: string): value is (typeof CLASS_TIME_BUCKETS)[number] =>
  (CLASS_TIME_BUCKETS as readonly string[]).includes(value);

const toSavedSession = (session: string | null | undefined) =>
  SAVED_SUMMER_SESSIONS.find((known) => known === session) ?? null;

const toProfile = (doc: ProfileDoc): Profile => ({
  displayName: doc.displayName,
  bio: doc.bio,
  careers: doc.careers,
  skillsHave: doc.skillsHave,
  skillsWant: doc.skillsWant,
  academic: doc.academic && {
    college: doc.academic.college ?? null,
    majors: doc.academic.majors,
    minors: doc.academic.minors,
    degree: doc.academic.degree ?? null,
    gradSemester: toSemester(doc.academic.gradSemester),
    gradYear: doc.academic.gradYear ?? null,
  },
  workload: doc.workload && {
    unitsMin: doc.workload.unitsMin ?? null,
    unitsMax: doc.workload.unitsMax ?? null,
    hoursPerWeek: doc.workload.hoursPerWeek ?? null,
  },
  modality: doc.modality,
  busyBlocks: doc.busyBlocks.map(({ day, begin, end, label }) => ({ day, begin, end, label: label ?? null })),
  schedulePreferences: doc.schedulePreferences
    ? {
        earliestStart: doc.schedulePreferences.earliestStart ?? null,
        latestEnd: doc.schedulePreferences.latestEnd ?? null,
        preferredDays: doc.schedulePreferences.preferredDays,
        compactDays: doc.schedulePreferences.compactDays,
      }
    : { ...DEFAULT_SCHEDULE_PREFERENCES },
  courses: doc.courses.map(({ courseID, status, semester, year }) => ({
    courseID,
    status,
    semester: toSemester(semester),
    year: year ?? null,
  })),
  plannedCourses: (doc.plannedCourses ?? []).map(({ courseID, semester, year }) => ({
    courseID,
    semester: toSemester(semester) ?? "fall",
    year,
  })),
  // busyLabels is missing on profiles saved before it existed; that reads as private.
  visibility: { ...doc.visibility, busyLabels: doc.visibility.busyLabels ?? "PRIVATE" },
  // A stored optional column that was never set is absent, not null, so each one is normalized.
  savedFilters: doc.savedFilters
    ? {
        departments: doc.savedFilters.departments,
        unitsMin: doc.savedFilters.unitsMin ?? null,
        unitsMax: doc.savedFilters.unitsMax ?? null,
        sessions: doc.savedFilters.sessions.map(({ year, semester, session }) => ({
          year,
          semester: toSemester(semester) ?? "fall",
          session: toSavedSession(session),
        })),
        levels: doc.savedFilters.levels,
        classTimes: doc.savedFilters.classTimes.filter(isClassTimeBucket),
        meetingDays: doc.savedFilters.meetingDays,
        timeBegin: doc.savedFilters.timeBegin ?? null,
        timeEnd: doc.savedFilters.timeEnd ?? null,
        fitAvailability: doc.savedFilters.fitAvailability,
        matchGoals: doc.savedFilters.matchGoals,
      }
    : null,
  onboardedAt: doc.onboardedAt?.toISOString() ?? null,
  updatedAt: doc.updatedAt.toISOString(),
});

export interface GetProfile {
  params: unknown;
  resBody: Profile;
  reqBody: { token: string };
  query: unknown;
}

export const getProfile: RequestHandler<
  GetProfile["params"],
  GetProfile["resBody"],
  GetProfile["reqBody"],
  GetProfile["query"],
  UserLocals
> = async (req, res, next) => {
  try {
    const doc = await db.profiles.findUnique({ where: { clerkUserId: res.locals.userId } });
    res.json(doc ? toProfile(doc) : emptyProfile());
  } catch (e) {
    next(e);
  }
};

export interface PatchProfile {
  params: unknown;
  resBody: Profile | ValidationError;
  reqBody: { token: string; profile: ProfilePatchInput };
  query: unknown;
}

export const patchProfile: RequestHandler<
  PatchProfile["params"],
  PatchProfile["resBody"],
  PatchProfile["reqBody"],
  PatchProfile["query"],
  UserLocals
> = async (req, res, next) => {
  const parsed = profilePatchSchema.safeParse(req.body.profile);
  if (!parsed.success) {
    res.status(400).json({
      error: "ValidationError",
      issues: parsed.error.issues.map(({ path, message }) => ({ path, message })),
    });
    return;
  }

  // Every section present in the patch replaces the stored one wholesale.
  const { completeOnboarding, ...sections } = parsed.data;
  const onboarding = completeOnboarding ? { onboardedAt: new Date() } : {};

  try {
    const doc = await db.profiles.upsert({
      where: { clerkUserId: res.locals.userId },
      update: { ...sections, ...onboarding },
      create: {
        ...sections,
        ...onboarding,
        clerkUserId: res.locals.userId,
        visibility: sections.visibility ?? DEFAULT_VISIBILITY,
      },
    });
    res.json(toProfile(doc));
  } catch (e) {
    next(e);
  }
};
