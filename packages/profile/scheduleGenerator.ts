import { availabilityFit, parseCatalogTime, timePairOverlaps, type MeetingTime } from "./availability";
import type { BusyBlock, Modality, SchedulePreferences, Workload } from "./schema";
import { CAREER_SKILLS } from "./mapping/careerSkills";
import { courseSkillsIndex, isCareerID } from "./mapping/internal";
import { SkillID } from "./taxonomy/skills";
import { CareerID } from "./taxonomy/careers";

/**
 * Builds up to a few candidate weekly schedules from a fixed list of courses the student
 * picked, choosing one lecture (+ section, if the lecture has any) per course so that no two
 * courses' meeting times conflict, then ranks candidates by availability/workload/career fit.
 * Pure and DOM-free so it can be unit-tested and reused by any client (web, script, etc.).
 */

export interface GenSection {
  name: string;
  times: MeetingTime[];
}

export interface GenLecture extends GenSection {
  sections: GenSection[];
}

export interface CandidateCourse {
  courseID: string;
  /** Parsed from the catalog's `units` string; 0 or NaN excluded from the workload total. */
  units: number;
  lectures: GenLecture[];
}

/** Identifies one attendable option of a course: a lecture, plus a section if it has any. */
export interface SectionRef {
  courseID: string;
  lecture: string;
  section: string | null;
}

export interface GeneratorInput {
  /** Courses that must all be scheduled. */
  courses: CandidateCourse[];
  /**
   * A pool to draw from: each may be added or left out, so the generator chooses a subset that
   * suits the units range. A pool course with a lock counts as required. Without a units range
   * there is nothing to choose by, so every pool course that fits is added.
   */
  optionalCourses?: CandidateCourse[];
  busyBlocks: BusyBlock[];
  workload: Workload | null;
  /** profile.careers — ordered by priority; the first is weighted highest. */
  careers: readonly string[];
  skillsWant: readonly string[];
  skillsHave: readonly string[];
  preferences: SchedulePreferences;
  preferredModality: Modality | null;
  maxCandidates?: number;
  /** Options the student pinned. A locked course only considers its matching option(s). */
  locks?: readonly SectionRef[];
  /** Options the student ruled out. They are removed before any lock is applied. */
  excluded?: readonly SectionRef[];
}

export interface SectionPick {
  courseID: string;
  lecture: string;
  section: string | null;
  times: MeetingTime[];
}

export type WorkloadFit = "UNDER" | "IN_RANGE" | "OVER" | "UNKNOWN";

export interface ScheduleCandidate {
  picks: SectionPick[];
  totalUnits: number;
  availability: { status: "FITS" | "CONFLICTS" | "UNKNOWN"; conflicts: string[] };
  workloadFit: WorkloadFit;
  careerScore: number;
  preferenceScore: number;
  /** The four 0-100 components `totalScore` is the weighted sum of. */
  scores: { availability: number; workload: number; career: number; preference: number };
  totalScore: number;
  reasons: string[];
}

const DEFAULT_MAX_CANDIDATES = 3;
const BEAM_WIDTH = 200;
const DIVERSITY_THRESHOLD = 0.7;

/** How much each part counts toward a candidate's totalScore. Sums to 1; the UI shows these. */
export const SCORE_WEIGHTS = { availability: 0.35, workload: 0.25, career: 0.2, preference: 0.2 } as const;

const AVAILABILITY_WEIGHT = SCORE_WEIGHTS.availability;
const WORKLOAD_WEIGHT = SCORE_WEIGHTS.workload;
const CAREER_WEIGHT = SCORE_WEIGHTS.career;
const PREFERENCE_WEIGHT = SCORE_WEIGHTS.preference;

const FIT_SCORE: Record<"FITS" | "CONFLICTS" | "UNKNOWN", number> = { FITS: 100, UNKNOWN: 50, CONFLICTS: 0 };

// Same weights as recommendCourses (packages/profile/mapping/index.ts), applied without excluding
// taken courses — the student already chose these courses, so "already taken" doesn't apply.
const CORE_WEIGHT_PRIMARY = 3;
const CORE_WEIGHT_OTHER = 2;
const SUPPORTING_WEIGHT = 1;
const WANT_WEIGHT = 2;
// Scales the raw per-candidate career point total into a 0-100 score. Chosen so one course
// matching a primary career's core skill (3 points) plus a want-list skill (2 points) on a
// single-course schedule lands near the middle of the range, not saturating instantly.
const CAREER_SCALE = 5;

