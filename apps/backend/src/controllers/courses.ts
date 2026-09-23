import {
  BoolLiteral,
  fromBoolLiteral,
  parseOptionalInt,
  PrismaReturn,
  SingleOrArray,
  singleToArray,
  standardizeID,
  parsePrereqString,
} from "~/util";
import { RequestHandler } from "express";
import db, { Prisma } from "@cmucourses/db";

const projection = { _id: false, __v: false };
const MAX_LIMIT = 10;

/**
 * Meeting times are stored as zero-padded 12-hour strings ("08:00AM"), which Mongo cannot
 * order, so the time-of-day buckets are matched by pattern on `begin` rather than compared
 * numerically. Roughly half of all catalog entries have a literal "TBA" instead of a time;
 * those only match the "tba" bucket, never a real one.
 */
const CLASS_TIME_PATTERNS = {
  morning: "^(0[6-9]|1[01]):\\d\\dAM$",
  afternoon: "^(12|0[1-4]):\\d\\dPM$",
  evening: "^(0[5-9]|1[01]):\\d\\dPM$",
  tba: "^TBA$",
} as const;

type ClassTime = keyof typeof CLASS_TIME_PATTERNS;

const isClassTime = (value: string): value is ClassTime => value in CLASS_TIME_PATTERNS;

