import { createSlice } from "@reduxjs/toolkit";

export interface UIState {
  darkMode: boolean;
  sidebarOpen: boolean;
  schedulesTopbarOpen: boolean;
  /** When on, search lists courses from recommendCourses (profile goals), with client-side pagination. */
  matchGoals: boolean;
}

const initialState: UIState = {
  darkMode: false,
  sidebarOpen: true,
  schedulesTopbarOpen: false,
  matchGoals: false,
};

export const uiSlice = createSlice({
  name: "ui",
  initialState,
  reducers: {
    toggleDarkMode: (state) => {
      state.darkMode = !state.darkMode;
    },
    toggleSidebarOpen: (state) => {
      state.sidebarOpen = !state.sidebarOpen;
    },
    toggleSchedulesTopbarOpen: (state) => {
      state.schedulesTopbarOpen = !state.schedulesTopbarOpen;
    },
    toggleMatchGoals: (state) => {
      state.matchGoals = !state.matchGoals;
    },
  },
});

export const reducer = uiSlice.reducer;
