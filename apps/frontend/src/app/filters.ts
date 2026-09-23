import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { Session } from "./types";
import type { Modality, SavedFilters } from "@cmucourses/profile";
import { standardizeIdsInString } from "./utils";

/**
 * Time-of-day buckets, matched server-side against a section's start time. "tba" is the
 * roughly half of the catalog that has no stated meeting time; it is only ever included
 * when explicitly selected.
 */
export const CLASS_TIMES = ["morning", "afternoon", "evening", "tba"] as const;

export type ClassTime = (typeof CLASS_TIMES)[number];

export interface FiltersState {
  search: string;
  departments: {
    active: boolean;
    names: string[];
    query: string;
  };
  units: {
    active: boolean;
    min: number;
    max: number;
  };
  semesters: {
    active: boolean;
    sessions: Session[];
  };
  levels: {
    active: boolean;
    selected: boolean[]; // selected[i] <=> show i00 level
  };
  classTimes: {
    active: boolean;
    selected: ClassTime[];
  };
  meetingDays: {
    active: boolean;
    selected: number[];
  };
  timeRange: {
    active: boolean;
    begin: number;
    end: number;
  };
  modalities: {
    active: boolean;
    selected: Modality[];
  };
  fitAvailability: boolean;
  page: number;
  exactResultsCourses: string[];
}

export const initialFiltersState: FiltersState = {
  search: "",
  departments: {
    active: false,
    names: [],
    query: "",
  },
  units: {
    active: false,
    min: 0,
    max: 24,
  },
  semesters: {
    active: false,
    sessions: [],
  },
  levels: {
    active: false,
    selected: [
      false, // 000
      false, // 100
      false, // 200
      false, // 300
      false, // 400
      false, // 500
      false, // 600
      false, // 700
      false, // 800
      false, // 900
    ],
  },
  classTimes: {
    active: false,
    selected: [],
  },
  meetingDays: { active: false, selected: [] },
  timeRange: { active: false, begin: 8 * 60, end: 18 * 60 },
  modalities: { active: false, selected: [] },
  fitAvailability: false,
  page: 1,
  exactResultsCourses: [],
};

