export interface Average {
  /** Null when nobody answered: "no data" is different from an average of zero. */
  average: number | null;
  count: number;
}

interface RatingAnswers {
  stars: number;
  workload?: number | null;
  gradingFairness?: number | null;
  transparency?: number | null;
}

const averageOf = (values: (number | null | undefined)[]): Average => {
  const given = values.filter((v): v is number => typeof v === "number");
  return {
    average:
      given.length === 0
        ? null
        : given.reduce((sum, v) => sum + v, 0) / given.length,
    count: given.length,
  };
};

/**
 * Stars come with every rating; the other three are optional, so each is averaged over only the
 * ratings that answered it. A missing field (a backend that predates them) reads as not answered.
 */
export const summarizeRatings = (ratings: RatingAnswers[]) => ({
  stars: averageOf(ratings.map((r) => r.stars)),
  workload: averageOf(ratings.map((r) => r.workload)),
  gradingFairness: averageOf(ratings.map((r) => r.gradingFairness)),
  transparency: averageOf(ratings.map((r) => r.transparency)),
});
