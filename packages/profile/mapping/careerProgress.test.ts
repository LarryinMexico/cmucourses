import { describe, expect, test } from "bun:test";
import { CAREER_SKILLS } from "./careerSkills";
import { coursesForSkill, skillsForCourse } from "./index";
import { allCareerProgress, careerProgress } from "./careerProgress";

describe("coursesForSkill", () => {
  test("round-trips with skillsForCourse", () => {
    // 15-440 teaches systems-programming (per mapping.test.ts's systems-infra assertion).
    const courses = coursesForSkill("systems-programming");
    expect(courses).toContain("15-440");
    for (const courseID of courses) {
      expect(skillsForCourse(courseID)).toContain("systems-programming");
    }
  });

  test("returns [] for a skill nothing teaches, without throwing", () => {
    expect(coursesForSkill("not-a-real-skill")).toEqual([]);
  });
});

describe("careerProgress", () => {
  test("a taken course contributes its skills toward progress", () => {
    // 18-730 teaches only security-fundamentals; security's core is
    // [security-fundamentals, cryptography, networking].
    const [progress] = careerProgress({ careers: ["security"], skillsHave: [], takenCourseIDs: ["18-730"] });
    expect(progress!.coreCovered).toBe(1);
    expect(progress!.covered).toContain("security-fundamentals");
    expect(progress!.gaps.map((g) => g.skill)).toEqual(
      expect.arrayContaining(["cryptography", "networking"])
    );
  });

  test("skillsHave and taken courses both count, without double-counting", () => {
    const withHaveOnly = careerProgress({
      careers: ["security"],
      skillsHave: ["security-fundamentals", "cryptography"],
      takenCourseIDs: [],
    });
    expect(withHaveOnly[0]!.coreCovered).toBe(2);

    const withBoth = careerProgress({
      careers: ["security"],
      skillsHave: ["security-fundamentals"],
      takenCourseIDs: ["18-730"], // also teaches security-fundamentals - should not double count
    });
    expect(withBoth[0]!.coreCovered).toBe(1);
  });

  test("a career whose every core skill is covered reports no gaps", () => {
    const security = CAREER_SKILLS.security.core;
    const [progress] = careerProgress({ careers: ["security"], skillsHave: [...security], takenCourseIDs: [] });
    expect(progress!.coreCovered).toBe(progress!.coreTotal);
    expect(progress!.gaps).toEqual([]);
  });

  test("gaps carry courses that would close them, when the mapping has one", () => {
    const [progress] = careerProgress({ careers: ["security"], skillsHave: [], takenCourseIDs: [] });
    const cryptoGap = progress!.gaps.find((g) => g.skill === "cryptography");
    expect(cryptoGap).toBeDefined();
    expect(cryptoGap!.courseIDs.length).toBeGreaterThanOrEqual(0);
    for (const courseID of cryptoGap!.courseIDs) {
      expect(skillsForCourse(courseID)).toContain("cryptography");
    }
  });

  test("unknown career ids are ignored rather than throwing", () => {
    expect(() =>
      careerProgress({ careers: ["not-a-real-career"], skillsHave: [], takenCourseIDs: [] })
    ).not.toThrow();
    expect(careerProgress({ careers: ["not-a-real-career"], skillsHave: [], takenCourseIDs: [] })).toEqual([]);
  });

  test("preserves the caller's career priority order", () => {
    const progress = careerProgress({ careers: ["security", "swe"], skillsHave: [], takenCourseIDs: [] });
    expect(progress.map((p) => p.career)).toEqual(["security", "swe"]);
  });

  test("empty input returns no progress", () => {
    expect(careerProgress({ careers: [], skillsHave: [], takenCourseIDs: [] })).toEqual([]);
  });
});

describe("allCareerProgress", () => {
  test("covers every career in the taxonomy, regardless of the student's goals", () => {
    const all = allCareerProgress([], []);
    expect(all.length).toBe(Object.keys(CAREER_SKILLS).length);
  });

  test("reflects the same skills as careerProgress for a given career", () => {
    const targeted = careerProgress({ careers: ["security"], skillsHave: [], takenCourseIDs: ["18-730"] });
    const all = allCareerProgress([], ["18-730"]);
    const securityFromAll = all.find((p) => p.career === "security");
    expect(securityFromAll!.coreCovered).toBe(targeted[0]!.coreCovered);
  });
});
