import db from "@cmucourses/db";

export type PostInteractionCheck =
  | { ok: true; post: { id: string; authorUserId: string }; authorProfileId: string }
  | { ok: false; status: 403 | 404; error: string };

/**
 * Who may react to, or comment on, a post: someone other than its author who follows the author.
 * Reactions and comments share this so the rule cannot drift apart. A missing post (or author)
 * is a 404 before any follow check, so the answer never reveals who follows whom.
 */
export const checkPostInteraction = async (
  callerUserId: string,
  postId: string,
  action: "react" | "comment"
): Promise<PostInteractionCheck> => {
  const post = await db.circlePosts.findUnique({ where: { id: postId } });
  if (!post || post.authorUserId === callerUserId) return { ok: false, status: 404, error: "Post not found" };

  const author = await db.profiles.findUnique({ where: { clerkUserId: post.authorUserId } });
  if (!author) return { ok: false, status: 404, error: "Post not found" };

  const follow = await db.follows.findUnique({
    where: { followerUserId_followedProfileId: { followerUserId: callerUserId, followedProfileId: author.id } },
  });
  if (!follow) return { ok: false, status: 403, error: `Follow this student to ${action}` };

  return { ok: true, post: { id: post.id, authorUserId: post.authorUserId }, authorProfileId: author.id };
};
