import {
  COLLEGES,
  MAJORS,
  SOCIAL_REACTIONS,
  labelOf,
  type PublishedSchedule,
  type SocialDirectoryProfile,
  type SocialReaction,
} from "@cmucourses/profile";

/** The columns of a `profiles` row the directory reads. Declared structurally so it can be tested without Prisma. */
export interface DirectoryProfileRow {
  id: string;
  clerkUserId: string;
  displayName: string | null;
  bio: string | null;
  visibility: { academic: string; careers: string; skills: string; courses: string };
  academic: { college: string | null; majors: string[] } | null;
  careers: string[];
  skillsHave: string[];
  skillsWant: string[];
  courses: { courseID: string; status: string }[];
}

export interface ScheduleRow {
  name: string;
  semester: string;
  year: string;
  courses: { courseID: string; lecture?: string | null; section?: string | null }[];
}

export interface ReactionRow {
  reactorUserId: string;
  reaction: string;
}

export const toPublishedSchedule = (schedule: ScheduleRow | null | undefined): PublishedSchedule | null =>
  schedule
    ? {
        name: schedule.name,
        semester: schedule.semester as PublishedSchedule["semester"],
        year: schedule.year,
        courses: schedule.courses.map((course) => ({
          courseID: course.courseID,
          lecture: course.lecture ?? null,
          section: course.section ?? null,
        })),
      }
    : null;

const isReaction = (value: unknown): value is SocialReaction => SOCIAL_REACTIONS.includes(value as SocialReaction);

/**
 * One person as the directory shows them to `viewerUserId`. Private sections come back empty,
 * and nothing here carries a Clerk id: people are addressed by profile id only.
 */
export const toDirectoryProfile = ({
  profile,
  schedule,
  reactions,
  viewerUserId,
  followedProfileIDs,
  followerUserIDs,
}: {
  profile: DirectoryProfileRow;
  schedule: ScheduleRow | null | undefined;
  /** Only the reactions on this profile's schedule. */
  reactions: ReactionRow[];
  viewerUserId: string;
  /** Profile ids the viewer follows. */
  followedProfileIDs: ReadonlySet<string>;
  /** Clerk ids of the people who follow the viewer. */
  followerUserIDs: ReadonlySet<string>;
}): SocialDirectoryProfile => {
  const counts: Partial<Record<SocialReaction, number>> = {};
  for (const { reaction } of reactions) {
    if (isReaction(reaction)) counts[reaction] = (counts[reaction] ?? 0) + 1;
  }
  const own = reactions.find((reaction) => reaction.reactorUserId === viewerUserId)?.reaction;

  return {
    profileID: profile.id,
    displayName: profile.displayName || "CMU student",
    bio: profile.bio,
    academicSummary:
      profile.visibility.academic === "PUBLIC" && profile.academic
        ? [
            profile.academic.college ? labelOf(COLLEGES, profile.academic.college) : null,
            ...profile.academic.majors.map((id) => labelOf(MAJORS, id)),
          ]
            .filter(Boolean)
            .join(" · ") || null
        : null,
    careers: profile.visibility.careers === "PUBLIC" ? profile.careers : [],
    skills: profile.visibility.skills === "PUBLIC" ? [...profile.skillsHave, ...profile.skillsWant] : [],
    currentCourseIDs:
      profile.visibility.courses === "PUBLIC"
        ? profile.courses.filter((course) => course.status === "IN_PROGRESS").map((course) => course.courseID)
        : [],
    plannedSchedule: toPublishedSchedule(schedule),
    following: followedProfileIDs.has(profile.id),
    followsMe: followerUserIDs.has(profile.clerkUserId),
    myReaction: isReaction(own) ? own : null,
    reactions: counts,
  };
};
