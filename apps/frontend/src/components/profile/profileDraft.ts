import isEqual from "lodash/isEqual";
import type {
  Academic,
  BusyBlock,
  CourseRecord,
  Modality,
  PlannedCourse,
  Profile,
  ProfilePatchInput,
  ProfileVisibility,
  SchedulePreferences,
  Workload,
} from "@cmucourses/profile";
import { PROFILE_SECTIONS } from "./completeness";
import { EMPTY_ACADEMIC, EMPTY_WORKLOAD } from "./options";

/** Everything the Profile page edits, with nulls replaced by what the form fields show. */
export interface ProfileDraft {
  displayName: string;
  bio: string;
  academic: Academic;
  careers: string[];
  skillsHave: string[];
  skillsWant: string[];
  workload: Workload;
  modality: Modality | null;
  busyBlocks: BusyBlock[];
  schedulePreferences: SchedulePreferences;
  courses: CourseRecord[];
  plannedCourses: PlannedCourse[];
  visibility: ProfileVisibility;
}

export type DraftKey = keyof ProfileDraft;

export const toProfileDraft = (profile: Profile): ProfileDraft => ({
  displayName: profile.displayName ?? "",
  bio: profile.bio ?? "",
  academic: profile.academic ?? EMPTY_ACADEMIC,
  careers: profile.careers,
  skillsHave: profile.skillsHave,
  skillsWant: profile.skillsWant,
  workload: profile.workload ?? EMPTY_WORKLOAD,
  modality: profile.modality,
  busyBlocks: profile.busyBlocks,
  schedulePreferences: profile.schedulePreferences,
  courses: profile.courses,
  plannedCourses: profile.plannedCourses,
  visibility: profile.visibility,
});

const DRAFT_KEYS: DraftKey[] = [
  "displayName",
  "bio",
  "academic",
  "careers",
  "skillsHave",
  "skillsWant",
  "workload",
  "modality",
  "busyBlocks",
  "schedulePreferences",
  "courses",
  "plannedCourses",
  "visibility",
];

/** The PATCH body: only the top-level sections that differ from what is saved. */
export const changedPatch = (
  draft: ProfileDraft,
  saved: ProfileDraft
): ProfilePatchInput =>
  Object.fromEntries(
    DRAFT_KEYS.filter((key) => !isEqual(draft[key], saved[key])).map((key) => [
      key,
      draft[key],
    ])
  ) as ProfilePatchInput;

/** Which Profile card (a PROFILE_SECTIONS id) each draft key belongs to. `visibility` is split per card. */
export const SECTION_OF_KEY: Record<Exclude<DraftKey, "visibility">, string> = {
  displayName: "public-info",
  bio: "public-info",
  academic: "academic",
  careers: "careers",
  skillsHave: "skills",
  skillsWant: "skills",
  workload: "workload",
  modality: "time",
  busyBlocks: "time",
  schedulePreferences: "time",
  courses: "courses",
  plannedCourses: "plan",
};

const SECTION_OF_VISIBILITY: Record<keyof ProfileVisibility, string> = {
  academic: "academic",
  careers: "careers",
  skills: "skills",
  courses: "courses",
  busyLabels: "time",
};

/** The cards an edit of this draft key can touch (visibility spans several). */
export const sectionsOfKey = (key: DraftKey): string[] =>
  key === "visibility"
    ? [...new Set(Object.values(SECTION_OF_VISIBILITY))]
    : [SECTION_OF_KEY[key]];

/** The card a validation issue belongs to, from its zod path. */
export const sectionForIssue = (path: readonly (string | number)[]): string => {
  const [key, sub] = path;
  if (key === "visibility")
    return (
      SECTION_OF_VISIBILITY[sub as keyof ProfileVisibility] ?? "public-info"
    );
  return (
    SECTION_OF_KEY[key as Exclude<DraftKey, "visibility">] ?? "public-info"
  );
};

/** Cards with unsaved changes, in page order. */
export const dirtySections = (
  draft: ProfileDraft,
  saved: ProfileDraft
): string[] => {
  const dirty = new Set<string>();
  for (const key of DRAFT_KEYS) {
    if (isEqual(draft[key], saved[key])) continue;
    if (key === "visibility") {
      for (const sub of Object.keys(
        SECTION_OF_VISIBILITY
      ) as (keyof ProfileVisibility)[]) {
        if (draft.visibility[sub] !== saved.visibility[sub])
          dirty.add(SECTION_OF_VISIBILITY[sub]);
      }
    } else {
      dirty.add(SECTION_OF_KEY[key]);
    }
  }
  return PROFILE_SECTIONS.map((s) => s.id).filter((id) => dirty.has(id));
};
