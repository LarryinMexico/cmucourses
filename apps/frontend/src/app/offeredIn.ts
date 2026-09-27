import type { Session, SummerSession } from "./types";

// Qatar summer is left out, as everywhere else (see filterSessions in utils).
const SUMMER_SESSIONS: SummerSession[] = [
  "summer one",
  "summer two",
  "summer all",
];

/**
 * The "Offered in" choices, newest first: next spring (schedules are published a semester
 * ahead), then every semester back to Fall 2020, with each summer's sub-sessions after it.
 */
export const offeredInSessions = (thisYear: number): Session[] => {
  const years: string[] = [];
  for (let year = thisYear; year >= 2021; year--) years.push(String(year));
  return [
    { year: String(thisYear + 1), semester: "spring" },
    ...years.flatMap((year): Session[] => [
      { year, semester: "fall" },
      { year, semester: "summer" },
      ...SUMMER_SESSIONS.map(
        (session): Session => ({ year, semester: "summer", session })
      ),
      { year, semester: "spring" },
    ]),
    { year: "2020", semester: "fall" },
  ];
};
