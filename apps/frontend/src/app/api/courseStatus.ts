import type { Course } from "~/app/types";

export interface CourseInfosStatus {
  courses: Course[];
  /** Some course's details are still on their way. */
  isPending: boolean;
  /** Looked up fine, but the catalog has no such course (the batcher answers null). */
  notFound: string[];
  /** The request for these failed. */
  failed: string[];
}

/**
 * Sums up one query per course id. Kept apart from the hook so it can be tested, and so a missing
 * or failed course is told apart from one still loading (a length check waits for ever on those).
 */
export const summarizeCourseQueries = (
  courseIDs: string[],
  results: { data?: unknown; isPending: boolean; isError: boolean }[]
): CourseInfosStatus => {
  const summary: CourseInfosStatus = {
    courses: [],
    isPending: false,
    notFound: [],
    failed: [],
  };
  results.forEach((result, i) => {
    const id = courseIDs[i] ?? "";
    if (result.isPending) summary.isPending = true;
    else if (result.isError) summary.failed.push(id);
    else if (result.data) summary.courses.push(result.data as Course);
    else summary.notFound.push(id);
  });
  return summary;
};
