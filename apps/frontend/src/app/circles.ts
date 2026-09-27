import type { ConversationSummary } from "@cmucourses/profile";

/** Unread messages across all conversations, for the Messages tab label. Kept free of Clerk so jest can load it. */
export const unreadTotal = (
  conversations: Pick<ConversationSummary, "unreadCount">[] | undefined
): number => (conversations ?? []).reduce((sum, c) => sum + c.unreadCount, 0);
