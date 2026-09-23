import axios from "axios";
import { useQuery, useQueries, keepPreviousData } from "@tanstack/react-query";
import { create, windowScheduler, keyResolver } from "@yornaath/batshit";
import { Course, Session } from "~/app/types";
import { STALE_TIME } from "~/app/constants";
import { FiltersState } from "~/app/filters";
import { useAppSelector } from "~/app/hooks";
import type { BusyBlock } from "@cmucourses/profile";

export type FetchCourseInfosByPageResult = {
  docs: Course[];
  totalDocs: number;
  limit: number;
  totalPages: number;
  page: number;
  pagingCounter: number;
  hasPrevPage: boolean;
  hasNextPage: boolean;
  prevPage: number | null;
  nextPage: number | null;
};

const NO_BUSY: BusyBlock[] = [];

const fetchCourseInfosByPage = async (
  filters: FiltersState,
  busy: BusyBlock[]
): Promise<FetchCourseInfosByPageResult> => {
  const url = `${process.env.NEXT_PUBLIC_BACKEND_URL || ""}/courses/search?`;
  const params = new URLSearchParams({
    page: `${filters.page}`,
    schedules: "true",
  });

  if (filters.search !== "") {
    params.set("keywords", filters.search);
  }

  if (filters.departments.active && filters.departments.names.length > 0) {
    filters.departments.names.forEach((d) => params.append("department", d));
  }

  if (filters.units.active && (filters.units.min !== 0 || filters.units.max !== 24)) {
    params.append("unitsMin", filters.units.min.toString());
    params.append("unitsMax", filters.units.max.toString());
  }

  if (filters.semesters.active && filters.semesters.sessions.length > 0) {
    filters.semesters.sessions.forEach((s: Session) =>
      params.append("session", JSON.stringify(s))
    );
  }

  if (filters.classTimes.active && filters.classTimes.selected.length > 0) {
    filters.classTimes.selected.forEach((classTime) =>
      params.append("classTimes", classTime)
    );
  }

  if (filters.meetingDays.active && filters.meetingDays.selected.length > 0) {
    filters.meetingDays.selected.forEach((day) =>
      params.append("meetingDays", day.toString())
    );
  }

  if (filters.timeRange.active) {
    params.append("timeBegin", filters.timeRange.begin.toString());
    params.append("timeEnd", filters.timeRange.end.toString());
  }

  // "Only courses that fit my availability" is decided by the backend (fitAvailabilityStage), so
  // every page is full and the page count is right. Blocks travel as `day,begin,end`.
  busy.forEach((block) =>
    params.append("busy", `${block.day},${block.begin},${block.end}`)
  );

  if (filters.levels.active) {
    let value = "";
    filters.levels.selected.forEach((elem, index) => {
      if (elem) value += index.toString();
    });

    if (value) params.append("levels", value);
  }

  const response = await axios.get(url, {
    headers: {
      "Content-Type": "application/json",
    },
    params,
  });

  return response.data;
};

/**
 * `busy` is what the search must fit around (see useSearchBusyBlocks). It comes from the caller
 * rather than being read here: this module is imported by low-level helpers that must stay free
 * of the Clerk/profile layer.
 */
export const useFetchCourseInfosByPage = (options?: {
  enabled?: boolean;
  busy?: BusyBlock[];
}) => {
  const filters = useAppSelector((state) => state.filters);
  const busy = options?.busy ?? NO_BUSY;

  return useQuery({
    queryKey: ["courseInfosByPage", filters, busy],
    queryFn: () => fetchCourseInfosByPage(filters, busy),
    staleTime: STALE_TIME,
    placeholderData: keepPreviousData,
    enabled: options?.enabled ?? true,
  });
};

const fetchCourseInfosBatcher = create({
  fetcher: async (courseIDs: string[]): Promise<Course[]> => {
    const url = `${process.env.NEXT_PUBLIC_BACKEND_URL || ""}/courses?`;
    const params = new URLSearchParams(courseIDs.map((id) => ["courseID", id]));

    params.set("schedules", "true");

    const response = await axios.get(url, {
      headers: {
        "Content-Type": "application/json",
      },
      params,
    });

    return response.data;
  },
  resolver: keyResolver("courseID"),
  scheduler: windowScheduler(10),
});

export const useFetchCourseInfo = (courseID: string) => {
  return useQuery({
    queryKey: ["courseInfo", { courseID }],
    queryFn: () => fetchCourseInfosBatcher.fetch(courseID),
    staleTime: STALE_TIME,
  });
};

export const useFetchCourseInfos = (courseIDs: string[]) => {
  return useQueries({
    queries: courseIDs.map((courseID) => ({
      queryKey: ["courseInfo", { courseID }],
      queryFn: () => fetchCourseInfosBatcher.fetch(courseID),
      staleTime: STALE_TIME,
    })),
    combine: (result) => {
      return result.reduce((acc, { data }) => {
        if (data) acc.push(data);
        return acc;
      }, [] as Course[]);
    },
  });
};

type FetchAllCoursesType = { name: string; courseID: string }[];

const fetchAllCourses = async (): Promise<FetchAllCoursesType> => {
  const url = `${process.env.NEXT_PUBLIC_BACKEND_URL || ""}/courses/all`;

  const response = await axios.get(url, {
    headers: {
      "Content-Type": "application/json",
    },
  });

  return response.data;
};

export const useFetchAllCourses = (options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: ["allCourses"],
    queryFn: fetchAllCourses,
    staleTime: STALE_TIME,
    enabled: options?.enabled ?? true,
  });
};

/** Same `allCourses` cache, selected into a Map so callers don't re-scan ~8k rows per render. */
export const useCourseNames = () => {
  return useQuery({
    queryKey: ["allCourses"],
    queryFn: fetchAllCourses,
    staleTime: STALE_TIME,
    select: (courses) =>
      new Map(courses.map((course) => [course.courseID, course.name])),
  });
};

export type CourseRequisites = {
  prereqs: string[];
  prereqRelations: string[][];
  postreqs: string[];
};

export const fetchCourseRequisites = async (
  courseID: string
): Promise<CourseRequisites> => {
  const url = `${process.env.NEXT_PUBLIC_BACKEND_URL || ""}/courses/requisites/${courseID}`;

  const response = await axios.get(url, {
    headers: {
      "Content-Type": "application/json",
    },
  });

  return response.data;
};

export const useFetchCourseRequisites = (courseID: string) => {
  return useQuery<CourseRequisites>({
    queryKey: ["courseRequisites", courseID],
    queryFn: () => fetchCourseRequisites(courseID),
    staleTime: STALE_TIME,
  });
};
