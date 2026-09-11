import React, { useState } from "react";
import { XMarkIcon } from "@heroicons/react/20/solid";
import {
  CourseRecord,
  CourseStatus,
  LIMITS,
  Profile,
} from "@cmucourses/profile";
import { useFetchAllCourses } from "~/app/api/course";
import Link from "~/components/Link";
import { SECONDARY_BUTTON_CLASS, Select } from "./fields";
import { PAST_YEAR_OPTIONS, SEMESTER_OPTIONS, STATUS_OPTIONS } from "./options";
import { CoursePicker } from "./CoursePicker";
import { ProfileSection, useDraft } from "./ProfileSection";

const RecordFields = ({
  record,
  onChange,
}: {
  record: Pick<CourseRecord, "status" | "semester" | "year">;
  onChange: (
    record: Pick<CourseRecord, "status" | "semester" | "year">
  ) => void;
}) => (
  <>
    <Select
      inline
      className="w-32"
      value={record.status}
      options={STATUS_OPTIONS}
      onChange={(status) => onChange({ ...record, status })}
    />
    <Select
      inline
      className="w-28"
      value={record.semester}
      options={SEMESTER_OPTIONS}
      onChange={(semester) => onChange({ ...record, semester })}
      placeholder="Semester"
    />
    <Select
      inline
      className="w-24"
      value={record.year}
      options={PAST_YEAR_OPTIONS}
      onChange={(year) => onChange({ ...record, year })}
      placeholder="Year"
    />
  </>
);

export const CoursesSection = ({ profile }: { profile: Profile }) => {
  const { draft, setDraft, dirty } = useDraft(profile.courses);
  const { data: allCourses = [] } = useFetchAllCourses();
  const [adding, setAdding] = useState<{
    courseID: string | null;
    status: CourseStatus;
  }>({
    courseID: null,
    status: "TAKEN",
  });

  const nameOf = (courseID: string) =>
    allCourses.find((course) => course.courseID === courseID)?.name;

  const add = () => {
    if (!adding.courseID) return;
    setDraft([
      ...draft,
      {
        courseID: adding.courseID,
        status: adding.status,
        semester: null,
        year: null,
      },
    ]);
    setAdding({ ...adding, courseID: null });
  };

  return (
    <ProfileSection
      id="courses"
      title="Courses taken / in progress"
      profile={profile}
      shareable="courses"
      dirty={dirty}
      patch={{ courses: draft }}
    >
      {draft.length === 0 && (
        <div className="text-gray-400 text-sm">No courses yet.</div>
      )}
      <ul className="divide-y divide-gray-100">
        {draft.map((record, index) => (
          <li
            key={record.courseID}
            className="flex flex-wrap items-center gap-2 py-2 text-gray-700 text-sm"
          >
            <div className="min-w-0 flex-1 truncate">
              <Link href={`/course/${record.courseID}`}>{record.courseID}</Link>
              <span className="ml-2">{nameOf(record.courseID)}</span>
            </div>
            <RecordFields
              record={record}
              onChange={(next) =>
                setDraft(
                  draft.map((other, i) =>
                    i === index ? { ...other, ...next } : other
                  )
                )
              }
            />
            <button
              type="button"
              aria-label={`Remove ${record.courseID}`}
              title="Remove"
              className="rounded p-1 text-gray-500 hover:bg-gray-50"
              onClick={() => setDraft(draft.filter((_, i) => i !== index))}
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </li>
        ))}
      </ul>
      {draft.length < LIMITS.courses && (
        <div className="flex flex-wrap items-center gap-2">
          <CoursePicker
            value={adding.courseID}
            onChange={(courseID) => setAdding({ ...adding, courseID })}
            exclude={draft.map((record) => record.courseID)}
          />
          <Select
            inline
            className="w-32"
            value={adding.status}
            options={STATUS_OPTIONS}
            onChange={(status) => setAdding({ ...adding, status })}
          />
          <button
            type="button"
            className={SECONDARY_BUTTON_CLASS}
            disabled={!adding.courseID}
            onClick={add}
          >
            Add
          </button>
        </div>
      )}
    </ProfileSection>
  );
};
