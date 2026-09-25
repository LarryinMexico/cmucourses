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
