import type { MajorRequirements } from "./index";

/**
 * MISM core requirements, from the program handbook section 4.1.
 * 108 core + 54 elective = 162 total units.
 *
 * Units here are the handbook's, not the catalog's: 94-739 is listed as VAR units in the live
 * course catalog but counts as 12 toward the degree. Course IDs are checked against the live
 * catalog by packages/profile/scripts/check-course-ids.ts; 95-867 is knowingly absent from
 * it — verified against the full ~8,400-course catalog on 2026-09-19, no course by that number
 * or name exists. It stays in this data because the handbook lists it; the UI must show it
 * without a course link rather than silently drop it.
 */
export const MISM_REQUIREMENTS: MajorRequirements = {
  majorID: "mism",
  core: [
    { id: "org-design", label: "Organizational Design & Implementation", options: ["94-700"], units: 6 },
    { id: "distributed-systems", label: "Distributed Systems for ISM", options: ["95-702"], units: 12 },
    { id: "database-management", label: "Database Management", options: ["95-703"], units: 12 },
    { id: "economic-analysis", label: "Economic Analysis", options: ["95-710"], units: 6 },
    { id: "accounting-finance", label: "Accounting & Finance Analytics", options: ["95-719"], units: 6 },
    { id: "capstone", label: "Capstone Project", options: ["94-739"], units: 12 },
    { id: "decision-making", label: "Decision Making Under Uncertainty", options: ["95-760"], units: 6 },
    { id: "statistics", label: "Statistics for IT Managers", options: ["95-796"], units: 6 },
    { id: "professional-seminar", label: "ISM Professional Seminar", options: ["95-843"], units: 0 },
    { id: "tech-strategy", label: "Tech Strategy & Governance", options: ["95-867"], units: 12 },
    { id: "strategic-comm", label: "Strategic Communication for IS Leaders", options: ["95-877"], units: 12 },
    { id: "python", label: "Python for Software Development", options: ["95-896"], units: 12 },
    {
      id: "design-elective",
      label: "Object Oriented Analysis & Design, Agile Methods, or Design Strategy",
      options: ["95-706", "95-874", "94-866"],
      units: 6,
    },
  ],
  electiveUnits: 54,
  totalUnits: 162,
  source: "MISM program handbook, section 4.1 (Course Requirements for MISM)",
};
