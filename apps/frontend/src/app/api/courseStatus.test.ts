import { summarizeCourseQueries } from "./courseStatus";

const q = (
  over: Partial<{ data: unknown; isPending: boolean; isError: boolean }>
) => ({
  data: undefined,
  isPending: false,
  isError: false,
  ...over,
});

describe("summarizeCourseQueries", () => {
  it("collects loaded courses and says when all are in", () => {
    const summary = summarizeCourseQueries(
      ["15-213", "15-122"],
      [q({ data: { courseID: "15-213" } }), q({ data: { courseID: "15-122" } })]
    );
    expect(summary.courses.map((c) => c.courseID)).toEqual([
      "15-213",
      "15-122",
    ]);
    expect(summary).toMatchObject({
      isPending: false,
      notFound: [],
      failed: [],
    });
  });

  it("is pending while any query is", () => {
    expect(
      summarizeCourseQueries(
        ["a", "b"],
        [q({ data: { courseID: "a" } }), q({ isPending: true })]
      ).isPending
    ).toBe(true);
  });

  it("a course the catalog does not have loads as null: not found, not loading", () => {
    const summary = summarizeCourseQueries(["95-867"], [q({ data: null })]);
    expect(summary).toMatchObject({
      isPending: false,
      notFound: ["95-867"],
      courses: [],
    });
  });

  it("a failed refetch keeps the course it already had", () => {
    const summary = summarizeCourseQueries(
      ["15-213"],
      [q({ data: { courseID: "15-213" }, isError: true })]
    );
    expect(summary.courses.map((c) => c.courseID)).toEqual(["15-213"]);
    expect(summary.failed).toEqual([]);
  });

  it("a failed query is reported, not treated as loading", () => {
    const summary = summarizeCourseQueries(["15-213"], [q({ isError: true })]);
    expect(summary).toMatchObject({
      isPending: false,
      failed: ["15-213"],
      courses: [],
    });
  });
});
