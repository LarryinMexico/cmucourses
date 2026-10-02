import { ElemType, escapeRegExp, exclude, PrismaReturn, singleToArray, standardizeID } from "~/util";
import { RequestHandler } from "express";
import db from "@cmucourses/db";

type schedule = ElemType<PrismaReturn<typeof db.schedules.findMany>>;

export interface GetSchedules {
  params: unknown;
  resBody: Omit<schedule, "id" | "v">[];
  reqBody: unknown;
  query: { courseID: string | string[] } | { instructor: string | string[] };
}

export const getSchedules: RequestHandler<
  GetSchedules["params"],
  GetSchedules["resBody"],
  GetSchedules["reqBody"],
  GetSchedules["query"]
> = async (req, res, next) => {
  if ("instructor" in req.query) {
    const instructors = singleToArray(req.query.instructor);
    try {
      // Names differ in case across the catalog ("Steier, David" here, "STEIER, DAVID" in the
      // links and FCEs), and Prisma's `hasSome` is case-sensitive, so match each name exactly
      // but case-insensitively in a raw query.
      const schedules = (await db.schedules.aggregateRaw({
        pipeline: [
          {
            $match: {
              $or: instructors.map((name) => ({
                instructors: { $regex: `^${escapeRegExp(name)}$`, $options: "i" },
              })),
            },
          },
          { $project: { _id: 0, __v: 0 } },
        ],
      })) as unknown as Omit<schedule, "id" | "v">[];
      res.json(schedules);
    } catch (e) {
      next(e);
    }
  } else if ("courseID" in req.query) {
    const courseIDs = singleToArray(req.query.courseID).map(standardizeID);
    try {
      const schedules = await db.schedules.findMany({
        where: {
          courseID: { in: courseIDs },
        },
      });
      const projectedResults = schedules.map((courseFce) => exclude(courseFce, "id", "v"));
      res.json(projectedResults);
    } catch (e) {
      next(e);
    }
  }
};
