import React from "react";
import { useAuth, useClerk } from "@clerk/nextjs";
import { authErrorInfo } from "~/app/api/authError";

/**
 * Shows why a signed-in request was refused (expired session, not a CMU account, rate limited)
 * with a way out, or `children` — the caller's own error line — for any other failure.
 */
export const AuthErrorNotice = ({
  error,
  className = "text-gray-500 text-sm",
  children,
}: {
  error: unknown;
  className?: string;
  children: React.ReactNode;
}) => {
  const { openSignIn, signOut } = useClerk();
  const { isSignedIn } = useAuth();
  const info = authErrorInfo(error);
  // The backend refused a token Clerk still considers valid (expired, wrong instance, not a CMU
  // account), so a Clerk session usually still exists, and Clerk will not open sign-in over one
  // (single-session mode: it throws in development and does nothing in production). End it first.
  const signInAgain = async () => {
    if (isSignedIn) await signOut({ redirectUrl: window.location.href });
    openSignIn();
  };
  if (!info) return <>{children}</>;
  return (
    <div className={className} role="alert">
      <span className="text-gray-500">{info.message}</span>
      {info.signInAgain && (
        <>
          {" "}
          <button
            type="button"
            className="text-blue-600 hover:underline"
            onClick={() => void signInAgain()}
          >
            Sign in again
          </button>
        </>
      )}
    </div>
  );
};
