/// <reference types="bun-types" />
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import express from "express";
import jwt from "jsonwebtoken";
import type { Server } from "node:http";
import { authKey, createLimiters } from "./rateLimit";

const { publicLimiter, authLimiter } = createLimiters({ windowMs: 60_000, public: 5, authenticated: 2 });
const app = express();
app.use(express.json());
app.use(publicLimiter);
app.get("/open", (_req, res) => {
  res.json({ ok: true });
});
app.post("/mine", authLimiter, (_req, res) => {
  res.json({ ok: true });
});

let server: Server;
let base = "";
beforeAll(async () => {
  server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
afterAll(() => {
  server.close();
});

const tokenFor = (sub: string) => jwt.sign({ sub }, "unverified-here");
const postAs = (sub: string) =>
  fetch(`${base}/mine`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: tokenFor(sub) }),
  });

describe("rate limits", () => {
  test("an authenticated route allows N requests per user, then answers 429 with Retry-After", async () => {
    expect((await postAs("user_a")).status).toBe(200);
    expect((await postAs("user_a")).status).toBe(200);
    const limited = await postAs("user_a");
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).not.toBeNull();
    expect(await limited.json()).toMatchObject({ code: "rate_limited" });
  });

  test("another user is counted separately", async () => {
    expect((await postAs("user_b")).status).toBe(200);
  });

  test("every route shares the per-IP public limit", async () => {
    // The four POSTs above came from this IP too, so only one more request fits in the window.
    const statuses: number[] = [];
    for (let i = 0; i < 3; i++) statuses.push((await fetch(`${base}/open`)).status);
    expect(statuses).toEqual([200, 429, 429]);
  });
});

describe("authKey", () => {
  const req = (body: unknown) => ({ body, ip: "203.0.113.9" }) as never;

  test("uses the token's subject", () => {
    expect(authKey(req({ token: tokenFor("user_x") }))).toBe("user:user_x");
  });

  test("falls back to the IP without a readable token", () => {
    expect(authKey(req({ token: "garbage" }))).toBe("ip:203.0.113.9");
    expect(authKey(req({}))).toBe("ip:203.0.113.9");
  });
});
