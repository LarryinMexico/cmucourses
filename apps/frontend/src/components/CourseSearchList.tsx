import React, { useEffect, useMemo } from "react";
import { useAppDispatch, useAppSelector } from "~/app/hooks";
import CourseCard from "./CourseCard";
import Loading from "./Loading";
import {
  useFetchCourseInfos,
  useFetchCourseInfosByPage,
} from "~/app/api/course";
import { Pagination } from "./Pagination";
import { filtersSlice } from "~/app/filters";
import { useMatchGoalsCourseIDs } from "~/app/matchGoals";

const PAGE_SIZE = 10;

const CoursePage = ({ courseIDs }: { courseIDs: string[] }) => {
  const showFCEs = useAppSelector((state) => state.user.showFCEs);
  const showCourseInfos = useAppSelector((state) => state.user.showCourseInfos);
  const showSchedules = useAppSelector((state) => state.user.showSchedules);

  const results = useFetchCourseInfos(courseIDs);

  if (courseIDs.length === 0) {
    return (
      <div className="mt-6 text-center text-gray-400">
        No courses match your goals.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {results &&
        courseIDs.map((courseID) => (
          <CourseCard
            courseID={courseID}
            key={courseID}
            showFCEs={showFCEs}
            showCourseInfo={showCourseInfos}
            showSchedules={showSchedules}
          />
        ))}
    </div>
  );
};

const SearchCoursePage = () => {
  const page = useAppSelector((state) => state.filters.page);

  const { data: { docs } = {} } = useFetchCourseInfosByPage();

  const exactResultsCourses = useAppSelector(
    (state) => state.filters.exactResultsCourses
  );

  const showFCEs = useAppSelector((state) => state.user.showFCEs);
  const showCourseInfos = useAppSelector((state) => state.user.showCourseInfos);
  const showSchedules = useAppSelector((state) => state.user.showSchedules);

  const coursesToShow: string[] = useMemo(() => {
    const pageCourses = docs?.map((doc) => doc.courseID) || [];

    const topExactResult = exactResultsCourses[0];

    if (page === 1 && topExactResult) {
      if (pageCourses.includes(topExactResult)) {
        const filteredCourses = pageCourses.filter(
          (courseID) => !exactResultsCourses.includes(courseID)
        );
        return [...exactResultsCourses, ...filteredCourses];
      } else {
        return pageCourses;
      }
    } else {
      return pageCourses;
    }
  }, [exactResultsCourses, docs, page]);

  const results = useFetchCourseInfos(coursesToShow);

  return (
    <div className="space-y-4">
      {results &&
        coursesToShow.map((courseID) => (
          <CourseCard
            courseID={courseID}
            key={courseID}
            showFCEs={showFCEs}
            showCourseInfo={showCourseInfos}
            showSchedules={showSchedules}
          />
        ))}
    </div>
  );
};

const CourseSearchList = () => {
  const curPage = useAppSelector((state) => state.filters.page);
  const { active: goalsActive, ready: goalsReady, courseIDs: goalIDs } =
    useMatchGoalsCourseIDs();
  const { isPending, data: { totalPages: searchTotalPages } = {} } =
    useFetchCourseInfosByPage({ enabled: !goalsActive });

  const dispatch = useAppDispatch();

  const goalsTotalPages = Math.max(1, Math.ceil(goalIDs.length / PAGE_SIZE));

  // Goals lists are usually much shorter than catalog search — keep the page in range.
  useEffect(() => {
    if (!goalsActive || !goalsReady) return;
    if (curPage > goalsTotalPages) {
      void dispatch(filtersSlice.actions.setPage(1));
    }
  }, [goalsActive, goalsReady, curPage, goalsTotalPages, dispatch]);

  const handlePageClick = (page: number) => {
    void dispatch(filtersSlice.actions.setPage(page + 1));
  };

  if (goalsActive) {
    if (!goalsReady)
      return (
        <div className="p-6">
          <Loading />
        </div>
      );

    const pageIndex = Math.min(curPage, goalsTotalPages) - 1;
    const pageIDs = goalIDs.slice(
      pageIndex * PAGE_SIZE,
      pageIndex * PAGE_SIZE + PAGE_SIZE
    );

    return (
      <div className="p-6">
        <CoursePage courseIDs={pageIDs} />
        {goalIDs.length > 0 && (
          <div className="mx-auto my-6">
            <Pagination
              currentPage={pageIndex}
              setCurrentPage={handlePageClick}
              totalPages={goalsTotalPages}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-6">
      {isPending || !searchTotalPages ? (
        <Loading />
      ) : (
        <>
          <SearchCoursePage />
          <div className="mx-auto my-6">
            <Pagination
              currentPage={curPage - 1}
              setCurrentPage={handlePageClick}
              totalPages={searchTotalPages}
            />
          </div>
        </>
      )}
    </div>
  );
};

export default CourseSearchList;
