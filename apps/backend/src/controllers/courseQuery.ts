import type { Prisma } from "@cmucourses/db";

export type SummerSession = "summer one" | "summer two" | "summer all";
const SUMMER_SESSIONS: readonly string[] = ["summer one", "summer two", "summer all"];
const SEMESTERS: readonly string[] = ["fall", "spring", "summer"];

/** One "Offered in" choice. A summer entry without `session` means every summer sub-session. */
export interface SessionFilter {
  year: number;
  semester: string;
  session?: SummerSession;
}

/** Sessions arrive as JSON strings. Anything that cannot be honoured is dropped, not widened. */
export const parseSessions = (values: string[]): SessionFilter[] =>
  values.flatMap((serialized): SessionFilter[] => {
    try {
      const raw = JSON.parse(serialized) as { year?: unknown; semester?: unknown; session?: unknown };
      const year = Number(raw.year);
      if (!Number.isInteger(year) || typeof raw.semester !== "string" || !SEMESTERS.includes(raw.semester)) return [];
      if (raw.session === undefined || raw.session === null) return [{ year, semester: raw.semester }];
      if (raw.semester !== "summer" || typeof raw.session !== "string" || !SUMMER_SESSIONS.includes(raw.session)) {
        return [];
      }
      return [{ year, semester: raw.semester, session: raw.session as SummerSession }];
    } catch {
      return []; // SyntaxError
    }
  });

/** A weekly busy block, in minutes after midnight (day 0 = Sunday), as the profile stores it. */
export interface BusyBlockFilter {
  day: number;
  begin: number;
  end: number;
}

/** Matches LIMITS.busyBlocks in packages/profile. */
export const MAX_BUSY_BLOCKS = 50;

/** `busy=<day>,<begin>,<end>`, repeated. Malformed or out-of-range entries are ignored. */
export const parseBusyBlocks = (values: string[]): BusyBlockFilter[] =>
  values
    .flatMap((value): BusyBlockFilter[] => {
      const parts = value.split(",");
      if (parts.length !== 3 || parts.some((part) => !/^-?\d+$/.test(part))) return [];
      const [day, begin, end] = parts.map(Number) as [number, number, number];
      if (day < 0 || day > 6 || begin < 0 || end > 1440 || begin >= end) return [];
      return [{ day, begin, end }];
    })
    .slice(0, MAX_BUSY_BLOCKS);

