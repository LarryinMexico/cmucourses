import axios from "axios";

/** What the UI should say when a backend call was refused for sign-in or rate-limit reasons. */
export interface AuthErrorInfo {
  message: string;
  /** Signing in again (or with another account) is what fixes it. */
  signInAgain: boolean;
}

const FALLBACK: Record<string, string> = {
  missing: "You are not signed in. Sign in and try again.",
  expired: "Your session has expired. Sign in again.",
  not_before:
    "Your sign-in is not valid yet. Check your device clock and try again.",
  invalid: "Your sign-in is not valid. Sign in again.",
  wrong_host: "This sign-in was issued for another site. Sign in again here.",
  not_cmu: "A CMU email account is required. Sign in with your Andrew account.",
  auth_service_error: "Could not check your account. Try again in a moment.",
};

/**
 * Reads the backend's `{ error, code }` from a 401 (see verifyUserToken in apps/backend) or a 429
 * from the rate limiter. Anything else returns null so the caller keeps its own message.
 */
export const authErrorInfo = (error: unknown): AuthErrorInfo | null => {
  if (!axios.isAxiosError(error) || !error.response) return null;
  const status = error.response.status;
  const data: unknown = error.response.data;
  const body = (typeof data === "object" && data !== null ? data : {}) as {
    error?: unknown;
    code?: unknown;
  };
  const code = typeof body.code === "string" ? body.code : "";
  const serverMessage = typeof body.error === "string" ? body.error : "";

  if (status === 429) {
    return {
      message:
        serverMessage || "Too many requests. Wait a minute and try again.",
      signInAgain: false,
    };
  }
  if (status !== 401) return null;
  return {
    message: serverMessage || FALLBACK[code] || FALLBACK.invalid!,
    signInAgain: code !== "auth_service_error",
  };
};

/**
 * react-query retry policy: a refused sign-in or a rate limit will not fix itself in a second,
 * so retrying only keeps the spinner up longer. Everything else keeps the default 3 retries.
 */
export const shouldRetryQuery = (
  failureCount: number,
  error: unknown
): boolean => {
  if (
    axios.isAxiosError(error) &&
    (error.response?.status === 401 || error.response?.status === 429)
  )
    return false;
  return failureCount < 3;
};
