/// <reference types="bun-types" />
import { mock } from "bun:test";
import { fakeDb } from "./fakeDb";

mock.module("@cmucourses/db", () => ({ default: fakeDb }));
