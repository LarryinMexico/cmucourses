import { summarizeRatings } from "./ratings";

const rating = (
  stars: number,
  extra: {
    workload?: number | null;
    gradingFairness?: number | null;
    transparency?: number | null;
  } = {}
) => ({ stars, ...extra });

describe("summarizeRatings", () => {
  it("averages stars over every rating", () => {
    const summary = summarizeRatings([rating(5), rating(4), rating(3)]);
    expect(summary.stars).toEqual({ average: 4, count: 3 });
  });

  it("averages each optional answer over only the ratings that gave it", () => {
    const summary = summarizeRatings([
      rating(5, { workload: 5, gradingFairness: 4 }),
      rating(3, { workload: 3, transparency: 2 }),
      rating(4),
    ]);
    expect(summary.workload).toEqual({ average: 4, count: 2 });
    expect(summary.gradingFairness).toEqual({ average: 4, count: 1 });
    expect(summary.transparency).toEqual({ average: 2, count: 1 });
  });

  it("has no average, not a zero, for an answer nobody gave", () => {
    const summary = summarizeRatings([rating(5), rating(4)]);
    expect(summary.workload).toEqual({ average: null, count: 0 });
  });

  it("treats a missing field from an older backend the same as null", () => {
    const summary = summarizeRatings([
      { stars: 5, workload: undefined },
      rating(4, { workload: null }),
    ]);
    expect(summary.workload).toEqual({ average: null, count: 0 });
  });

  it("copes with no ratings at all", () => {
    const summary = summarizeRatings([]);
    expect(summary.stars).toEqual({ average: null, count: 0 });
    expect(summary.transparency).toEqual({ average: null, count: 0 });
  });
});