/** Aggregation expression: catalog "HH:MMAM"/"HH:MMPM" -> minutes after midnight, else null. */
export const catalogTimeToMinutes = (timeExpr: string): Prisma.InputJsonValue =>
  ({
    $let: {
      vars: {
        t: timeExpr,
        // `vars` are evaluated even when the regex guard below rejects the value, and "TBA"
        // is a real catalog value, so a plain $toInt would abort the whole aggregation.
        hour: { $convert: { input: { $substrBytes: [timeExpr, 0, 2] }, to: "int", onError: null } },
        minute: { $convert: { input: { $substrBytes: [timeExpr, 3, 2] }, to: "int", onError: null } },
        meridiem: { $toUpper: { $substrBytes: [timeExpr, 5, 2] } },
      },
      in: {
        $cond: [
          {
            $not: {
              $regexMatch: { input: "$$t", regex: "^\\d{2}:\\d{2}(AM|PM)$" },
            },
          },
          null,
          {
            $add: [
              "$$minute",
              {
                $multiply: [
                  60,
                  {
                    $cond: [
                      { $eq: ["$$meridiem", "PM"] },
                      {
                        $cond: [{ $eq: ["$$hour", 12] }, 12, { $add: ["$$hour", 12] }],
                      },
                      { $cond: [{ $eq: ["$$hour", 12] }, 0, "$$hour"] },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    },
  }) as Prisma.InputJsonValue;

/** The meeting times of one lecture or section that state a time; TBA entries carry no information. */
export const timedEntries = (meetingVar: string) => ({
  $filter: {
    input: { $ifNull: [`$$${meetingVar}.times`, []] },
    as: "t",
    cond: { $ne: [catalogTimeToMinutes("$$t.begin"), null] },
  },
});

/** Does the schedule bound to `$$<schedVar>` belong to this "Offered in" choice? */
export const sessionMatchesExpr = (schedVar: string, session: SessionFilter) => ({
  $and: [
    { $eq: [`$$${schedVar}.year`, session.year] },
    { $eq: [`$$${schedVar}.semester`, session.semester] },
    ...(session.session ? [{ $eq: [`$$${schedVar}.session`, session.session] }] : []),
  ],
});

/**
 * Sort key for "most recent offering", mirroring compareSessions in the frontend's utils:
 * year, then fall > summer > spring, then within summer two > one > all.
 */
const recencyRank = (v: string) => ({
  $add: [
    { $multiply: [{ $convert: { input: `$$${v}.year`, to: "int", onError: 0 } }, 100] },
    {
      $multiply: [
        {
          $switch: {
            branches: [
              { case: { $eq: [`$$${v}.semester`, "summer"] }, then: 1 },
              { case: { $eq: [`$$${v}.semester`, "fall"] }, then: 2 },
            ],
            default: 0,
          },
        },
        10,
      ],
    },
    {
      $switch: {
        branches: [
          { case: { $eq: [`$$${v}.session`, "summer one"] }, then: 1 },
          { case: { $eq: [`$$${v}.session`, "summer two"] }, then: 2 },
        ],
        default: 0,
      },
    },
  ],
});

/**
 * The schedules a course is judged on. With an Offered-in choice, the schedules in those sessions.
 * Without one, only the most recent offering, after dropping summer schedules with no
 * sub-session and Qatar summer (filterSessions in the frontend's utils).
 */
const scopedSchedules = (sessions: SessionFilter[]) =>
  sessions.length > 0
    ? {
        $filter: {
          input: "$schedules",
          as: "s",
          cond: { $or: sessions.map((session) => sessionMatchesExpr("s", session)) },
        },
      }
    : {
        $let: {
          vars: {
            eligible: {
              $filter: {
                input: { $ifNull: ["$schedules", []] },
                as: "e",
                cond: {
                  $or: [
                    { $ne: ["$$e.semester", "summer"] },
                    {
                      $and: [{ $ne: [{ $ifNull: ["$$e.session", ""] }, ""] }, { $ne: ["$$e.session", "qatar summer"] }],
                    },
                  ],
                },
              },
            },
          },
          in: {
            $let: {
              vars: { best: { $max: { $map: { input: "$$eligible", as: "r", in: recencyRank("r") } } } },
              in: {
                $filter: { input: "$$eligible", as: "e2", cond: { $eq: [recencyRank("e2"), "$$best"] } },
              },
            },
          },
        },
      };

/** Time slot `$$t` overlaps one of the busy blocks. Same rule as conflictFor in packages/profile. */
const clashesWithBusy = (busy: BusyBlockFilter[]) => ({
  $let: {
    vars: { beginM: catalogTimeToMinutes("$$t.begin"), endM: catalogTimeToMinutes("$$t.end") },
    in: {
      $and: [
        { $ne: ["$$endM", null] },
        { $lt: ["$$beginM", "$$endM"] },
        {
          $anyElementTrue: {
            $map: {
              input: { $literal: busy },
              as: "b",
              in: {
                $and: [
                  { $in: ["$$b.day", { $ifNull: ["$$t.days", []] }] },
                  { $lt: ["$$beginM", "$$b.end"] },
                  { $lt: ["$$b.begin", "$$endM"] },
                ],
              },
            },
          },
        },
      ],
    },
  },
});

/**
 * "Only courses that fit my availability", server side so every page is full and totalDocs is
 * right. It must agree with the client's courseMatchesClientFilters / availabilityFit (packages/
 * profile): a course passes if some scoped schedule has a group of meetings, lectures if any
 * lecture states a time and sections otherwise (meetingGroupsFor), where at least one entry states
 * a time and none of them overlaps a busy block. A course with no stated times fails.
 */
export const fitAvailabilityStage = (busy: BusyBlockFilter[], sessions: SessionFilter[]): Prisma.InputJsonValue => {
  const lectures = { $ifNull: ["$$sched.lectures", []] };
  const sections = { $ifNull: ["$$sched.sections", []] };
  const hasTime = (list: unknown) => ({
    $anyElementTrue: { $map: { input: list, as: "m", in: { $gt: [{ $size: timedEntries("m") }, 0] } } },
  });
  const groups = { $cond: [hasTime(lectures), lectures, sections] };
  const groupFits = {
    $let: {
      vars: { timed: timedEntries("m") },
      in: {
        $and: [
          { $gt: [{ $size: "$$timed" }, 0] },
          { $allElementsTrue: { $map: { input: "$$timed", as: "t", in: { $not: [clashesWithBusy(busy)] } } } },
        ],
      },
    },
  };

  return {
    $match: {
      $expr: {
        $gt: [
          {
            $size: {
              $filter: {
                input: scopedSchedules(sessions),
                as: "sched",
                cond: { $anyElementTrue: { $map: { input: groups, as: "m", in: groupFits } } },
              },
            },
          },
          0,
        ],
      },
    },
  } as Prisma.InputJsonValue;
};

/**
 * Course numbers typed into the search box ("36-613", "36613"), standardized. The text index
 * splits "36-613" into "36" and "613", which also match hundreds of other courses, so the search
 * ranks these exact matches first.
 */
export const courseIDsInKeywords = (keywords: string): string[] => [
  ...new Set([...keywords.matchAll(/(?<!\d)(\d{2})-?(\d{3})(?!\d)/g)].map(([, dept, num]) => `${dept}-${num}`)),
];
