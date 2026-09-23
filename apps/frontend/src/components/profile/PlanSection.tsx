import React, { useState } from "react";
import {
  LIMITS,
  PlannedCourse,
  Profile,
  ProfileSemester,
} from "@cmucourses/profile";
import { CoursePicker } from "./CoursePicker";
import { ProfileSection, useDraft } from "./ProfileSection";
import { SECONDARY_BUTTON_CLASS, Select } from "./fields";
import { PLAN_YEAR_OPTIONS, SEMESTER_OPTIONS } from "./options";
import { PlanSemesters, sameEntry } from "./PlanSemesters";

const currentYear = String(new Date().getFullYear());

export const PlanSection = ({ profile }: { profile: Profile }) => {
  const { draft, setDraft, dirty } = useDraft(profile.plannedCourses);
  const [adding, setAdding] = useState<{
    courseID: string | null;
    semester: ProfileSemester;
    year: string;
  }>({ courseID: null, semester: "fall", year: currentYear });

  const add = () => {
    if (!adding.courseID) return;
    const next: PlannedCourse = {
      courseID: adding.courseID,
      semester: adding.semester,
      year: adding.year,
    };
    setDraft([...draft.filter((course) => !sameEntry(course, next)), next]);
    setAdding({ ...adding, courseID: null });
  };

  return (
    <ProfileSection
      id="plan"
      title="Future course plan"
      description="Place courses into future semesters. The planner uses this alongside requirements and career goals."
      profile={profile}
      dirty={dirty}
      patch={{ plannedCourses: draft }}
    >
      {draft.length === 0 && (
        <div className="text-gray-400 text-sm">No planned courses yet.</div>
      )}
      <PlanSemesters
        planned={draft}
        workload={profile.workload}
        onRemove={(course) =>
          setDraft(draft.filter((item) => !sameEntry(item, course)))
        }
      />
      {draft.length > 0 &&
        profile.workload?.unitsMin == null &&
        profile.workload?.unitsMax == null && (
          <div className="text-gray-400 text-xs">
            Set a units range under Course load to check each semester against
            it.
          </div>
        )}
      {draft.length < LIMITS.plannedCourses && (
        <div className="flex flex-wrap items-center gap-2">
          <CoursePicker
            value={adding.courseID}
            onChange={(courseID) => setAdding({ ...adding, courseID })}
            // Only what is already in the chosen semester: the same course may go in another one.
            exclude={draft
              .filter(
                (course) =>
                  course.semester === adding.semester &&
                  course.year === adding.year
              )
              .map((course) => course.courseID)}
          />
          <Select
            inline
            className="w-28"
            value={adding.semester}
            options={SEMESTER_OPTIONS.filter(
              (option): option is { value: ProfileSemester; label: string } =>
                option.value !== null
            )}
            onChange={(semester) => setAdding({ ...adding, semester })}
          />
          <Select
            inline
            className="w-24"
            value={adding.year}
            options={PLAN_YEAR_OPTIONS}
            onChange={(year) => setAdding({ ...adding, year })}
          />
          <button
            type="button"
            className={SECONDARY_BUTTON_CLASS}
            disabled={!adding.courseID}
            onClick={add}
          >
            Add to plan
          </button>
        </div>
      )}
    </ProfileSection>
  );
};
