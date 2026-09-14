import { describe, expect, test } from "bun:test";
import { CAREERS } from "../taxonomy/careers";
import { SKILLS } from "../taxonomy/skills";
import { COURSE_SKILLS } from "./courseSkills";
import { CAREER_SKILLS } from "./careerSkills";
import { careersForCourse, recommendCourses, skillsForCourse } from "./index";

const SKILL_IDS = new Set(SKILLS.map((skill) => skill.id));
const CAREER_IDS = new Set(CAREERS.map((career) => career.id));
const COURSE_ID_REGEX = /^\d{2}-\d{3}$/;

describe("COURSE_SKILLS", () => {
  test("every key is a canonical course id", () => {
    for (const courseID of Object.keys(COURSE_SKILLS)) {
      expect(courseID).toMatch(COURSE_ID_REGEX);
    }
  });

  test("every skill id is a known skill and not repeated within a course", () => {
    for (const [courseID, skills] of Object.entries(COURSE_SKILLS)) {
      for (const skill of skills) {
        expect(SKILL_IDS.has(skill), `${courseID} references unknown skill "${skill}"`).toBe(true);
      }
      expect(new Set(skills).size, `${courseID} has a duplicate skill`).toBe(skills.length);
    }
  });

  test("no course list is empty", () => {
    for (const [courseID, skills] of Object.entries(COURSE_SKILLS)) {
      expect(skills.length, `${courseID} has no skills`).toBeGreaterThan(0);
    }
  });
});

describe("CAREER_SKILLS", () => {
  test("every career in the taxonomy has an entry", () => {
    expect(new Set(Object.keys(CAREER_SKILLS))).toEqual(CAREER_IDS);
  });

  test("core and supporting skills are known, non-empty, and don't overlap", () => {
    for (const [career, { core, supporting }] of Object.entries(CAREER_SKILLS)) {
      expect(core.length, `${career} has no core skills`).toBeGreaterThan(0);
      for (const skill of [...core, ...supporting]) {
        expect(SKILL_IDS.has(skill), `${career} references unknown skill "${skill}"`).toBe(true);
      }
      const overlap = core.filter((skill) => (supporting as readonly string[]).includes(skill));
      expect(overlap, `${career} lists ${overlap.join(", ")} as both core and supporting`).toEqual([]);
    }
  });
});

describe("skillsForCourse", () => {
  test("returns the mapped skills, standardizing the course id first", () => {
    expect(skillsForCourse("15213")).toEqual(skillsForCourse("15-213"));
    expect(skillsForCourse("15-213")).toContain("systems-programming");
  });

  test("returns [] for an unmapped course", () => {
    expect(skillsForCourse("99-999")).toEqual([]);
  });
});

describe("careersForCourse", () => {
  test("a systems course maps to systems-infra via its core skills", () => {
    expect(careersForCourse("15-440")).toContain("systems-infra");
  });

  test("a security course maps to security", () => {
    expect(careersForCourse("18-730")).toEqual(["security"]);
  });

  test("an unmapped course has no careers", () => {
    expect(careersForCourse("99-999")).toEqual([]);
  });

  test("a course can serve more than one career", () => {
    // 10-301 teaches machine-learning + statistics, core to both ml-ai and data-science.
    const careers = careersForCourse("10-301");
    expect(careers).toContain("ml-ai");
    expect(careers).toContain("data-science");
  });
});

describe("recommendCourses", () => {
  test("with no goals, nothing scores", () => {
    expect(recommendCourses({ careers: [], skillsWant: [], skillsHave: [], takenCourseIDs: [] })).toEqual([]);
  });

  test("recommends courses toward the primary career and excludes taken courses", () => {
    const result = recommendCourses({
      careers: ["ml-ai"],
      skillsWant: [],
      skillsHave: [],
      takenCourseIDs: ["10-301"], // teaches machine-learning + statistics + probability
    });
    expect(result.some((r) => r.courseID === "10-301")).toBe(false);
    expect(result.some((r) => r.courseID === "10-601")).toBe(true); // same skills, not taken
  });

  test("skillsHave removes a course's contribution entirely if it teaches nothing new", () => {
    const result = recommendCourses({
      careers: ["security"],
      skillsWant: [],
      skillsHave: ["security-fundamentals"],
      takenCourseIDs: [],
    });
    // 18-730 teaches only security-fundamentals, which the student already has.
    expect(result.some((r) => r.courseID === "18-730")).toBe(false);
  });

  test("the primary career outranks a later one for the same course", () => {
    // 70-493 teaches only financial-modeling: quant-finance core, absent from research
    // entirely — so which career is primary changes the total, unlike a course whose skills
    // are symmetric between the two careers.
    const asPrimary = recommendCourses({
      careers: ["quant-finance", "research"],
      skillsWant: [],
      skillsHave: [],
      takenCourseIDs: [],
    });
    const asSecondary = recommendCourses({
      careers: ["research", "quant-finance"],
      skillsWant: [],
      skillsHave: [],
      takenCourseIDs: [],
    });
    const score = (results: typeof asPrimary, courseID: string) => results.find((r) => r.courseID === courseID)?.score;
    expect(score(asPrimary, "70-493")).toBeGreaterThan(score(asSecondary, "70-493")!);
  });

  test("results are sorted by score descending, then course id", () => {
    const result = recommendCourses({ careers: ["ml-ai"], skillsWant: [], skillsHave: [], takenCourseIDs: [] });
    for (let i = 1; i < result.length; i++) {
      const prev = result[i - 1]!;
      const cur = result[i]!;
      expect(prev.score > cur.score || (prev.score === cur.score && prev.courseID < cur.courseID)).toBe(true);
    }
  });

  test("skillsWant adds score independently of career", () => {
    const withoutWant = recommendCourses({ careers: [], skillsWant: [], skillsHave: [], takenCourseIDs: [] });
    const withWant = recommendCourses({
      careers: [],
      skillsWant: ["machine-learning"],
      skillsHave: [],
      takenCourseIDs: [],
    });
    expect(withoutWant).toEqual([]);
    expect(withWant.some((r) => r.courseID === "10-301")).toBe(true);
  });

  test("unknown career ids are ignored rather than throwing", () => {
    expect(() =>
      recommendCourses({ careers: ["not-a-real-career"], skillsWant: [], skillsHave: [], takenCourseIDs: [] })
    ).not.toThrow();
  });

  test("respects the limit", () => {
    const result = recommendCourses({
      careers: ["ml-ai", "data-science", "swe"],
      skillsWant: [],
      skillsHave: [],
      takenCourseIDs: [],
      limit: 3,
    });
    expect(result.length).toBeLessThanOrEqual(3);
  });
});
