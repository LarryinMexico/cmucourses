import { planApply } from "./planApply";

describe("planApply", () => {
  it("adds picks outside the base and removes earlier adds not picked again", () => {
    expect(
      planApply(
        ["15-213"],
        ["21-127", "10-301"],
        ["15-213", "10-301", "36-200"]
      )
    ).toEqual({ addCourses: ["10-301", "36-200"], removeCourses: ["21-127"] });
  });

  it("nothing to remove on the first apply", () => {
    expect(planApply(["15-213"], [], ["15-213", "21-127"])).toEqual({
      addCourses: ["21-127"],
      removeCourses: [],
    });
  });
});
