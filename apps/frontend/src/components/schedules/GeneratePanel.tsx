import React, { useEffect, useState } from "react";
import { emptyProfile } from "@cmucourses/profile";
import { useAppDispatch, useAppSelector } from "~/app/hooks";
import { useFetchCourseInfos } from "~/app/api/course";
import { useFetchProfile } from "~/app/api/profile";
import {
  selectCoursesInActiveSchedule,
  selectSessionInActiveSchedule,
  userSchedulesSlice,
} from "~/app/userSchedules";
import {
  buildGeneratorInput,
  generateCandidates,
  ScheduleCandidate,
} from "~/app/scheduleGenerator";
import { PRIMARY_BUTTON_CLASS } from "~/components/profile/fields";
import CandidateCard from "./CandidateCard";

/**
 * Builds up to 3 candidate schedules from the courses already added to the active schedule (see
 * ScheduleSearch), for whichever semester is picked in SectionSelector's dropdown. "Use this
 * schedule" fills in the same courseSessions state SectionSelector's manual radio buttons would.
 */
const GeneratePanel = () => {
  const dispatch = useAppDispatch();
  const scheduled = useAppSelector(selectCoursesInActiveSchedule);
  const selectedSession = useAppSelector(selectSessionInActiveSchedule);
  const courseDetails = useFetchCourseInfos(scheduled);
  const { data: profile } = useFetchProfile();
  const [candidates, setCandidates] = useState<ScheduleCandidate[] | null>(
    null
  );

  // Drop stale options when the semester or course list changes.
  useEffect(() => {
    setCandidates(null);
  }, [selectedSession, scheduled.join(",")]);

  const generate = () => {
    const input = buildGeneratorInput(
      scheduled,
      courseDetails,
      selectedSession,
      profile ?? emptyProfile()
    );
    setCandidates(generateCandidates(input));
  };

  const useCandidate = (candidate: ScheduleCandidate) => {
    dispatch(userSchedulesSlice.actions.setActiveScheduleCourses(scheduled));
    const picked = new Set(candidate.picks.map((pick) => pick.courseID));
    // Clear leftover lecture/section picks from a previous semester for courses not in this result.
    for (const courseID of scheduled) {
      if (picked.has(courseID)) continue;
      dispatch(
        userSchedulesSlice.actions.updateActiveScheduleCourseSession({
          courseID,
          sessionType: "Lecture",
          session: "",
        })
      );
      dispatch(
        userSchedulesSlice.actions.updateActiveScheduleCourseSession({
          courseID,
          sessionType: "Section",
          session: "",
        })
      );
    }
    for (const pick of candidate.picks) {
      dispatch(
        userSchedulesSlice.actions.updateActiveScheduleCourseSession({
          courseID: pick.courseID,
          sessionType: "Lecture",
          session: pick.lecture,
        })
      );
      dispatch(
        userSchedulesSlice.actions.updateActiveScheduleCourseSession({
          courseID: pick.courseID,
          sessionType: "Section",
          session: pick.section || "",
        })
      );
    }
    dispatch(
      userSchedulesSlice.actions.setActiveScheduleGeneratedMeta({
        score: candidate.totalScore,
        reasons: candidate.reasons,
      })
    );
    setCandidates(null);
  };

  return (
    <div className="mt-4">
      <div className="mb-2 text-lg">Generate</div>
      {scheduled.length === 0 ? (
        <div className="text-gray-400 text-sm">
          Add courses above to generate schedules.
        </div>
      ) : selectedSession === "" ? (
        <div className="text-gray-400 text-sm">
          Pick a semester in the Semester dropdown above first.
        </div>
      ) : (
        <button
          type="button"
          className={`${PRIMARY_BUTTON_CLASS} w-full`}
          onClick={generate}
        >
          Generate Schedules
        </button>
      )}
      {candidates && (
        <div className="mt-4 space-y-4">
          {candidates.length === 0 ? (
            <div className="text-gray-400 text-sm">
              No conflict-free schedule exists for these courses. Try changing
              the course list or semester.
            </div>
          ) : (
            candidates.map((candidate, index) => (
              <CandidateCard
                key={index}
                candidate={candidate}
                index={index}
                onUse={() => useCandidate(candidate)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default GeneratePanel;
