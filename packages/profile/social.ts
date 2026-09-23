import { z } from "zod";
import { PROFILE_SEMESTERS, standardizeCourseID } from "./schema";

export const SOCIAL_REACTIONS = ["👍", "🎉", "🔥", "📚"] as const;

const publishedCourseSchema = z
  .object({
    courseID: z
      .string()
      .transform(standardizeCourseID)
      .refine((value) => /^\d{2}-\d{3}$/.test(value), "Invalid course ID"),
    lecture: z.string().max(50).nullable(),
    section: z.string().max(50).nullable(),
  })
  .strict();

export const publishedScheduleSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    semester: z.enum(PROFILE_SEMESTERS),
    year: z.string().regex(/^\d{4}$/),
    courses: z.array(publishedCourseSchema).max(30),
  })
  .strict();

/** A profile is addressed by its database id everywhere in the social API; Clerk ids never leave the server. */
export const profileIDSchema = z.string().regex(/^[a-f\d]{24}$/i, "Invalid profile ID");

export const publishScheduleInputSchema = z.object({ schedule: publishedScheduleSchema.nullable() }).strict();

export const followInputSchema = z
  .object({
    profileID: profileIDSchema,
    follow: z.boolean(),
  })
  .strict();

export const reactionInputSchema = z
  .object({
    profileID: profileIDSchema,
    reaction: z.enum(SOCIAL_REACTIONS).nullable(),
  })
  .strict();

export type PublishedSchedule = z.output<typeof publishedScheduleSchema>;
export type SocialReaction = (typeof SOCIAL_REACTIONS)[number];

export interface SocialDirectoryProfile {
  profileID: string;
  displayName: string;
  bio: string | null;
  /** College + major labels when academic visibility is public; otherwise empty. */
  academicSummary: string | null;
  careers: string[];
  skills: string[];
  currentCourseIDs: string[];
  plannedSchedule: PublishedSchedule | null;
  /** You follow them. Reacting, commenting and messaging all start from this. */
  following: boolean;
  /** They follow you. With `following` this makes a mutual follow, which is what messaging needs. */
  followsMe: boolean;
  myReaction: SocialReaction | null;
  reactions: Partial<Record<SocialReaction, number>>;
}

/** The caller's own social state, so the page can show what is already published after a reload. */
export interface SocialMe {
  /** Null until the caller has saved a profile. */
  profileID: string | null;
  publishedSchedule: PublishedSchedule | null;
}

export interface SocialDirectory {
  me: SocialMe;
  people: SocialDirectoryProfile[];
}
