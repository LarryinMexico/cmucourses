import type { InitialOptionsTsJest } from "ts-jest/dist/types";

const config: InitialOptionsTsJest = {
  preset: "ts-jest",
  setupFilesAfterEnv: ["<rootDir>/setupTests.ts"],
  transform: {
    ".+\\.(css|styl|less|sass|scss)$": "jest-css-modules-transform",
  },
  testEnvironment: "jsdom",
  // Third-party stylesheets (e.g. react-tooltip) live in node_modules; let the css transform see them.
  transformIgnorePatterns: ["/node_modules/(?!.*\\.css$)"],
  moduleNameMapper: {
    "^~/(.*)$": "<rootDir>/src/$1",
  },
  globals: {
    "ts-jest": {
      tsconfig: "tsconfig.test.json",
    },
  },
};

export default config;
