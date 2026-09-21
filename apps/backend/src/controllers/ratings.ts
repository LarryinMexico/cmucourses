import { RequestHandler } from "express";
import db, { RatingTargetType } from "@cmucourses/db";
import { ratingPatchSchema, RatingPatchInput } from "@cmucourses/profile";
import { ElemType, exclude, PrismaReturn, standardizeID } from "~/util";
import { UserLocals } from "~/controllers/user";

type RatingDoc = ElemType<PrismaReturn<typeof db.ratings.findMany>>;

const VALID_TARGET_TYPES: readonly string[] = ["COURSE", "INSTRUCTOR"];

/** courseID gets standardized ("15122" -> "15-122"); an instructor name is used as-is. */
const resolveTargetID = (targetType: string, targetID: string): string =>
  targetType === "COURSE" ? standardizeID(targetID) : targetID;

// ---- POST /ratings — other students' ratings for a course/instructor. ----

export interface GetRatings {
  params: unknown;
  resBody: Omit<RatingDoc, "id" | "clerkUserId">[] | { error: string };
  reqBody: unknown;
  query: { targetType: string; targetID: string };
}

export const getRatings: RequestHandler<
  GetRatings["params"],
  GetRatings["resBody"],
  GetRatings["reqBody"],
  GetRatings["query"]
> = async (req, res, next) => {
  const { targetType, targetID } = req.query;
  if (!VALID_TARGET_TYPES.includes(targetType)) {
    res.status(400).json({ error: `Unknown targetType "${targetType}"` });
    return;
  }

  try {
    const docs = await db.ratings.findMany({
      where: { targetType: targetType as RatingTargetType, targetID: resolveTargetID(targetType, targetID) },
    });
    // Strip clerkUserId on every list response, regardless of auth, so another student's
    // identity never leaks into a listing even though this route is already sign-in gated.
    res.json(docs.map((doc) => exclude(doc, "id", "clerkUserId")));
  } catch (e) {
    next(e);
  }
};

// ---- POST /user/rating — the caller's own rating for a target, null if they haven't rated it. ----

export interface GetOwnRating {
  params: unknown;
  resBody: Omit<RatingDoc, "id"> | null | { error: string };
  reqBody: { token: string; targetType: string; targetID: string };
  query: unknown;
}

export const getOwnRating: RequestHandler<
  GetOwnRating["params"],
  GetOwnRating["resBody"],
  GetOwnRating["reqBody"],
  GetOwnRating["query"],
  UserLocals
> = async (req, res, next) => {
  const { targetType, targetID } = req.body;
  if (!VALID_TARGET_TYPES.includes(targetType)) {
    res.status(400).json({ error: `Unknown targetType "${targetType}"` });
    return;
  }

  try {
    const doc = await db.ratings.findUnique({
      where: {
        clerkUserId_targetType_targetID: {
          clerkUserId: res.locals.userId,
          targetType: targetType as RatingTargetType,
          targetID: resolveTargetID(targetType, targetID),
        },
      },
    });
    res.json(doc ? exclude(doc, "id") : null);
  } catch (e) {
    next(e);
  }
};

// ---- PATCH /user/rating — upsert the caller's own rating. Course ratings require the course to
// be marked TAKEN in the caller's profile; instructor ratings require a TAKEN course that
// instructor taught (there is no stable professor id anywhere in this codebase — fces.instructor
// and schedules.instructors are both free-text names, so this is the only exact check available). ----

type ValidationError = {
  error: "ValidationError";
  issues: { path: (string | number)[]; message: string }[];
};

export interface SubmitRating {
  params: unknown;
  resBody: Omit<RatingDoc, "id"> | ValidationError | { error: string };
  reqBody: { token: string; rating: RatingPatchInput };
  query: unknown;
}

export const submitRating: RequestHandler<
  SubmitRating["params"],
  SubmitRating["resBody"],
  SubmitRating["reqBody"],
  SubmitRating["query"],
  UserLocals
> = async (req, res, next) => {
  const parsed = ratingPatchSchema.safeParse(req.body.rating);
  if (!parsed.success) {
    res.status(400).json({
      error: "ValidationError",
      issues: parsed.error.issues.map(({ path, message }) => ({ path, message })),
    });
    return;
  }

  const { targetType, targetID, stars, comment, wishIKnew } = parsed.data;

  try {
    const profile = await db.profiles.findUnique({ where: { clerkUserId: res.locals.userId } });

    if (targetType === "COURSE") {
      const taken = profile?.courses.some((c) => c.courseID === targetID && c.status === "TAKEN") ?? false;
      if (!taken) {
        res.status(403).json({ error: "You can only rate a course marked Taken in your profile." });
        return;
      }
    } else {
      const takenIDs = (profile?.courses ?? []).filter((c) => c.status === "TAKEN").map((c) => c.courseID);
      const taughtByInstructor =
        takenIDs.length > 0 &&
        (await db.schedules.findFirst({ where: { courseID: { in: takenIDs }, instructors: { has: targetID } } }));
      if (!taughtByInstructor) {
        res.status(403).json({
          error: "You can only rate an instructor who taught a course marked Taken in your profile.",
        });
        return;
      }
    }

    const doc = await db.ratings.upsert({
      where: { clerkUserId_targetType_targetID: { clerkUserId: res.locals.userId, targetType, targetID } },
      update: { stars, comment: comment ?? null, wishIKnew: wishIKnew ?? null },
      create: {
        clerkUserId: res.locals.userId,
        targetType,
        targetID,
        stars,
        comment: comment ?? null,
        wishIKnew: wishIKnew ?? null,
      },
    });
    res.json(exclude(doc, "id"));
  } catch (e) {
    next(e);
  }
};
