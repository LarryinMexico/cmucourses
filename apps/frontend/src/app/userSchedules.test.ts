import { userSchedulesSlice, type UserSchedulesState } from "./userSchedules";

const { reducer, actions } = userSchedulesSlice;

const start = (): UserSchedulesState => {
  let state = reducer(undefined, { type: "init" });
  state = reducer(state, actions.addCourseToActiveSchedule("15-213"));
  state = reducer(state, actions.addCourseToActiveSchedule("95-703"));
  state = reducer(
    state,
    actions.updateActiveScheduleCourseSession({
      courseID: "95-703",
      sessionType: "Section",
      session: "D",
    })
  );
  return state;
};
const active = (state: UserSchedulesState) => state.saved[state.active!]!;

describe("applyGeneratedSchedule", () => {
  it("sets the new picks, keeps the others, adds pool courses and records which option", () => {
    const state = reducer(
      start(),
      actions.applyGeneratedSchedule({
        courseSessions: {
          "15-213": { Lecture: "Lec 1", Section: "A", Color: "keep" },
        },
        addCourses: ["21-127"],
        generated: { option: 2, score: 68, reasons: ["x"] },
      })
    );
    const schedule = active(state);
    expect(schedule.courses).toEqual(["15-213", "95-703", "21-127"]);
    expect(schedule.courseSessions["15-213"]).toMatchObject({
      Lecture: "Lec 1",
      Section: "A",
    });
    expect(schedule.courseSessions["95-703"]).toMatchObject({ Section: "D" });
    expect(schedule.courseSessions["21-127"]).toBeDefined();
    expect(schedule.generated).toEqual({
      option: 2,
      score: 68,
      reasons: ["x"],
    });
  });

  it("clears a stale hover so it cannot hide a course", () => {
    let state = reducer(
      start(),
      actions.setHoverSession({ courseID: "15-213", Lecture: "Lec 9" })
    );
    state = reducer(
      state,
      actions.applyGeneratedSchedule({
        courseSessions: {},
        addCourses: [],
        generated: { option: 1, score: 1, reasons: [] },
      })
    );
    expect(active(state).hoverSession).toBeUndefined();
  });

  it("a later change by hand drops the 'from Generate' mark", () => {
    const applied = reducer(
      start(),
      actions.applyGeneratedSchedule({
        courseSessions: {},
        addCourses: [],
        generated: { option: 1, score: 50, reasons: [] },
      })
    );
    for (const change of [
      actions.updateActiveScheduleCourseSession({
        courseID: "15-213",
        sessionType: "Lecture",
        session: "Lec 2",
      }),
      actions.addCourseToActiveSchedule("33-104"),
      actions.removeCourseFromActiveSchedule("95-703"),
    ]) {
      expect(active(reducer(applied, change)).generated).toBeUndefined();
    }
  });
});

describe("loadSavedSchedule", () => {
  const saved = {
    id: "64b7f0c2a1d3e4f5a6b7c8d9",
    name: "Fall plan",
    semester: "summer" as const,
    year: "2026",
    session: "summer one" as const,
    courses: [
      { courseID: "15-213", lecture: "Lec 1", section: "A" },
      { courseID: "21-127", lecture: null, section: null },
    ],
    createdAt: "",
    updatedAt: "",
  };

  it("opens it as a new active schedule with its semester, picks and colours", () => {
    const before = start();
    const state = reducer(before, actions.loadSavedSchedule(saved));
    const schedule = active(state);
    expect(state.active).not.toBe(before.active);
    expect(schedule.name).toBe("Fall plan");
    expect(schedule.savedId).toBe(saved.id);
    expect(schedule.session).toEqual({
      year: "2026",
      semester: "summer",
      session: "summer one",
    });
    expect(schedule.courses).toEqual(["15-213", "21-127"]);
    expect(schedule.courseSessions["15-213"]).toMatchObject({
      Lecture: "Lec 1",
      Section: "A",
    });
    expect(schedule.courseSessions["21-127"]).toMatchObject({
      Lecture: "",
      Section: "",
    });
    expect(schedule.courseSessions["15-213"]!.Color).not.toBe(
      schedule.courseSessions["21-127"]!.Color
    );
  });

  it("opening the same saved schedule again switches to the open copy", () => {
    const once = reducer(start(), actions.loadSavedSchedule(saved));
    const twice = reducer(once, actions.loadSavedSchedule(saved));
    expect(Object.keys(twice.saved)).toHaveLength(
      Object.keys(once.saved).length
    );
    expect(twice.active).toBe(once.active);
  });
});

describe("resetForUser", () => {
  it("keeps the builder for the same account", () => {
    const mine = reducer(start(), actions.resetForUser("user_a"));
    expect(reducer(mine, actions.resetForUser("user_a"))).toEqual(mine);
  });

  it("starts empty when a different account signs in", () => {
    const mine = reducer(start(), actions.resetForUser("user_a"));
    const theirs = reducer(mine, actions.resetForUser("user_b"));
    expect(theirs.saved).toEqual({});
    expect(theirs.active).toBeNull();
    expect(theirs.ownerUserId).toBe("user_b");
  });

  it("a builder from before accounts were tracked is claimed by the first account", () => {
    const legacy = start();
    const claimed = reducer(legacy, actions.resetForUser("user_a"));
    expect(claimed.saved).toEqual(legacy.saved);
  });
});
