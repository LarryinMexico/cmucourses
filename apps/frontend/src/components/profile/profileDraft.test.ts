import { emptyProfile } from "@cmucourses/profile";
import {
  changedPatch,
  dirtySections,
  sectionForIssue,
  toProfileDraft,
} from "./profileDraft";

describe("toProfileDraft", () => {
  it("fills empty sections with what the form fields show", () => {
    const draft = toProfileDraft(emptyProfile());
    expect(draft.displayName).toBe("");
    expect(draft.bio).toBe("");
    expect(draft.academic.majors).toEqual([]);
    expect(draft.workload).toEqual({
      unitsMin: null,
      unitsMax: null,
      hoursPerWeek: null,
    });
  });
});

describe("changedPatch", () => {
  const saved = toProfileDraft(emptyProfile());

  it("is empty when nothing changed", () => {
    expect(changedPatch(saved, saved)).toEqual({});
  });

  it("holds only the sections that changed", () => {
    const draft = { ...saved, bio: "Hi", careers: ["swe"] };
    expect(changedPatch(draft, saved)).toEqual({
      bio: "Hi",
      careers: ["swe"],
    });
  });
});

describe("sectionForIssue", () => {
  it.each([
    [["busyBlocks", 0, "end"], "time"],
    [["visibility", "busyLabels"], "time"],
    [["visibility", "courses"], "courses"],
    [["workload", "unitsMin"], "workload"],
    [["displayName"], "public-info"],
    [["plannedCourses", 2, "courseID"], "plan"],
  ])("%j -> %s", (path, section) => {
    expect(sectionForIssue(path)).toBe(section);
  });
});

describe("dirtySections", () => {
  const saved = toProfileDraft(emptyProfile());

  it("lists changed cards in page order", () => {
    const draft = {
      ...saved,
      courses: [
        {
          courseID: "15-122",
          status: "TAKEN" as const,
          semester: null,
          year: null,
        },
      ],
      bio: "Hi",
      skillsWant: ["python"],
    };
    expect(dirtySections(draft, saved)).toEqual([
      "public-info",
      "skills",
      "courses",
    ]);
  });

  it("puts a visibility change on the card it belongs to", () => {
    const draft = {
      ...saved,
      visibility: {
        ...saved.visibility,
        academic: "PUBLIC" as const,
        busyLabels: "PUBLIC" as const,
      },
    };
    expect(dirtySections(draft, saved)).toEqual(["academic", "time"]);
  });
});
