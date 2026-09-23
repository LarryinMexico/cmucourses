import { filtersSlice } from "./filters";

const reducer = filtersSlice.reducer;
const initial = reducer(undefined, { type: "init" });

describe("deleteSemester", () => {
  it("removes only the sub-session that was clicked, not the rest of the summer", () => {
    const one = {
      year: "2026",
      semester: "summer" as const,
      session: "summer one" as const,
    };
    const two = {
      year: "2026",
      semester: "summer" as const,
      session: "summer two" as const,
    };
    const state = reducer(
      initial,
      filtersSlice.actions.updateSemesters([one, two])
    );

    const after = reducer(state, filtersSlice.actions.deleteSemester(one));
    expect(after.semesters.sessions).toEqual([two]);
  });

  it("still removes a plain semester and switches the filter off when none are left", () => {
    const fall = { year: "2026", semester: "fall" as const };
    let state = reducer(initial, filtersSlice.actions.updateSemesters([fall]));
    state = reducer(state, filtersSlice.actions.updateSemestersActive(true));
    state = reducer(state, filtersSlice.actions.deleteSemester(fall));
    expect(state.semesters.sessions).toEqual([]);
    expect(state.semesters.active).toBe(false);
  });
});
