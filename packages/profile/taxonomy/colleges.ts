import { TaxonomyItem } from "./types";

// DRAFT for team review. Ids are permanent once shipped; see TaxonomyItem.
// Heinz College programs were checked against heinz.cmu.edu/programs on 2026-09-11; the other
// colleges' programs still need to be checked against the current CMU catalog.

export const COLLEGES = [
  { id: "cit", label: "College of Engineering" },
  { id: "cfa", label: "College of Fine Arts" },
  { id: "dietrich", label: "Dietrich College of Humanities and Social Sciences" },
  { id: "heinz", label: "Heinz College of Information Systems and Public Policy" },
  { id: "mcs", label: "Mellon College of Science" },
  { id: "scs", label: "School of Computer Science" },
  { id: "tepper", label: "Tepper School of Business" },
  { id: "interdisciplinary", label: "Interdisciplinary Programs" },
] as const satisfies readonly TaxonomyItem[];

export type CollegeID = (typeof COLLEGES)[number]["id"];

export interface ProgramItem extends TaxonomyItem {
  /** Colleges that offer the program (joint programs list several). Empty means any college. */
  colleges: readonly CollegeID[];
}

/** Majors and graduate programs. A major must belong to the student's college (see majorsForCollege). */
export const MAJORS = [
  { id: "cs", label: "Computer Science", colleges: ["scs"] },
  { id: "ai", label: "Artificial Intelligence", colleges: ["scs"] },
  { id: "computational-biology", label: "Computational Biology", colleges: ["scs"] },
  { id: "robotics", label: "Robotics", colleges: ["scs"] },
  { id: "ms-cs", label: "M.S. in Computer Science", colleges: ["scs"] },
  { id: "ms-ml", label: "M.S. in Machine Learning", colleges: ["scs"] },
  { id: "mcds", label: "Master of Computational Data Science", colleges: ["scs"] },
  { id: "mhci", label: "Master of Human-Computer Interaction", colleges: ["scs"] },
  { id: "ece", label: "Electrical and Computer Engineering", colleges: ["cit"] },
  { id: "mechanical-engineering", label: "Mechanical Engineering", colleges: ["cit"] },
  { id: "chemical-engineering", label: "Chemical Engineering", colleges: ["cit"] },
  { id: "civil-engineering", label: "Civil and Environmental Engineering", colleges: ["cit"] },
  { id: "materials-science", label: "Materials Science and Engineering", colleges: ["cit"] },
  { id: "biomedical-engineering", label: "Biomedical Engineering", colleges: ["cit"] },
  { id: "engineering-public-policy", label: "Engineering and Public Policy", colleges: ["cit"] },
  { id: "biological-sciences", label: "Biological Sciences", colleges: ["mcs"] },
  { id: "chemistry", label: "Chemistry", colleges: ["mcs"] },
  { id: "mathematical-sciences", label: "Mathematical Sciences", colleges: ["mcs"] },
  { id: "physics", label: "Physics", colleges: ["mcs"] },
  { id: "neuroscience", label: "Neuroscience", colleges: ["mcs"] },
  { id: "economics", label: "Economics", colleges: ["dietrich"] },
  { id: "statistics", label: "Statistics", colleges: ["dietrich"] },
  { id: "statistics-ml", label: "Statistics and Machine Learning", colleges: ["dietrich"] },
  // Joint Dietrich / Heinz undergraduate program.
  { id: "information-systems", label: "B.S. in Information Systems", colleges: ["dietrich", "heinz"] },
  { id: "psychology", label: "Psychology", colleges: ["dietrich"] },
  { id: "cognitive-science", label: "Cognitive Science", colleges: ["dietrich"] },
  { id: "philosophy", label: "Philosophy", colleges: ["dietrich"] },
  { id: "linguistics", label: "Linguistics", colleges: ["dietrich"] },
  { id: "english", label: "English", colleges: ["dietrich"] },
  { id: "history", label: "History", colleges: ["dietrich"] },
  { id: "modern-languages", label: "Modern Languages", colleges: ["dietrich"] },
  { id: "global-studies", label: "Global Studies", colleges: ["dietrich"] },
  { id: "policy-management", label: "Policy and Management", colleges: ["dietrich"] },
  { id: "architecture", label: "Architecture", colleges: ["cfa"] },
  { id: "art", label: "Art", colleges: ["cfa"] },
  { id: "design", label: "Design", colleges: ["cfa"] },
  { id: "drama", label: "Drama", colleges: ["cfa"] },
  { id: "music", label: "Music", colleges: ["cfa"] },
  { id: "business-administration", label: "Business Administration", colleges: ["tepper"] },
  // Heinz: School of Information Systems and Management
  { id: "mism", label: "Master of Information Systems Management (MISM)", colleges: ["heinz"] },
  {
    id: "mism-bida",
    label: "MISM - Business Intelligence & Data Analytics (MISM-BIDA)",
    colleges: ["heinz"],
  },
  { id: "aim", label: "M.S. in Artificial Intelligence Systems Management (AIM)", colleges: ["heinz"] },
  { id: "msit", label: "M.S. in Information Technology (MSIT, online)", colleges: ["heinz"] },
  {
    id: "msispm",
    label: "M.S. in Information Security Policy and Management (MSISPM)",
    colleges: ["heinz"],
  },
  { id: "phd-ism", label: "Ph.D. in Information Systems and Management", colleges: ["heinz"] },
  // Heinz: School of Public Policy & Management. The DC and Fast Track MSPPM options are
  // locations/durations of the same degree, so they are not listed separately.
  { id: "msppm", label: "M.S. in Public Policy and Management (MSPPM)", colleges: ["heinz"] },
  { id: "msppm-da", label: "MSPPM - Data Analytics", colleges: ["heinz"] },
  { id: "mpm", label: "Master of Public Management (MPM)", colleges: ["heinz"] },
  {
    id: "mshca",
    label: "M.S. in Health Care Analytics & Information Technology (MSHCA)",
    colleges: ["heinz"],
  },
  { id: "mmm", label: "Master of Medical Management (MMM)", colleges: ["heinz"] },
  { id: "phd-ppm", label: "Ph.D. in Public Policy and Management", colleges: ["heinz"] },
  // Heinz / College of Fine Arts joint programs
  { id: "mam", label: "Master of Arts Management (MAM)", colleges: ["heinz", "cfa"] },
  { id: "meim", label: "Master of Entertainment Industry Management (MEIM)", colleges: ["heinz", "cfa"] },
  { id: "bxa", label: "BXA Intercollege Degree", colleges: ["interdisciplinary"] },
  { id: "other", label: "Other / not listed", colleges: [] },
] as const satisfies readonly ProgramItem[];

