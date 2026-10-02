import React from "react";
import { useClerk } from "@clerk/nextjs";
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
  const { openSignIn } = useClerk();
  const info = authErrorInfo(error);
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
            onClick={() => openSignIn()}
          >
            Sign in again
          </button>
        </>
      )}
    </div>
  );
};
