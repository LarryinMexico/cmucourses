import { CareerID } from "../taxonomy/careers";
import { SkillID } from "../taxonomy/skills";

/**
 * The skills each career path draws on. `core` is what makes a course count as belonging to
 * that career (see careersForCourse in mapping/index.ts) and scores highest in
 * recommendCourses; `supporting` still scores but doesn't establish the career link on its own.
 *
 * `satisfies Record<CareerID, ...>` requires every career in taxonomy/careers.ts to have an
 * entry — add one here before adding a new career.
 *
 * DRAFT for team review. `product-management`, `ux-design`, `consulting`,
 * `entrepreneurship` and `tech-policy` share `product-strategy`/`leadership`/`technical-writing`
 * because SKILLS has no dedicated id for those disciplines yet — expect a course tagged with one
 * of those skills to show up under several adjacent careers until the taxonomy grows.
 */
export const CAREER_SKILLS = {
  swe: {
    core: ["algorithms", "systems-programming", "databases", "web-development"],
    supporting: ["c-cpp", "java", "javascript-typescript", "cloud-devops", "sql"],
  },
  "ml-ai": {
    core: ["machine-learning", "deep-learning", "statistics"],
    supporting: [
      "python",
      "linear-algebra",
      "probability",
      "reinforcement-learning",
      "nlp",
      "computer-vision",
      "optimization",
    ],
  },
  "data-science": {
    core: ["statistics", "data-visualization", "machine-learning"],
    supporting: ["python", "probability", "sql", "databases"],
  },
  "systems-infra": {
    core: ["systems-programming", "operating-systems", "distributed-systems", "cloud-devops"],
    supporting: ["c-cpp", "networking", "computer-architecture", "databases"],
  },
  security: {
    core: ["security-fundamentals", "cryptography", "networking"],
    supporting: ["systems-programming", "operating-systems", "c-cpp"],
  },
  "quant-finance": {
    core: ["financial-modeling", "statistics", "probability"],
    supporting: ["python", "optimization", "linear-algebra", "data-visualization"],
  },
  "product-management": {
    core: ["product-strategy", "user-research"],
    supporting: ["data-visualization", "leadership", "technical-writing", "ui-ux-design"],
  },
  "ux-design": {
    core: ["ui-ux-design", "user-research"],
    supporting: ["web-development", "product-strategy", "data-visualization"],
  },
  robotics: {
    core: ["controls", "embedded-systems", "computer-vision"],
    supporting: ["c-cpp", "machine-learning", "reinforcement-learning", "linear-algebra"],
  },
  "hardware-embedded": {
    core: ["embedded-systems", "computer-architecture", "c-cpp"],
    supporting: ["controls", "systems-programming", "operating-systems"],
  },
  research: {
    core: ["statistics", "probability", "optimization"],
    supporting: ["machine-learning", "linear-algebra", "algorithms", "technical-writing"],
  },
  consulting: {
    core: ["product-strategy", "leadership", "technical-writing"],
    supporting: ["data-visualization", "financial-modeling", "user-research"],
  },
  entrepreneurship: {
    core: ["product-strategy", "leadership", "financial-modeling"],
    supporting: ["technical-writing", "user-research", "web-development"],
  },
  "tech-policy": {
    core: ["technical-writing", "data-visualization", "leadership"],
    supporting: ["statistics", "product-strategy"],
  },
} as const satisfies Record<CareerID, { core: readonly SkillID[]; supporting: readonly SkillID[] }>;
