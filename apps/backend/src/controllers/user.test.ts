/// <reference types="bun-types" />
import { afterEach, beforeEach, describe, expect, setSystemTime, test } from "bun:test";
import { generateKeyPairSync } from "node:crypto";
import jwt from "jsonwebtoken";
import { fakeGetUser } from "../test/fakeClerk";
import { fakeRes } from "../test/http";
import { CMU_EMAIL_CACHE_TTL_MS, isUser, requireUser, resetCmuEmailCache, verifyUserToken } from "./user";

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
    await expect(verifyUserToken(token)).rejects.toMatchObject({ code: "auth_service_error" });
    await verifyUserToken(token);
    expect(fakeGetUser).toHaveBeenCalledTimes(2);
  });
});

const now = () => Math.floor(Date.now() / 1000);

describe("verifyUserToken: refused tokens", () => {
  const cases: [string, unknown, string][] = [
    ["missing", undefined, "missing"],
    ["empty", "", "missing"],
    ["not a string", { sub: "x" }, "missing"],
    ["expired", sign({ sub: "u", exp: now() - 60 }), "expired"],
    ["not valid yet (nbf)", sign({ sub: "u", nbf: now() + 600 }), "not_before"],
    ["garbage", "not.a.jwt", "invalid"],
    ["HS256 instead of RS256", jwt.sign({ sub: "u" }, "secret"), "invalid"],
  ];

  test.each(cases)("%s", async (_name, token, code) => {
    await expect(verifyUserToken(token)).rejects.toMatchObject({ code });
  });

  test("signed by another key (wrong CLERK_PEM_KEY)", async () => {
    const other = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const token = jwt.sign({ sub: "u" }, other.privateKey, { algorithm: "RS256" });
    await expect(verifyUserToken(token)).rejects.toMatchObject({ code: "invalid" });
  });

  test("a valid token passes and returns its claims", async () => {
    expect(await verifyUserToken(sign({ sub: "user_ok" }))).toMatchObject({ sub: "user_ok" });
  });
});

// Not in the team's definition of an SSO failure (2026-10-02); these pin the current behaviour.
describe("verifyUserToken: host and account checks", () => {
  test("prod rejects a token issued for another host", async () => {
    process.env.BACKEND_ENV = "prod";
    process.env.REQUIRE_CMU_EMAIL = "false";
    process.env.CLERK_LOGIN_HOST = "https://ours.example";
    await expect(verifyUserToken(sign({ sub: "u", azp: "https://other.example" }))).rejects.toMatchObject({
      code: "wrong_host",
    });
    expect(await verifyUserToken(sign({ sub: "u", azp: "https://ours.example" }))).toMatchObject({ sub: "u" });
  });

  test("dev ignores azp", async () => {
    expect(await verifyUserToken(sign({ sub: "u", azp: "https://other.example" }))).toMatchObject({ sub: "u" });
  });

  test("a non-CMU account is refused when CMU email is required", async () => {
    process.env.REQUIRE_CMU_EMAIL = "true";
    fakeGetUser.mockImplementation(async () => ({ emailAddresses: [{ emailAddress: "someone@gmail.com" }] }));
    await expect(verifyUserToken(sign({ sub: "u" }))).rejects.toMatchObject({ code: "not_cmu" });
  });

  test("cmu.edu and andrew.cmu.edu both count", async () => {
    process.env.REQUIRE_CMU_EMAIL = "true";
    fakeGetUser.mockImplementation(async () => ({ emailAddresses: [{ emailAddress: "prof@CMU.EDU" }] }));
    expect(await verifyUserToken(sign({ sub: "u" }))).toMatchObject({ sub: "u" });
  });

  test("a Clerk API failure is a 401 with its own code", async () => {
    process.env.REQUIRE_CMU_EMAIL = "true";
    fakeGetUser.mockImplementation(async () => {
      throw new Error("503");
    });
    await expect(verifyUserToken(sign({ sub: "u" }))).rejects.toMatchObject({ code: "auth_service_error" });
  });
});

const runMiddleware = async (middleware: typeof requireUser | typeof isUser, body: unknown) => {
  const res = fakeRes("");
  res.locals.userId = "";
  let nextCalled = false;
  await new Promise<void>((resolve) => {
    const originalJson = res.json;
    res.json = (payload) => {
      originalJson(payload);
      resolve();
      return res;
    };
    (middleware as (req: never, res: never, next: () => void) => void)({ body } as never, res as never, () => {
      nextCalled = true;
      resolve();
    });
  });
  return { status: res.statusCode, body: res.body, nextCalled, userId: res.locals.userId };
};

describe("requireUser", () => {
  test("no body at all is a 401 with code missing, not a crash", async () => {
    const result = await runMiddleware(requireUser, undefined);
    expect(result).toMatchObject({ status: 401, nextCalled: false, body: { code: "missing" } });
  });

  test("an expired token is a 401 JSON body with a readable message", async () => {
    const result = await runMiddleware(requireUser, { token: sign({ sub: "u", exp: now() - 5 }) });
    expect(result.status).toBe(401);
    expect(result.body).toEqual({ error: "Your session has expired. Sign in again.", code: "expired" });
  });

  test("a valid token sets res.locals.userId", async () => {
    const result = await runMiddleware(requireUser, { token: sign({ sub: "user_me" }) });
    expect(result.nextCalled).toBe(true);
    expect(result.userId).toBe("user_me");
  });

  test("a valid token without sub is refused", async () => {
    const result = await runMiddleware(requireUser, { token: sign({ name: "no subject" }) });
    expect(result).toMatchObject({ status: 401, body: { code: "invalid" } });
  });
});

describe("isUser", () => {
  test("does nothing when AUTH_ENABLED is off", async () => {
    expect((await runMiddleware(isUser, {})).nextCalled).toBe(true);
  });

  test("with AUTH_ENABLED, answers JSON instead of the empty object a raw Error became", async () => {
    process.env.AUTH_ENABLED = "true";
    const result = await runMiddleware(isUser, { token: sign({ sub: "u", nbf: now() + 600 }) });
    expect(result).toMatchObject({ status: 401, nextCalled: false, body: { code: "not_before" } });
  });
});
