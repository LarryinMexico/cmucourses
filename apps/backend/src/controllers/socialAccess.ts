import db from "@cmucourses/db";

export type InteractionCheck =
  | { ok: true; target: { id: string; clerkUserId: string } }
  | { ok: false; status: 403 | 404; error: string };

/**
 * Who may react to, or comment on, a published schedule: someone other than its owner who
 * follows the owner. Reactions and comments share this so the rule cannot drift apart.
 * A schedule that is not published is a 404, so the answer never reveals who follows whom.
 */
export const checkInteractionTarget = async (
  callerUserId: string,
  profileID: string,
  action: "react" | "comment"
): Promise<InteractionCheck> => {
  const target = await db.profiles.findUnique({ where: { id: profileID } });
  if (!target || target.clerkUserId === callerUserId) return { ok: false, status: 404, error: "Profile not found" };

  const schedule = await db.socialSchedules.findUnique({ where: { clerkUserId: target.clerkUserId } });
  if (!schedule) return { ok: false, status: 404, error: "No published schedule" };

  const follow = await db.follows.findUnique({
    where: { followerUserId_followedProfileId: { followerUserId: callerUserId, followedProfileId: target.id } },
  });
  if (!follow) return { ok: false, status: 403, error: `Follow this student to ${action}` };

  return { ok: true, target: { id: target.id, clerkUserId: target.clerkUserId } };
};
