import type { Course } from "~/app/types";

export interface CourseInfosStatus {
  courses: Course[];
  /** Some course's details are still on their way. */
  isPending: boolean;
  /** Looked up fine, but the catalog has no such course (the batcher answers null). */
  notFound: string[];
  /** The request for these failed. */
  failed: string[];
  /** Asks again for the failed ones. */
  retryFailed: () => void;
}

/**
 * Sums up one query per course id. Kept apart from the hook so it can be tested, and so a missing
 * or failed course is told apart from one still loading (a length check waits for ever on those).
 */
export const summarizeCourseQueries = (
  courseIDs: string[],
  results: {
    data?: unknown;
    isPending: boolean;
    isError: boolean;
    refetch?: () => unknown;
  }[]
): CourseInfosStatus => {
  const retries: (() => unknown)[] = [];
  const summary: CourseInfosStatus = {
    courses: [],
    isPending: false,
    notFound: [],
    failed: [],
    retryFailed: () => retries.forEach((refetch) => void refetch()),
  };
  results.forEach((result, i) => {
    const id = courseIDs[i] ?? "";
    // Details already in hand win: a failed background refetch keeps the cached course.
    if (result.data) summary.courses.push(result.data as Course);
    else if (result.isPending) summary.isPending = true;
    else if (result.isError) {
      summary.failed.push(id);
      if (result.refetch) retries.push(result.refetch);
    } else summary.notFound.push(id);
  });
  return summary;
};
