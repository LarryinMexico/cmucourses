import type { SavedFilters } from "@cmucourses/profile";
import {
  filtersSlice,
  initialFiltersState,
  type FiltersState,
} from "./filters";
import { filtersToSaved } from "./savedFilters";

const reducer = filtersSlice.reducer;
const apply = (saved: SavedFilters, from: FiltersState = initialFiltersState) =>
  reducer(from, filtersSlice.actions.applySavedFilters(saved));

const nothing: SavedFilters = {
  departments: [],
  unitsMin: null,
  unitsMax: null,
  sessions: [],
  levels: [],
  classTimes: [],
  meetingDays: [],
  timeBegin: null,
  timeEnd: null,
  fitAvailability: false,
  matchGoals: false,
};

const chosen: FiltersState = {
  ...initialFiltersState,
  departments: { active: true, names: ["Computer Science"], query: "typed" },
  units: { active: true, min: 9, max: 12 },
  semesters: {
    active: true,
    sessions: [
      { year: "2026", semester: "fall" },
      { year: "2026", semester: "summer", session: "summer one" },
    ],
  },
  levels: {
    active: true,
    selected: initialFiltersState.levels.selected.map(
      (_, i) => i === 1 || i === 6
    ),
  },
  classTimes: { active: true, selected: ["morning", "tba"] },
  meetingDays: { active: true, selected: [1, 3] },
  timeRange: { active: true, begin: 540, end: 960 },
  fitAvailability: true,
  search: "systems",
  page: 4,
  exactResultsCourses: ["15-213"],
};

describe("filtersToSaved", () => {
  it("saves nothing when nothing is chosen", () => {
    expect(filtersToSaved(initialFiltersState, false)).toEqual(nothing);
  });

  it("saves what is chosen", () => {
    expect(filtersToSaved(chosen, true)).toEqual({
      departments: ["Computer Science"],
      unitsMin: 9,
      unitsMax: 12,
      sessions: [
        { year: "2026", semester: "fall", session: null },
        { year: "2026", semester: "summer", session: "summer one" },
      ],
      levels: [1, 6],
      classTimes: ["morning", "tba"],
      meetingDays: [1, 3],
      timeBegin: 540,
      timeEnd: 960,
      fitAvailability: true,
      matchGoals: true,
    });
  });

  it("saves what the search would use: a group that is switched off counts as empty", () => {
    const off: FiltersState = {
      ...chosen,
      departments: { ...chosen.departments, active: false },
      units: { ...chosen.units, active: false },
      semesters: { ...chosen.semesters, active: false },
      levels: { ...chosen.levels, active: false },
      classTimes: { ...chosen.classTimes, active: false },
      meetingDays: { ...chosen.meetingDays, active: false },
      timeRange: { ...chosen.timeRange, active: false },
    };
    expect(filtersToSaved(off, false)).toEqual({
      ...nothing,
      fitAvailability: true,
    });
  });

  it("does not save the default 0-24 units range as a choice", () => {
    const state = { ...chosen, units: { active: true, min: 0, max: 24 } };
    expect(filtersToSaved(state, false)).toMatchObject({
      unitsMin: null,
      unitsMax: null,
    });
  });

  it("leaves out a Qatar summer: the filter never offers it and a saved set cannot hold it", () => {
    const state: FiltersState = {
      ...chosen,
      semesters: {
        active: true,
        sessions: [
          { year: "2026", semester: "summer", session: "qatar summer" },
          { year: "2026", semester: "fall" },
        ],
      },
    };
    expect(filtersToSaved(state, false).sessions).toEqual([
      { year: "2026", semester: "fall", session: null },
    ]);
  });

  it("never saves the search text, the page or the exact-match list", () => {
    const saved = filtersToSaved(chosen, false) as unknown as Record<
      string,
      unknown
    >;
    for (const key of ["search", "page", "exactResultsCourses", "query"])
      expect(key in saved).toBe(false);
  });
});

describe("applySavedFilters", () => {
  it("turns the saved choices back into the filters, switched on", () => {
    const state = apply(filtersToSaved(chosen, false));
    expect(state.departments).toEqual({
      active: true,
      names: ["Computer Science"],
      query: "",
    });
    expect(state.units).toEqual({ active: true, min: 9, max: 12 });
    expect(state.semesters.sessions).toEqual([
      { year: "2026", semester: "fall" },
      { year: "2026", semester: "summer", session: "summer one" },
    ]);
    expect(
      state.levels.selected.map((on, i) => (on ? i : -1)).filter((i) => i >= 0)
    ).toEqual([1, 6]);
    expect(state.classTimes.selected).toEqual(["morning", "tba"]);
    expect(state.meetingDays.selected).toEqual([1, 3]);
    expect(state.timeRange).toEqual({ active: true, begin: 540, end: 960 });
    expect(state.fitAvailability).toBe(true);
    for (const group of [
      "departments",
      "units",
      "semesters",
      "levels",
      "classTimes",
      "meetingDays",
      "timeRange",
    ] as const) {
      expect(state[group].active).toBe(true);
    }
  });

  it("switches a group off, at its defaults, when the saved set has nothing for it", () => {
    const state = apply(nothing, chosen);
    expect(state.departments).toEqual({ active: false, names: [], query: "" });
    expect(state.units).toEqual(initialFiltersState.units);
    expect(state.semesters).toEqual({ active: false, sessions: [] });
    expect(state.levels.active).toBe(false);
    expect(state.levels.selected.some(Boolean)).toBe(false);
    expect(state.timeRange).toEqual(initialFiltersState.timeRange);
    expect(state.fitAvailability).toBe(false);
  });

  it("goes back to page 1 and leaves the search text alone", () => {
    const state = apply(nothing, { ...chosen, search: "systems", page: 4 });
    expect(state.page).toBe(1);
    expect(state.search).toBe("systems");
  });

  it("round-trips: applying what was saved and saving again gives the same set", () => {
    const saved = filtersToSaved(chosen, true);
    expect(filtersToSaved(apply(saved), true)).toEqual(saved);
  });
});
