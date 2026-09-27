import axios from "axios";
import { useAuth } from "@clerk/nextjs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ConversationSummary, DirectMessage } from "@cmucourses/profile";
import { backendUrl, serverMessage } from "~/app/api/social";

// Keys carry the Clerk user id, so a second account in the same browser never sees these.
const CONVERSATIONS_KEY = "conversations";
const THREAD_KEY = "thread";

// Messages arrive by polling: this backend is a plain Express app on Netlify, with no
// long-lived connections to push over. react-query pauses `refetchInterval` while the tab is
// hidden (refetchIntervalInBackground is off), so it costs nothing when nobody is looking.
const LIST_POLL_MS = 15_000;
const THREAD_POLL_MS = 5_000;

/** A message in the open thread; `status` is set only on ones this browser just sent. */
export type ThreadMessage = DirectMessage & {
  status?: "sending" | "failed";
  error?: string;
};

export const useConversations = () => {
  const { isSignedIn, userId, getToken } = useAuth();
  return useQuery({
    queryKey: [CONVERSATIONS_KEY, userId],
    queryFn: async (): Promise<ConversationSummary[]> => {
      const token = await getToken();
      if (!token) return [];
      const response = await axios.post<ConversationSummary[]>(
        `${backendUrl()}/user/messages/conversations`,
        { token }
      );
      return response.data;
    },
    enabled: !!isSignedIn,
    refetchInterval: LIST_POLL_MS,
    refetchIntervalInBackground: false,
  });
};

/**
 * Fetching a thread also marks what was sent to you as read on the server, so the conversation
 * list is refreshed afterwards to drop its unread count.
 */
export const useThread = (profileID: string | null) => {
  const { isSignedIn, userId, getToken } = useAuth();
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: [THREAD_KEY, userId, profileID],
    queryFn: async (): Promise<ThreadMessage[]> => {
      const token = await getToken();
      if (!token) return [];
      const response = await axios.post<DirectMessage[]>(
        `${backendUrl()}/user/messages/thread`,
        { token, profileID }
      );
      // Opening the thread marked it read on the server; refresh the list's unread count, but only
      // if it had one, rather than refetching the list on every 5 s poll.
      const listed = queryClient
        .getQueryData<ConversationSummary[]>([CONVERSATIONS_KEY, userId])
        ?.find((c) => c.profileID === profileID);
      if (listed && listed.unreadCount > 0)
        void queryClient.invalidateQueries({
          queryKey: [CONVERSATIONS_KEY, userId],
        });
      // Keep this browser's own unconfirmed messages (sending, or failed with Retry) across polls:
      // the server has not got them, so its list would drop them.
      const failed = (
        queryClient.getQueryData<ThreadMessage[]>([
          THREAD_KEY,
          userId,
          profileID,
        ]) ?? []
      ).filter(
        (message) => message.status === "failed" || message.status === "sending"
      );
      return [...response.data, ...failed];
    },
    enabled: !!isSignedIn && !!profileID,
    refetchInterval: THREAD_POLL_MS,
    refetchIntervalInBackground: false,
  });
};

/**
 * Sends a message. It shows in the thread at once as "Sending…", is replaced by the server's copy
 * on success, and stays as "Not sent" with the server's reason on failure.
 */
export const useSendMessage = () => {
  const { userId, getToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      profileID: string;
      body: string;
      tempID: string;
    }) => {
      const token = await getToken();
      if (!token) throw new Error("Not signed in");
      await axios.patch(`${backendUrl()}/user/messages`, {
        token,
        profileID: input.profileID,
        body: input.body,
      });
    },
    onMutate: async (input) => {
      const key = [THREAD_KEY, userId, input.profileID];
      await queryClient.cancelQueries({ queryKey: key });
      queryClient.setQueryData<ThreadMessage[]>(key, (old = []) => [
        ...old.filter((message) => message.messageID !== input.tempID),
        {
          messageID: input.tempID,
          body: input.body.trim(),
          createdAt: new Date().toISOString(),
          fromMe: true,
          status: "sending",
        },
      ]);
    },
    onError: (error, input) => {
      queryClient.setQueryData<ThreadMessage[]>(
        [THREAD_KEY, userId, input.profileID],
        (old = []) => {
          const failed: ThreadMessage = {
            messageID: input.tempID,
            body: input.body.trim(),
            createdAt: new Date().toISOString(),
            fromMe: true,
            status: "failed",
            error: serverMessage(error, "Couldn't send"),
          };
          // A poll may have replaced the list meanwhile; never lose the message.
          return old.some((message) => message.messageID === input.tempID)
            ? old.map((message) =>
                message.messageID === input.tempID
                  ? { ...message, ...failed }
                  : message
              )
            : [...old, failed];
        }
      );
    },
    onSuccess: (_data, input) => {
      queryClient.setQueryData<ThreadMessage[]>(
        [THREAD_KEY, userId, input.profileID],
        // Keep it on screen, no longer "Sending…", until the refetch brings the server's copy.
        (old = []) =>
          old.map((message) =>
            message.messageID === input.tempID
              ? { ...message, status: undefined }
              : message
          )
      );
      void queryClient.invalidateQueries({
        queryKey: [THREAD_KEY, userId, input.profileID],
      });
      void queryClient.invalidateQueries({
        queryKey: [CONVERSATIONS_KEY, userId],
      });
    },
  });
};