/** How many left-out pool courses the summary reason names before saying "and N more". */
const MAX_LEFT_OUT_LISTED = 6;

// A course's units range is scored 0 outside [min, max]; WORKLOAD_WIDTH_FLOOR keeps a very
// narrow or single-value range from making the score fall off a cliff, and
// WORKLOAD_DEFAULT_RANGE approximates a missing bound (e.g. only unitsMin set) as "give or take
// 12 units" either side.
const WORKLOAD_WIDTH_FLOOR = 3;
const WORKLOAD_DEFAULT_RANGE = 12;

interface Option {
  lecture: string;
  section: string | null;
  times: MeetingTime[];
  /** Clashes with the student's busy blocks; scored once here rather than per partial schedule. */
  busy: boolean;
  /** This option's share of the availability score (FIT_SCORE of its fit against the busy blocks). */
  fitScore: number;
}

const optionsFor = (course: CandidateCourse, busyBlocks: BusyBlock[]): Option[] => {
  const options: Option[] = [];
  const add = (lecture: string, section: string | null, times: MeetingTime[]) => {
    const { status } = availabilityFit([times], busyBlocks);
    options.push({ lecture, section, times, busy: status === "CONFLICTS", fitScore: FIT_SCORE[status] });
  };
  for (const lecture of course.lectures) {
    if (lecture.sections.length === 0) {
      add(lecture.name, null, lecture.times);
    } else {
      for (const section of lecture.sections) add(lecture.name, section.name, [...lecture.times, ...section.times]);
    }
  }
  return options;
};

const matchesRef = (option: Option, ref: SectionRef): boolean =>
  option.lecture === ref.lecture && option.section === ref.section;

interface ResolvedOptions {
  options: Option[];
  /** Locks for this course that match no remaining option (the section was removed, or excluded). */
  staleLocks: SectionRef[];
  /** The student excluded everything this course offers. */
  allExcluded: boolean;
}

/** Applies excludes, then locks, to one course's options. A lock that matches nothing is ignored. */
const resolveOptions = (
  course: CandidateCourse,
  busyBlocks: BusyBlock[],
  locks: readonly SectionRef[],
  excluded: readonly SectionRef[]
): ResolvedOptions => {
  const all = optionsFor(course, busyBlocks);
  const remaining = all.filter(
    (option) => !excluded.some((ref) => ref.courseID === course.courseID && matchesRef(option, ref))
  );
  const courseLocks = locks.filter((ref) => ref.courseID === course.courseID);
  const locked = remaining.filter((option) => courseLocks.some((ref) => matchesRef(option, ref)));
  const staleLocks = courseLocks.filter((ref) => !remaining.some((option) => matchesRef(option, ref)));

  return {
    options: locked.length > 0 ? locked : remaining,
    staleLocks,
    allExcluded: all.length > 0 && remaining.length === 0,
  };
};

const conflictsWithAny = (times: MeetingTime[], used: MeetingTime[]): boolean =>
  times.some((t) => used.some((u) => timePairOverlaps(t, u)));

interface PartialSchedule {
  picks: SectionPick[];
  usedTimes: MeetingTime[];
  unscheduled: string[];
  /** Picks that clash with the student's busy blocks. */
  busyClashes: number;
  /** Running sums, so the beam can rank a partial schedule without rebuilding it. */
  units: number;
  fitSum: number;
  careerRaw: number;
}

interface SearchContext {
  required: CandidateCourse[];
  optional: CandidateCourse[];
  optionsByCourse: ReadonlyMap<string, Option[]>;
  unitsByCourse: ReadonlyMap<string, number>;
  careerRawByCourse: ReadonlyMap<string, number>;
  workload: Workload | null;
  /** A units range exists to choose pool courses by. Otherwise every pool course that fits is added. */
  chooseSubset: boolean;
}

/**
 * Beam ranking: the score the partial schedule would have as it stands, with the same weights as a
 * finished candidate. With only required courses every partial at a step holds the same courses,
 * so only availability differs and this reduces to preferring fewer busy-block clashes. With a
 * pool it also has to prefer a partial that is closer to the units range or carries a more useful
 * course, or the beam would always favour adding nothing (fewest clashes).
 */
