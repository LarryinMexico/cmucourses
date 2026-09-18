import React from "react";
import CourseCard from "./CourseCard";
import { useFetchCourseInfos } from "~/app/api/course";
import Loading from "./Loading";
import { useAppSelector } from "~/app/hooks";

interface Props {
  courseIDs: string[];
  children: React.ReactNode;
}

const CourseList = ({ courseIDs, children }: Props) => {
  const results = useFetchCourseInfos(courseIDs);

  const showFCEs = useAppSelector((state) => state.user.savedShowFCEs);
  const showCourseInfos = useAppSelector(
    (state) => state.user.savedShowCourseInfos
  );
  const showSchedules = useAppSelector(
    (state) => state.user.savedShowSchedules
  );

  return (
    <div className="pt-2 pb-6 px-2 md:px-6">
      {courseIDs.length === 0 ? (
        children
      ) : (
        <>
          <div className="mt-3 pb-2 text-sm text-gray-400">
            {courseIDs.length} Saved Courses{" "}
          </div>
          <div className="space-y-4">
            {courseIDs.length > results.length && <Loading />}
            {courseIDs.map((courseID) => (
              <CourseCard
                key={courseID}
                courseID={courseID}
                showFCEs={showFCEs}
                showCourseInfo={showCourseInfos}
                showSchedules={showSchedules}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default CourseList;