/** Aggregation expression: catalog "HH:MMAM"/"HH:MMPM" -> minutes after midnight, else null. */
const catalogTimeToMinutes = (timeExpr: string): Prisma.InputJsonValue =>
  ({
    $let: {
      vars: {
        t: timeExpr,
        hour: { $toInt: { $substrBytes: [timeExpr, 0, 2] } },
        minute: { $toInt: { $substrBytes: [timeExpr, 3, 2] } },
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

export interface GetCourseById {
  params: {
    courseID: string;
  };
  query: {
    schedules?: BoolLiteral;
  };
  resBody: PrismaReturn<typeof db.courses.findFirstOrThrow>;
  reqBody: unknown;
}

export const getCourseByID: RequestHandler<
  GetCourseById["params"],
  GetCourseById["resBody"],
  GetCourseById["reqBody"],
  GetCourseById["query"]
> = async (req, res, next) => {
  const id = standardizeID(req.params.courseID);
  try {
    const course = await db.courses.findFirstOrThrow({
      where: {
        courseID: id,
      },
      include: {
        schedules: fromBoolLiteral(req.query.schedules),
      },
    });

    res.json(course);
  } catch (e) {
    next(e);
  }
};

export interface GetCourses {
  params: unknown;
  resBody: PrismaReturn<typeof db.courses.findMany>;
  reqBody: unknown;
  query: {
    courseID: SingleOrArray<string>;
    schedules: BoolLiteral;
  };
}

export const getCourses: RequestHandler<
  GetCourses["params"],
  GetCourses["resBody"],
  GetCourses["reqBody"],
  GetCourses["query"]
> = async (req, res, next) => {
  const courseIDs = singleToArray(req.query.courseID).map(standardizeID);

  try {
    const courses = await db.courses.findMany({
      where: {
        courseID: { in: courseIDs },
      },
      include: {
        schedules: fromBoolLiteral(req.query.schedules),
      },
    });
    res.json(courses);
  } catch (e) {
    next(e);
  }
};

export interface GetFilteredCourses {
  params: unknown;
  resBody: unknown;
  reqBody: unknown;
  query: {
    page?: string;
    pageSize?: string;
    department?: SingleOrArray<string>;
    keywords?: string;
    unitsMin?: string;
    unitsMax?: string;
    schedules?: BoolLiteral;
    levels?: string;
    session?: SingleOrArray<string>;
    /** Time-of-day buckets: "morning" | "afternoon" | "evening" | "tba". */
    classTimes?: SingleOrArray<string>;
    /** Weekday numbers 0=Sun..6=Sat; any selected day on a meeting matches. */
    meetingDays?: SingleOrArray<string>;
    /** Exact window in minutes after midnight; the whole meeting must fit inside. */
    timeBegin?: string;
    timeEnd?: string;
    fces?: BoolLiteral;
  };
}

export interface GetFilteredCoursesResult {
  metadata: { totalDocs: number }[];
  data: unknown[];
}

export const getFilteredCourses: RequestHandler<
  GetFilteredCourses["params"],
  GetFilteredCourses["resBody"],
  GetFilteredCourses["reqBody"],
  GetFilteredCourses["query"]
> = async (req, res, next) => {
  // raw query, because prisma doesn't support full-text search for mongodb yet

  const pipeline: Prisma.InputJsonValue[] = [];

  const matchStage: Record<string, unknown> = {};
  const sortKeys: [string, unknown][] = [];
  const addedFields: Record<string, unknown> = {};

  if (req.query.keywords !== undefined) {
    matchStage.$text = { $search: req.query.keywords };
    sortKeys.push(["score", { $meta: "textScore" }]);
    addedFields.relevance = { $meta: "textScore" };
  }

  if (req.query.department !== undefined) {
    matchStage.department = { $in: singleToArray(req.query.department) };
  }

  if (req.query.levels !== undefined && req.query.levels.length > 0) {
    const levelRange = req.query.levels;
    matchStage.courseID = { $regex: `\\d\\d-[${levelRange}]\\d\\d` };
  }

  pipeline.push({ $match: matchStage } as Prisma.InputJsonValue);

  const unitsMin = req.query.unitsMin === undefined ? undefined : parseInt(req.query.unitsMin);
  const unitsMax = req.query.unitsMax === undefined ? undefined : parseInt(req.query.unitsMax);

  if (unitsMin !== undefined || unitsMax !== undefined) {
    pipeline.push({
      $addFields: {
        unitsDecimal: {
          $convert: {
            input: "$units",
            to: "decimal",
            onError: null,
            onNull: null,
          },
        },
      },
    });

    pipeline.push({
      $match: {
        unitsDecimal: {
          $gte: unitsMin,
          $lte: unitsMax,
        },
      },
    });
  }

  const sessions =
    req.query.session === undefined
      ? []
      : singleToArray(req.query.session).flatMap((serializedSession) => {
          try {
            const session = JSON.parse(serializedSession);
            return [{ year: parseInt(session.year), semester: session.semester }];
          } catch {
            // SyntaxError
            return [];
          }
        });

  const classTimes =
    req.query.classTimes === undefined
      ? []
      : singleToArray(req.query.classTimes).filter(isClassTime);

  const meetingDays =
    req.query.meetingDays === undefined
      ? []
      : singleToArray(req.query.meetingDays)
          .map((day) => parseInt(day, 10))
          .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6);

  const timeBegin =
    req.query.timeBegin === undefined ? undefined : parseInt(req.query.timeBegin, 10);
  const timeEnd =
    req.query.timeEnd === undefined ? undefined : parseInt(req.query.timeEnd, 10);
  const hasTimeWindow =
    timeBegin !== undefined &&
    timeEnd !== undefined &&
    !Number.isNaN(timeBegin) &&
    !Number.isNaN(timeEnd);

  const needsScheduleLookup =
    fromBoolLiteral(req.query.schedules) ||
    sessions.length > 0 ||
    classTimes.length > 0 ||
    meetingDays.length > 0 ||
    hasTimeWindow;

  // Session / class-time / meeting-days / time-window all read joined schedules, so the
  // lookup runs whenever any of them is active — not only when the caller asked for
  // schedules to be returned. Without it they would silently match nothing.
  if (needsScheduleLookup)
    pipeline.push({
      $lookup: {
        from: "schedules",
        localField: "courseID",
        foreignField: "courseID",
        as: "schedules",
      },
    });

  // All schedule predicates must hold for the *same* schedule document. Applied separately,
  // a course with a morning lecture in 2020 and an evening one this fall would wrongly
  // satisfy "morning" + "fall 2026" together.
  const scheduleClauses: Record<string, unknown>[] = [];

  if (sessions.length > 0) scheduleClauses.push({ $or: sessions });

  if (classTimes.length > 0) {
    scheduleClauses.push({
      $or: classTimes.flatMap((classTime) => [
        { "lectures.times.begin": { $regex: CLASS_TIME_PATTERNS[classTime] } },
        { "sections.times.begin": { $regex: CLASS_TIME_PATTERNS[classTime] } },
      ]),
    });
  }

  // Any selected weekday on a meeting matches (Mon+Wed survives a Monday-only filter).
  if (meetingDays.length > 0) {
    scheduleClauses.push({
      $or: [
        { "lectures.times.days": { $in: meetingDays } },
        { "sections.times.days": { $in: meetingDays } },
      ],
    });
  }

  // Guarding on a non-empty list also keeps an all-malformed `session` query from emitting
  // `$or: []`, which Mongo rejects outright.
  if (scheduleClauses.length > 0) {
    pipeline.push({
      $match: {
        schedules: {
          $elemMatch: { $and: scheduleClauses },
        },
      },
    } as Prisma.InputJsonValue);
  }

  // Exact time window needs minute math on "HH:MMAM" strings, so it goes through $expr.
  // Re-apply session / classTimes / meetingDays here so the window cannot be satisfied by a
  // different historical offering than the $elemMatch above.
  if (hasTimeWindow) {
    const meetingsOf = (schedVar: string) => ({
      $concatArrays: [
        { $ifNull: [`$$${schedVar}.lectures`, []] },
        { $ifNull: [`$$${schedVar}.sections`, []] },
      ],
    });

    const timeFits = (timeVar: string) => ({
      $let: {
        vars: {
          beginM: catalogTimeToMinutes(`$$${timeVar}.begin`),
          endM: catalogTimeToMinutes(`$$${timeVar}.end`),
        },
        in: {
          $and: [
            { $ne: ["$$beginM", null] },
            { $ne: ["$$endM", null] },
            { $gte: ["$$beginM", timeBegin] },
            { $lte: ["$$endM", timeEnd] },
          ],
        },
      },
    });

    const anyTime = (pred: (timeVar: string) => unknown) => ({
      $anyElementTrue: {
        $map: {
          input: meetingsOf("sched"),
          as: "mtg",
          in: {
            $anyElementTrue: {
              $map: {
                input: { $ifNull: ["$$mtg.times", []] },
                as: "t",
                in: pred("t"),
              },
            },
          },
        },
      },
    });

    const scheduleConds: unknown[] = [anyTime(timeFits)];

    if (sessions.length > 0) {
      scheduleConds.push({
        $or: sessions.map((session) => ({
          $and: [
            { $eq: ["$$sched.year", session.year] },
            { $eq: ["$$sched.semester", session.semester] },
          ],
        })),
      });
    }

    if (classTimes.length > 0) {
      scheduleConds.push({
        $or: classTimes.map((classTime) =>
          anyTime((timeVar) => ({
            $regexMatch: {
              input: `$$${timeVar}.begin`,
              regex: CLASS_TIME_PATTERNS[classTime],
            },
          }))
        ),
      });
    }

    if (meetingDays.length > 0) {
      scheduleConds.push(
        anyTime((timeVar) => ({
          $gt: [
            {
              $size: {
                $setIntersection: [
                  { $ifNull: [`$$${timeVar}.days`, []] },
                  meetingDays,
                ],
              },
            },
            0,
          ],
        }))
      );
    }

    pipeline.push({
      $match: {
        $expr: {
          $gt: [
            {
              $size: {
                $filter: {
                  input: "$schedules",
                  as: "sched",
                  cond: { $and: scheduleConds },
                },
              },
            },
            0,
          ],
        },
      },
    } as Prisma.InputJsonValue);
  }

  pipeline.push({ $addFields: addedFields as Prisma.InputJsonValue });
  pipeline.push({ $project: projection as Prisma.InputJsonValue });

  if (sortKeys.length > 0) {
    const sortOptions: Record<string, unknown> = {};
    for (const [key, option] of sortKeys) {
      sortOptions[key] = option;
    }

    pipeline.push({ $sort: sortOptions as Prisma.InputJsonValue });
  }

  const page = parseOptionalInt(req.query.page, 1);
  const pageSize = Math.min(parseOptionalInt(req.query.pageSize, MAX_LIMIT), MAX_LIMIT);

  pipeline.push({
    $facet: {
      metadata: [{ $count: "totalDocs" }],
      data: [{ $skip: (page - 1) * pageSize }, { $limit: pageSize }],
    },
  });

  try {
    const result = (await db.courses.aggregateRaw({ pipeline }))[0] as unknown as GetFilteredCoursesResult;
    const totalDocs = result.metadata[0]?.totalDocs ?? 0;

    res.json({
      totalDocs,
      totalPages: Math.ceil(totalDocs / pageSize),
      page,
      docs: result.data,
    });
  } catch (e) {
    next(e);
  }
};

// TODO: use a better caching system

const allCoursesEntry = {
  allCourses: [] as GetAllCourses["resBody"],
  lastCached: new Date(1970),
};

const getAllCoursesDbQuery = {
  select: {
    courseID: true,
    name: true,
    id: true,
  },
};

export interface GetAllCourses {
  params: unknown;
  resBody: PrismaReturn<typeof db.courses.findMany<typeof getAllCoursesDbQuery>>;
  reqBody: unknown;
  query: unknown;
}

export const getAllCourses: RequestHandler<
  GetAllCourses["params"],
  GetAllCourses["resBody"],
  GetAllCourses["reqBody"],
  GetAllCourses["query"]
> = async (req, res, next) => {
  if (new Date().valueOf() - allCoursesEntry.lastCached.valueOf() > 1000 * 60 * 60 * 24) {
    try {
      const courses = await db.courses.findMany(getAllCoursesDbQuery);

      allCoursesEntry.lastCached = new Date();
      allCoursesEntry.allCourses = courses;

      res.json(courses);
    } catch (e) {
      next(e);
    }
  } else {
    res.json(allCoursesEntry.allCourses);
  }
};

export const getRequisites: RequestHandler = async (req, res, next) => {
  try {
    if (!req.params.courseID) {
      return res.status(400).json({ error: "courseID parameter is required" });
    }

    const courseID = standardizeID(req.params.courseID);

    const course = await db.courses.findUnique({
      where: { courseID },
      select: {
        courseID: true,
        prereqs: true,
        prereqString: true,
      },
    });

    if (!course) {
      return res.status(400).json({ error: "Course not found" });
    }

    const parsedPrereqs = parsePrereqString(course.prereqString);

    const postreqs = await db.courses.findMany({
      where: {
        prereqs: {
          has: course.courseID,
        },
      },
      select: {
        courseID: true,
      },
    });

    const postreqIDs = postreqs.map((postreq) => postreq.courseID);

    const courseRequisites = {
      prereqs: course.prereqs,
      prereqRelations: parsedPrereqs,
      postreqs: postreqIDs,
    };

    res.json(courseRequisites);
  } catch (e) {
    next(e);
  }
};
