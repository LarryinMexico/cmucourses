import { clerkMiddleware } from "@clerk/nextjs/server";

// Clerk finishes sign-in on this site. (The ScottyLabs original redirected `/?__clerk_status=`
// to courses.scottylabs.org, which sent our users to someone else's deployment.)
export default clerkMiddleware();

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
