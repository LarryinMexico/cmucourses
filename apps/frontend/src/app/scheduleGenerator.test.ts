import { emptyProfile } from "@cmucourses/profile";
import { buildGeneratorInput } from "./scheduleGenerator";

const profile = {
  ...emptyProfile(),
  workload: { unitsMin: 36, unitsMax: 48, hoursPerWeek: 40 },
};

describe("buildGeneratorInput refinement", () => {
  it("passes locks, excludes and the option count through to the generator", () => {
    const locks = [{ courseID: "15-213", lecture: "Lec 1", section: "A" }];
    const excluded = [{ courseID: "15-122", lecture: "Lec 2", section: null }];
    const input = buildGeneratorInput(["15-213"], [], "fall 2026", profile, {
      locks,
      excluded,
      maxCandidates: 2,
    });
    expect(input.locks).toEqual(locks);
    expect(input.excluded).toEqual(excluded);
    expect(input.maxCandidates).toBe(2);
  });

  it("uses the profile's workload unless a units range overrides it for this run", () => {
    expect(
      buildGeneratorInput(["15-213"], [], "fall 2026", profile).workload
    ).toEqual(profile.workload);

    const overridden = buildGeneratorInput(
      ["15-213"],
      [],
      "fall 2026",
      profile,
      { unitsRange: { min: 9, max: 30 } }
    );
    expect(overridden.workload).toEqual({
      unitsMin: 9,
      unitsMax: 30,
      hoursPerWeek: 40,
    });
    // the profile object itself is untouched
    expect(profile.workload).toEqual({
      unitsMin: 36,
      unitsMax: 48,
      hoursPerWeek: 40,
    });
  });
});