const partialScore = (partial: PartialSchedule, workload: Workload | null): number => {
  const availability = partial.picks.length === 0 ? 100 : partial.fitSum / partial.picks.length;
  return (
    -1000 * partial.unscheduled.length +
    AVAILABILITY_WEIGHT * availability +
    WORKLOAD_WEIGHT * workloadFitFor(partial.units, workload).score +
    CAREER_WEIGHT * Math.min(100, partial.careerRaw * CAREER_SCALE)
  );
};

const knownUnits = (units: number | undefined): number =>
  units !== undefined && units > 0 && !Number.isNaN(units) ? units : 0;

const extend = (
  partial: PartialSchedule,
  course: CandidateCourse,
  option: Option,
  ctx: SearchContext
): PartialSchedule => ({
  picks: [
    ...partial.picks,
    { courseID: course.courseID, lecture: option.lecture, section: option.section, times: option.times },
  ],
  usedTimes: [...partial.usedTimes, ...option.times],
  unscheduled: partial.unscheduled,
  busyClashes: partial.busyClashes + (option.busy ? 1 : 0),
  units: partial.units + knownUnits(ctx.unitsByCourse.get(course.courseID)),
  fitSum: partial.fitSum + option.fitScore,
  careerRaw: partial.careerRaw + (ctx.careerRawByCourse.get(course.courseID) ?? 0),
});

const prune = (partials: PartialSchedule[], workload: Workload | null): PartialSchedule[] =>
  partials.length > BEAM_WIDTH
    ? [...partials].sort((a, b) => partialScore(b, workload) - partialScore(a, workload)).slice(0, BEAM_WIDTH)
    : partials;

const buildPartials = (ctx: SearchContext): PartialSchedule[] => {
  const { optionsByCourse, workload } = ctx;
  // Most-constrained-first: fewer options to try first narrows the beam faster.
  const sorted = [...ctx.required].sort(
    (a, b) => (optionsByCourse.get(a.courseID)?.length ?? 0) - (optionsByCourse.get(b.courseID)?.length ?? 0)
  );

  let partials: PartialSchedule[] = [
    { picks: [], usedTimes: [], unscheduled: [], busyClashes: 0, units: 0, fitSum: 0, careerRaw: 0 },
  ];

  for (const course of sorted) {
    const options = optionsByCourse.get(course.courseID) ?? [];
    if (options.length === 0) {
      partials = partials.map((p) => ({ ...p, unscheduled: [...p.unscheduled, course.courseID] }));
      continue;
    }

    const next: PartialSchedule[] = [];
    for (const partial of partials) {
      for (const option of options) {
        if (conflictsWithAny(option.times, partial.usedTimes)) continue;
        next.push(extend(partial, course, option, ctx));
      }
    }

    // No complete conflict-free combination exists for the requested courses. Do not silently
    // recommend a schedule with overlapping classes; the UI will ask the student to change the
    // course set instead.
    if (next.length === 0) return [];

    partials = prune(next, workload);
  }

  // Pool courses: each is either added (one of its options) or left out. The most useful ones
  // go first so the beam keeps them. A course that cannot be added to a partial (it clashes, or
  // would pass the maximum) simply leaves that partial as it is.
  const max = workload?.unitsMax ?? null;
  const pool = [...ctx.optional].sort(
    (a, b) =>
      (ctx.careerRawByCourse.get(b.courseID) ?? 0) - (ctx.careerRawByCourse.get(a.courseID) ?? 0) ||
      a.courseID.localeCompare(b.courseID)
  );
  for (const course of pool) {
    const options = optionsByCourse.get(course.courseID) ?? [];
    if (options.length === 0) continue;
    const courseUnits = knownUnits(ctx.unitsByCourse.get(course.courseID));

    const next: PartialSchedule[] = [];
    for (const partial of partials) {
      let added = false;
      for (const option of options) {
        if (conflictsWithAny(option.times, partial.usedTimes)) continue;
        if (max !== null && partial.units + courseUnits > max) continue;
        next.push(extend(partial, course, option, ctx));
        added = true;
      }
      if (!added || ctx.chooseSubset) next.push(partial);
    }
    partials = prune(next, workload);
  }

  return partials;
};

