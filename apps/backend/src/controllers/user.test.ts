/// <reference types="bun-types" />
import { afterEach, beforeEach, describe, expect, setSystemTime, test } from "bun:test";
import { generateKeyPairSync } from "node:crypto";
import jwt from "jsonwebtoken";
import { fakeGetUser } from "../test/fakeClerk";
import { CMU_EMAIL_CACHE_TTL_MS, resetCmuEmailCache, verifyUserToken } from "./user";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const sign = (claims: Record<string, unknown>) => jwt.sign(claims, privateKey, { algorithm: "RS256" });

const ENV_KEYS = ["CLERK_PEM_KEY", "BACKEND_ENV", "REQUIRE_CMU_EMAIL", "AUTH_ENABLED", "CLERK_LOGIN_HOST"];
const savedEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));

beforeEach(() => {
  for (const key of ENV_KEYS) delete process.env[key];
  process.env.CLERK_PEM_KEY = publicKey.export({ type: "spki", format: "pem" }).toString();
  resetCmuEmailCache();
  fakeGetUser.mockReset();
  fakeGetUser.mockImplementation(async () => ({ emailAddresses: [{ emailAddress: "scotty@andrew.cmu.edu" }] }));
});

afterEach(() => {
  setSystemTime();
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

describe("CMU email check cache", () => {
  beforeEach(() => {
    process.env.REQUIRE_CMU_EMAIL = "true";
  });

  test("asks Clerk once per user within the TTL, and again after it", async () => {
    const token = sign({ sub: "user_a" });
    await verifyUserToken(token);
    await verifyUserToken(token);
    expect(fakeGetUser).toHaveBeenCalledTimes(1);

    setSystemTime(new Date(Date.now() + CMU_EMAIL_CACHE_TTL_MS + 1000));
    await verifyUserToken(sign({ sub: "user_a" }));
    expect(fakeGetUser).toHaveBeenCalledTimes(2);
  });

  test("caches per user", async () => {
    await verifyUserToken(sign({ sub: "user_a" }));
    await verifyUserToken(sign({ sub: "user_b" }));
    expect(fakeGetUser).toHaveBeenCalledTimes(2);
  });

  test("a Clerk failure is not cached", async () => {
    fakeGetUser.mockImplementationOnce(async () => {
      throw new Error("Clerk down");
    });
    const token = sign({ sub: "user_a" });
    await expect(verifyUserToken(token)).rejects.toThrow("Clerk down");
    await verifyUserToken(token);
    expect(fakeGetUser).toHaveBeenCalledTimes(2);
  });
});
