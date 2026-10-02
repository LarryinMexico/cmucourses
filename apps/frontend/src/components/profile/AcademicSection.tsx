import React from "react";
import {
  Academic,
  COLLEGES,
  LIMITS,
  majorsForCollege,
  MINORS,
} from "@cmucourses/profile";
import { Field, Select, SelectOption, TaxonomyMultiSelect } from "./fields";
import {
  DEGREE_OPTIONS,
  GRAD_YEAR_OPTIONS,
  NONE_OPTION,
  SEMESTER_OPTIONS,
} from "./options";
import { ProfileSection } from "./ProfileSection";
import { useDraftField } from "./ProfileDraftContext";

const COLLEGE_OPTIONS: SelectOption<string | null>[] = [
  NONE_OPTION,
  ...COLLEGES.map(({ id, label }) => ({ value: id, label })),
];

/** Shared by the profile page and onboarding. `minors` is hidden in onboarding to keep it short. */
export const AcademicFields = ({
  value,
  onChange,
  showMinors = true,
}: {
  value: Academic;
  onChange: (value: Academic) => void;
  showMinors?: boolean;
}) => {
  const set = (patch: Partial<Academic>) => onChange({ ...value, ...patch });
  const majors = majorsForCollege(value.college);

  // Changing college drops majors the new college doesn't offer.
  const setCollege = (college: string | null) => {
    const allowed = new Set(majorsForCollege(college).map((major) => major.id));
    set({ college, majors: value.majors.filter((id) => allowed.has(id)) });
  };

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label="Degree">
        <Select
          value={value.degree}
          options={DEGREE_OPTIONS}
          onChange={(degree) => set({ degree })}
        />
      </Field>
      <Field label="College">
        <Select
          value={value.college}
          options={COLLEGE_OPTIONS}
          onChange={setCollege}
        />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Major / program">
          {/*
            Single-pick: one program is the normal case, and picking a new one replaces the
            old. The stored shape stays an array capped at LIMITS.majors, so a profile saved
            earlier with more than one still loads and can be edited down.
          */}
          <TaxonomyMultiSelect
            items={majors}
            value={value.majors}
            onChange={(majors) => set({ majors })}
            max={1}
            closeOnSelect
          />
        </Field>
      </div>
      {showMinors && (
        <div className="sm:col-span-2">
          <Field label="Minors">
            <TaxonomyMultiSelect
              items={MINORS}
              value={value.minors}
              onChange={(minors) => set({ minors })}
              max={LIMITS.minors}
              closeOnSelect
            />
          </Field>
        </div>
      )}
      <Field label="Expected graduation">
        <div className="flex gap-2">
          <Select
            className="flex-1"
            value={value.gradSemester}
            options={SEMESTER_OPTIONS}
            onChange={(gradSemester) => set({ gradSemester })}
            placeholder="Semester"
          />
          <Select
            className="flex-1"
            value={value.gradYear}
            options={GRAD_YEAR_OPTIONS}
            onChange={(gradYear) => set({ gradYear })}
            placeholder="Year"
          />
        </div>
      </Field>
    </div>
  );
};

export const AcademicSection = () => {
  const { draft, setDraft } = useDraftField("academic");

  return (
    <ProfileSection
      id="academic"
      title="Academic background"
      shareable="academic"
    >
      <AcademicFields value={draft} onChange={setDraft} />
    </ProfileSection>
  );
};