/** How a semester's unit total sits against the profile's range; shared by the schedule generator and the course plan. */
export const workloadFitFor = (totalUnits: number, workload: Workload | null): { fit: WorkloadFit; score: number } => {
  const min = workload?.unitsMin ?? null;
  const max = workload?.unitsMax ?? null;
  if (min === null && max === null) return { fit: "UNKNOWN", score: 100 };

  const lo = min ?? 0;
  const hi = max ?? lo + WORKLOAD_DEFAULT_RANGE;
  if (totalUnits >= lo && totalUnits <= hi) return { fit: "IN_RANGE", score: 100 };

  const width = Math.max(hi - lo, WORKLOAD_WIDTH_FLOOR);
  const dist = totalUnits < lo ? lo - totalUnits : totalUnits - hi;
  const score = Math.max(0, 100 - (dist / width) * 100);
  return { fit: totalUnits < lo ? "UNDER" : "OVER", score };
};

const careerScoreFor = (
  courseID: string,
  careers: readonly string[],
  skillsWant: readonly string[],
  skillsHave: readonly string[]
): { raw: number; reasons: string[] } => {
  const skills = courseSkillsIndex[courseID] ?? [];
  const have = new Set(skillsHave);
  const want = new Set(skillsWant);
  const newSkills = skills.filter((skill) => !have.has(skill));
  const [primaryCareer, ...otherCareers] = careers.filter(isCareerID);

  let raw = 0;
  const reasonSkills = new Set<SkillID>();

  const scoreAgainstCareer = (career: CareerID, coreWeight: number) => {
    const { core, supporting } = CAREER_SKILLS[career];
    for (const skill of newSkills) {
      if ((core as readonly SkillID[]).includes(skill)) {
        raw += coreWeight;
        reasonSkills.add(skill);
      } else if ((supporting as readonly SkillID[]).includes(skill)) {
        raw += SUPPORTING_WEIGHT;
        reasonSkills.add(skill);
      }
    }
  };

  if (primaryCareer) scoreAgainstCareer(primaryCareer, CORE_WEIGHT_PRIMARY);
  for (const career of otherCareers) scoreAgainstCareer(career, CORE_WEIGHT_OTHER);
  for (const skill of newSkills) {
    if (want.has(skill)) {
      raw += WANT_WEIGHT;
      reasonSkills.add(skill);
    }
  }

  return { raw, reasons: [...reasonSkills] };
};

const inferredModality = (times: MeetingTime[]): Modality | null => {
  const known = times
    .map((time) => `${time.location ?? ""} ${time.building ?? ""} ${time.room ?? ""}`.trim())
    .filter(Boolean);
  if (known.length === 0) return null;
  const remoteCount = known.filter((value) => /remote|online|zoom/i.test(value)).length;
  if (remoteCount === known.length) return "REMOTE";
  if (remoteCount > 0) return "HYBRID";
  return "IN_PERSON";
};

const preferenceScoreFor = (
  picks: SectionPick[],
  preferences: SchedulePreferences,
  preferredModality: Modality | null
): { score: number; reasons: string[] } => {
  const times = picks.flatMap((pick) => pick.times);
  const hasPreferences =
    preferences.earliestStart !== null ||
    preferences.latestEnd !== null ||
    preferences.preferredDays.length > 0 ||
    preferences.compactDays ||
    preferredModality !== null;
  if (!hasPreferences) return { score: 100, reasons: [] };

  let checks = 0;
  let matches = 0;
  const reasons: string[] = [];
  const meetingDays = new Set<number>();

  for (const time of times) {
    const begin = parseCatalogTime(time.begin);
    const end = parseCatalogTime(time.end);
    for (const day of time.days) meetingDays.add(day);
    if (begin === null || end === null) continue;

    if (preferences.earliestStart !== null) {
      checks += 1;
      if (begin >= preferences.earliestStart) matches += 1;
    }
    if (preferences.latestEnd !== null) {
      checks += 1;
      if (end <= preferences.latestEnd) matches += 1;
    }
    if (preferences.preferredDays.length > 0) {
      checks += time.days.length;
      matches += time.days.filter((day) => preferences.preferredDays.includes(day)).length;
    }
  }

  if (preferences.compactDays && meetingDays.size > 0) {
    checks += 1;
    matches += Math.max(0, 1 - Math.max(0, meetingDays.size - 3) * 0.2);
  }

  if (preferredModality !== null) {
    const modalities = picks
      .map((pick) => inferredModality(pick.times))
      .filter((value): value is Modality => value !== null);
    if (modalities.length > 0) {
      checks += modalities.length;
      matches += modalities.filter((modality) => modality === preferredModality).length;
    }
  }

  const score = checks === 0 ? 100 : (matches / checks) * 100;
  if (score >= 99) reasons.push("Matches your saved time and format preferences");
  else if (score < 60) reasons.push("Some meetings fall outside your saved preferences");
  return { score, reasons };
};