/**
 * The majors a student in `college` can pick: programs that college offers (including joint
 * ones) plus the college-less ones ("Other / not listed"). With no college chosen yet, every major.
 */
export const majorsForCollege = (college: string | null): ProgramItem[] =>
  MAJORS.filter(
    (major: ProgramItem) =>
      college === null || major.colleges.length === 0 || major.colleges.some((id) => id === college)
  );

/** Minors are open to students from any college, so they are not filtered by college. */
export const MINORS = [
  { id: "cs", label: "Computer Science", colleges: ["scs"] },
  { id: "machine-learning", label: "Machine Learning", colleges: ["scs"] },
  { id: "hci", label: "Human-Computer Interaction", colleges: ["scs"] },
  { id: "robotics", label: "Robotics", colleges: ["scs"] },
  { id: "software-engineering", label: "Software Engineering", colleges: ["scs"] },
  { id: "business-administration", label: "Business Administration", colleges: ["tepper"] },
  { id: "economics", label: "Economics", colleges: ["dietrich"] },
  { id: "statistics", label: "Statistics", colleges: ["dietrich"] },
  { id: "psychology", label: "Psychology", colleges: ["dietrich"] },
  { id: "mathematical-sciences", label: "Mathematical Sciences", colleges: ["mcs"] },
  { id: "physics", label: "Physics", colleges: ["mcs"] },
  { id: "design", label: "Design", colleges: ["cfa"] },
  { id: "music", label: "Music", colleges: ["cfa"] },
  { id: "innovation-entrepreneurship", label: "Innovation and Entrepreneurship", colleges: [] },
  { id: "other", label: "Other / not listed", colleges: [] },
] as const satisfies readonly ProgramItem[];