export const filtersSlice = createSlice({
  name: "filters",
  initialState: initialFiltersState,
  reducers: {
    updateSearch: (state, action: PayloadAction<string>) => {
      state.search = standardizeIdsInString(action.payload);
    },
    updateDepartmentsActive: (state, action: PayloadAction<boolean>) => {
      state.departments.active = action.payload;
    },
    deleteDepartment: (state, action: PayloadAction<string>) => {
      state.departments.names = state.departments.names.filter(
        (name) => name !== action.payload
      );
    },
    updateDepartments: (state, action: PayloadAction<string[]>) => {
      state.departments.names = action.payload;
    },
    updateDepartmentsQuery: (state, action: PayloadAction<string>) => {
      state.departments.query = action.payload;
    },
    updateSemestersActive: (state, action: PayloadAction<boolean>) => {
      state.semesters.active = action.payload;
    },
    deleteSemester: (state, action: PayloadAction<Session>) => {
      state.semesters.sessions = state.semesters.sessions.filter(
        (session) =>
          !(
            session.year === action.payload.year &&
            session.semester === action.payload.semester &&
            (session.session ?? null) === (action.payload.session ?? null)
          )
      );
      if (state.semesters.sessions.length === 0) state.semesters.active = false;
    },
    updateSemesters: (state, action: PayloadAction<Session[]>) => {
      state.semesters.sessions = action.payload;
      if (action.payload.length === 0) state.semesters.active = false;
    },
    updateUnitsActive: (state, action: PayloadAction<boolean>) => {
      state.units.active = action.payload;
    },
    updateUnitsRange: (state, action: PayloadAction<[number, number]>) => {
      state.units.min = action.payload[0];
      state.units.max = action.payload[1];
    },
    updateLevelsActive: (state, action: PayloadAction<boolean>) => {
      state.levels.active = action.payload;
    },
    updateLevelsSelection: (state, action: PayloadAction<boolean[]>) => {
      state.levels.selected = action.payload;
      if (!action.payload.some(Boolean)) state.levels.active = false;
    },
    deleteLevel: (state, action: PayloadAction<number[]>) => {
      for (const index of action.payload) {
        state.levels.selected[index] = false;
      }
      if (!state.levels.selected.some(Boolean)) state.levels.active = false;
    },
    updateClassTimesActive: (state, action: PayloadAction<boolean>) => {
      state.classTimes.active = action.payload;
    },
    updateClassTimes: (state, action: PayloadAction<ClassTime[]>) => {
      state.classTimes.selected = action.payload;
      if (action.payload.length === 0) state.classTimes.active = false;
    },
    deleteClassTime: (state, action: PayloadAction<ClassTime>) => {
      state.classTimes.selected = state.classTimes.selected.filter(
        (classTime) => classTime !== action.payload
      );
      if (state.classTimes.selected.length === 0) state.classTimes.active = false;
    },
    updateMeetingDays: (state, action: PayloadAction<number[]>) => {
      state.meetingDays = {
        active: action.payload.length > 0,
        selected: action.payload,
      };
    },
    updateMeetingDaysActive: (state, action: PayloadAction<boolean>) => {
      state.meetingDays.active = action.payload;
    },
    updateTimeRange: (state, action: PayloadAction<[number, number]>) => {
      state.timeRange = {
        active: true,
        begin: action.payload[0],
        end: action.payload[1],
      };
    },
    updateTimeRangeActive: (state, action: PayloadAction<boolean>) => {
      state.timeRange.active = action.payload;
    },
    updateModalities: (state, action: PayloadAction<Modality[]>) => {
      // Kept for persisted Redux state; modality filter UI was removed (catalog has no reliable field).
      state.modalities = { active: action.payload.length > 0, selected: action.payload };
    },
    updateModalitiesActive: (state, action: PayloadAction<boolean>) => {
      state.modalities.active = action.payload;
    },
    updateFitAvailability: (state, action: PayloadAction<boolean>) => {
      state.fitAvailability = action.payload;
    },
    resetFilters: (state) => {
      state.departments = initialFiltersState.departments;
      state.levels = initialFiltersState.levels;
      state.units = initialFiltersState.units;
      state.semesters = initialFiltersState.semesters;
      state.classTimes = initialFiltersState.classTimes;
      state.meetingDays = initialFiltersState.meetingDays;
      state.timeRange = initialFiltersState.timeRange;
      state.modalities = initialFiltersState.modalities;
      state.fitAvailability = initialFiltersState.fitAvailability;
    },
    /**
     * Replaces every saved-able filter with a saved default, switching on the groups it has
     * something for. The search text, the typeahead and the exact-match list stay as they are.
     */
    applySavedFilters: (state, action: PayloadAction<SavedFilters>) => {
      const saved = action.payload;
      state.departments = {
        active: saved.departments.length > 0,
        names: [...saved.departments],
        query: "",
      };
      state.units =
        saved.unitsMin !== null && saved.unitsMax !== null
          ? { active: true, min: saved.unitsMin, max: saved.unitsMax }
          : { ...initialFiltersState.units };
      state.semesters = {
        active: saved.sessions.length > 0,
        sessions: saved.sessions.map(({ year, semester, session }) =>
          session ? { year, semester, session } : { year, semester }
        ),
      };
      state.levels = {
        active: saved.levels.length > 0,
        selected: initialFiltersState.levels.selected.map((_, level) =>
          saved.levels.includes(level)
        ),
      };
      state.classTimes = {
        active: saved.classTimes.length > 0,
        selected: [...saved.classTimes],
      };
      state.meetingDays = {
        active: saved.meetingDays.length > 0,
        selected: [...saved.meetingDays],
      };
      state.timeRange =
        saved.timeBegin !== null && saved.timeEnd !== null
          ? { active: true, begin: saved.timeBegin, end: saved.timeEnd }
          : { ...initialFiltersState.timeRange };
      state.fitAvailability = saved.fitAvailability;
      state.page = 1;
    },
    setPage: (state, action: PayloadAction<number>) => {
      state.page = action.payload;
    },
    setExactResultsCourses: (state, action: PayloadAction<string[]>) => {
      state.exactResultsCourses = action.payload;
    },
  },
});

export const reducer = filtersSlice.reducer;
