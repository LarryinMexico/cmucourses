/// <reference types="bun-types" />
import { mock } from "bun:test";
import { fakeDb } from "./fakeDb";
import { fakeClerkClient } from "./fakeClerk";

mock.module("@cmucourses/db", () => ({ default: fakeDb }));

mock.module("@clerk/clerk-sdk-node", () => ({ clerkClient: fakeClerkClient }));
