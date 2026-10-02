import { AxiosError, AxiosHeaders } from "axios";
import { authErrorInfo, shouldRetryQuery } from "./authError";

const axiosError = (status: number, data: unknown) =>
  new AxiosError("failed", "ERR_BAD_REQUEST", undefined, undefined, {
    status,
    data,
    statusText: "",
    headers: {},
    config: { headers: new AxiosHeaders() },
  });

describe("authErrorInfo", () => {
  test("uses the backend's message for a 401", () => {
    expect(
      authErrorInfo(
        axiosError(401, {
          error: "Your session has expired. Sign in again.",
          code: "expired",
        })
      )
    ).toEqual({
      message: "Your session has expired. Sign in again.",
      signInAgain: true,
    });
  });

  test("falls back to a message per code when the body has none", () => {
    expect(
      authErrorInfo(axiosError(401, { code: "not_before" }))?.message
    ).toMatch(/clock/);
    expect(authErrorInfo(axiosError(401, "plain text"))?.message).toMatch(
      /not valid/
    );
  });

  test("a Clerk outage does not ask the student to sign in again", () => {
    expect(
      authErrorInfo(axiosError(401, { code: "auth_service_error" }))
        ?.signInAgain
    ).toBe(false);
  });

  test("a 429 says to wait", () => {
    expect(authErrorInfo(axiosError(429, { code: "rate_limited" }))).toEqual({
      message: "Too many requests. Wait a minute and try again.",
      signInAgain: false,
    });
  });

  test("other failures are left to the caller", () => {
    expect(authErrorInfo(axiosError(500, {}))).toBeNull();
    expect(authErrorInfo(new Error("network"))).toBeNull();
  });
});

describe("shouldRetryQuery", () => {
  test("never retries a refused sign-in or a rate limit", () => {
    expect(shouldRetryQuery(0, axiosError(401, {}))).toBe(false);
    expect(shouldRetryQuery(0, axiosError(429, {}))).toBe(false);
  });

  test("retries anything else up to 3 times", () => {
    expect(shouldRetryQuery(2, axiosError(500, {}))).toBe(true);
    expect(shouldRetryQuery(3, axiosError(500, {}))).toBe(false);
  });
});