const pickKey = (p: SectionPick): string => `${p.courseID}:${p.lecture}:${p.section ?? ""}`;

const pickSignature = (picks: SectionPick[]): string =>
  [...picks]
    .sort((a, b) => a.courseID.localeCompare(b.courseID))
    .map(pickKey)
    .join("|");

const similarity = (a: SectionPick[], b: SectionPick[]): number => {
  if (a.length === 0 || b.length === 0) return 0;
  const bKeys = new Set(b.map(pickKey));
  const shared = a.filter((p) => bKeys.has(pickKey(p))).length;
  return shared / Math.max(a.length, b.length);
};

const buildCandidate = (
  partial: PartialSchedule,
  { busyBlocks, workload, careers, skillsWant, skillsHave, preferences, preferredModality }: GeneratorInput,
  unitsByCourse: ReadonlyMap<string, number>,
  allExcluded: ReadonlySet<string>,
  pool: { ids: ReadonlySet<string>; chooseSubset: boolean }
): ScheduleCandidate => {
  const conflicts: string[] = [];
  let availabilitySum = 0;
  let careerRaw = 0;
  const reasons: string[] = [];
  let totalUnits = 0;

  for (const pick of partial.picks) {
    const fit = availabilityFit([pick.times], busyBlocks);
    availabilitySum += FIT_SCORE[fit.status];
    if (fit.status === "CONFLICTS") conflicts.push(pick.courseID);

    const units = unitsByCourse.get(pick.courseID) ?? 0;
    if (units > 0 && !Number.isNaN(units)) totalUnits += units;

    const { raw, reasons: skillReasons } = careerScoreFor(pick.courseID, careers, skillsWant, skillsHave);
    careerRaw += raw;
    for (const skill of skillReasons) reasons.push(`Builds ${skill} toward your goals (${pick.courseID})`);
  }

  if (pool.ids.size > 0) {
    const picked = new Set(partial.picks.map((pick) => pick.courseID));
    for (const courseID of [...pool.ids].filter((id) => picked.has(id)).sort()) {
      reasons.push(`Added ${courseID} from your pool`);
    }
    const leftOut = [...pool.ids].filter((id) => !picked.has(id)).sort();
    if (leftOut.length > 0) {
      const shown = leftOut.slice(0, MAX_LEFT_OUT_LISTED).join(", ");
      const more = leftOut.length - MAX_LEFT_OUT_LISTED;
      reasons.push(`Not added from your pool: ${shown}${more > 0 ? ` and ${more} more` : ""}`);
    }
    if (!pool.chooseSubset) reasons.push("Set a units range to let the generator choose from your pool");
  }

  for (const courseID of partial.unscheduled) {
    reasons.push(
      allExcluded.has(courseID)
        ? `Every option for ${courseID} is excluded; it is left out of this candidate`
        : `No schedule data for ${courseID}; excluded from this candidate`
    );
  }

  const count = partial.picks.length || 1;
  const availabilityScore = availabilitySum / count;
  const { fit: workloadFit, score: workloadScore } = workloadFitFor(totalUnits, workload);
  const careerScore = Math.min(100, careerRaw * CAREER_SCALE);
  const { score: preferenceScore, reasons: preferenceReasons } = preferenceScoreFor(
    partial.picks,
    preferences,
    preferredModality
  );
  reasons.push(...preferenceReasons);

  if (conflicts.length > 0) reasons.unshift(`Time conflict: ${conflicts.join(", ")}`);
  if (workloadFit === "OVER") reasons.push(`${totalUnits} units — above your target`);
  else if (workloadFit === "UNDER") reasons.push(`${totalUnits} units — below your target`);
  else if (workloadFit === "IN_RANGE") reasons.push(`${totalUnits} units — within your target range`);

  const totalScore =
    AVAILABILITY_WEIGHT * availabilityScore +
    WORKLOAD_WEIGHT * workloadScore +
    CAREER_WEIGHT * careerScore +
    PREFERENCE_WEIGHT * preferenceScore;

  return {
    picks: partial.picks,
    totalUnits,
    availability: {
      status: conflicts.length > 0 ? "CONFLICTS" : availabilityScore >= 100 ? "FITS" : "UNKNOWN",
      conflicts,
    },
    workloadFit,
    careerScore,
    preferenceScore,
    scores: {
      availability: availabilityScore,
      workload: workloadScore,
      career: careerScore,
      preference: preferenceScore,
    },
    totalScore,
    reasons,
  };
};

