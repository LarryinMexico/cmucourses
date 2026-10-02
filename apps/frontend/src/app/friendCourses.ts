import type {
  FriendCourseEntry,
  FriendCourses,
  Profile,
} from "@cmucourses/profile";
import { sessionToString } from "./utils";

export interface FriendRef {
  profileID: string;
  displayName: string;
}

/** A friend listed against a course, with how they relate to it ("Taking now", ...). */
export interface FriendOnCourse extends FriendRef {
  notes: string[];
}

const termLabel = (entry: FriendCourseEntry) =>
  entry.semester && entry.year
    ? sessionToString({
        year: entry.year,
        semester: entry.semester as "fall" | "spring" | "summer",
      })
    : "";

/** How a friend relates to a course, as one short phrase. */
export const describeEntry = (entry: FriendCourseEntry): string => {
  if (entry.source === "IN_PROGRESS") return "Taking now";
  if (entry.source === "PLANNED") return `Planning for ${termLabel(entry)}`;
  const kind = entry.kind === "PLANNED" ? "planned" : "actual";
  return `On their ${termLabel(entry)} ${kind} schedule`;
};

/** Everyone you follow who is taking or planning `courseID`, each named once. */
export const friendsTaking = (
  friends: FriendCourses[],
  courseID: string
): FriendOnCourse[] =>
  friends.flatMap((friend) => {
    const entries = friend.courses.filter((c) => c.courseID === courseID);
    if (entries.length === 0) return [];
    return [
      {
        profileID: friend.profileID,
        displayName: friend.displayName,
        notes: [...new Set(entries.map(describeEntry))],
      },
    ];
  });

/** Courses already on your own profile: taken, in progress or planned. */
export const ownCourseIDs = (profile: Profile | undefined): Set<string> =>
  new Set([
    ...(profile?.courses ?? []).map((c) => c.courseID),
    ...(profile?.plannedCourses ?? []).map((c) => c.courseID),
  ]);

export interface DiscoveredCourse {
  courseID: string;
  friends: FriendOnCourse[];
}

/**
 * Courses the people you follow are taking or planning that are not on your profile yet, most
 * friends first (then by course number), so the ones your circle shares come to the top.
 */
export const discoverCourses = (
  friends: FriendCourses[],
  mine: ReadonlySet<string>
): DiscoveredCourse[] => {
  const ids = new Set(friends.flatMap((f) => f.courses.map((c) => c.courseID)));
  return [...ids]
    .filter((id) => !mine.has(id))
    .map((courseID) => ({
      courseID,
      friends: friendsTaking(friends, courseID),
    }))
    .sort(
      (a, b) =>
        b.friends.length - a.friends.length ||
        a.courseID.localeCompare(b.courseID)
    );
};
