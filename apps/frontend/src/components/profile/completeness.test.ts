import { emptyProfile } from "@cmucourses/profile";
import { PROFILE_SECTIONS } from "./completeness";

const timeSection = PROFILE_SECTIONS.find((section) => section.id === "time")!;

describe("Time & format completeness", () => {
  test("a modality alone does not complete it (the catalog has no modality data)", () => {
    expect(
      timeSection.isComplete({ ...emptyProfile(), modality: "IN_PERSON" })
    ).toBe(false);
  });

  test("busy times complete it", () => {
    expect(
      timeSection.isComplete({
        ...emptyProfile(),
        busyBlocks: [{ day: 1, begin: 540, end: 600, label: "" }],
      })
    ).toBe(true);
  });
});