export const generateSchedules = (input: GeneratorInput): ScheduleCandidate[] => {
  const locks = input.locks ?? [];
  const requiredIDs = new Set(input.courses.map((course) => course.courseID));
  const poolCourses = (input.optionalCourses ?? []).filter((course) => !requiredIDs.has(course.courseID));
  if (input.courses.length === 0 && poolCourses.length === 0) return [];

  const allCourses = [...input.courses, ...poolCourses];
  const unitsByCourse = new Map(allCourses.map((c) => [c.courseID, c.units]));

  const optionsByCourse = new Map<string, Option[]>();
  const allExcluded = new Set<string>();
  const lockedPool = new Set<string>();
  const staleLockNotes: string[] = [];
  for (const course of allCourses) {
    const resolved = resolveOptions(course, input.busyBlocks, locks, input.excluded ?? []);
    optionsByCourse.set(course.courseID, resolved.options);
    if (resolved.allExcluded) allExcluded.add(course.courseID);
    for (const ref of resolved.staleLocks) {
      const which = ref.section === null ? ref.lecture : `${ref.lecture} / ${ref.section}`;
      staleLockNotes.push(`${course.courseID} ${which} is locked but no longer available; the lock was ignored`);
    }
    // Pinning a pool course says "I want this one", so it stops being optional.
    const lockCount = locks.filter((ref) => ref.courseID === course.courseID).length;
    if (!requiredIDs.has(course.courseID) && lockCount > resolved.staleLocks.length) lockedPool.add(course.courseID);
  }

  const optional = poolCourses.filter((course) => !lockedPool.has(course.courseID));
  const required = [...input.courses, ...poolCourses.filter((course) => lockedPool.has(course.courseID))];
  const chooseSubset = input.workload?.unitsMin != null || input.workload?.unitsMax != null;

  const partials = buildPartials({
    required,
    optional,
    optionsByCourse,
    unitsByCourse,
    careerRawByCourse: new Map(
      allCourses.map((course) => [
        course.courseID,
        careerScoreFor(course.courseID, input.careers, input.skillsWant, input.skillsHave).raw,
      ])
    ),
    workload: input.workload,
    chooseSubset,
  });
  const pool = { ids: new Set(optional.map((course) => course.courseID)), chooseSubset };

  const seen = new Set<string>();
  const candidates: ScheduleCandidate[] = [];
  for (const partial of partials) {
    const sig = pickSignature(partial.picks);
    if (seen.has(sig)) continue;
    seen.add(sig);
    // With a pool, leaving everything out is not a schedule.
    if (poolCourses.length > 0 && partial.picks.length === 0) continue;
    const candidate = buildCandidate(partial, input, unitsByCourse, allExcluded, pool);
    candidate.reasons.push(...staleLockNotes);
    candidates.push(candidate);
  }

  candidates.sort(
    (a, b) => b.totalScore - a.totalScore || pickSignature(a.picks).localeCompare(pickSignature(b.picks))
  );

  const maxCandidates = input.maxCandidates ?? DEFAULT_MAX_CANDIDATES;
  const diverse: ScheduleCandidate[] = [];
  for (const candidate of candidates) {
    if (diverse.length >= maxCandidates) break;
    const tooSimilar = diverse.some((chosen) => similarity(chosen.picks, candidate.picks) > DIVERSITY_THRESHOLD);
    if (!tooSimilar) diverse.push(candidate);
  }
  // Not enough sufficiently-different candidates: fill the rest by score alone.
  for (const candidate of candidates) {
    if (diverse.length >= maxCandidates) break;
    if (!diverse.includes(candidate)) diverse.push(candidate);
  }

  return diverse;
};
