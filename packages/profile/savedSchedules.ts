import { z } from "zod";
import { PROFILE_SEMESTERS, SAVED_SUMMER_SESSIONS, type ProfileSemester } from "./schema";
import { publishedCourseSchema } from "./social";

/** How many named schedules one account can keep. */
export const SAVED_SCHEDULE_LIMIT = 20;
export const SAVED_SCHEDULE_COURSE_LIMIT = 30;

/**
 * A named schedule kept on the account: which semester, and the lecture/section picked for each
 * course. Sent without `id` to create, with `id` to replace one the caller owns.
 */
export const savedScheduleInputSchema = z
  .object({
    id: z
      .string()
      .regex(/^[a-f\d]{24}$/i, "Invalid schedule ID")
      .optional(),
    name: z.string().trim().min(1, "Give the schedule a name").max(80, "Name is too long"),
    semester: z.enum(PROFILE_SEMESTERS),
    year: z.string().regex(/^\d{4}$/),
    session: z.enum(SAVED_SUMMER_SESSIONS).nullable(),
    courses: z
      .array(publishedCourseSchema)
      .max(SAVED_SCHEDULE_COURSE_LIMIT, `At most ${SAVED_SCHEDULE_COURSE_LIMIT} courses`),
  })
  .strict()
  .refine(({ semester, session }) => session === null || semester === "summer", {
    message: "Only a summer can have a sub-session",
    path: ["session"],
  });

export const savedScheduleDeleteSchema = z
  .object({ id: z.string().regex(/^[a-f\d]{24}$/i, "Invalid schedule ID") })
  .strict();

export type SavedScheduleInput = z.input<typeof savedScheduleInputSchema>;

export interface SavedSchedule {
  id: string;
  name: string;
  semester: ProfileSemester;
  year: string;
  session: (typeof SAVED_SUMMER_SESSIONS)[number] | null;
  courses: { courseID: string; lecture: string | null; section: string | null }[];
  createdAt: string;
  updatedAt: string;
}
