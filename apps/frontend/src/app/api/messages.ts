import axios from "axios";
import { useAuth } from "@clerk/nextjs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ConversationSummary, DirectMessage } from "@cmucourses/profile";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { showToast } from "~/components/Toast";
import { backendUrl } from "~/app/api/social";

const CONVERSATIONS_KEY = "conversations";
const THREAD_KEY = "thread";

// Messages arrive by polling: this backend is a plain Express app on Netlify, with no
// long-lived connections to push over. react-query pauses `refetchInterval` while the tab is
// hidden (refetchIntervalInBackground is off), so it costs nothing when nobody is looking.
const LIST_POLL_MS = 15_000;
const THREAD_POLL_MS = 5_000;

export const useConversations = () => {
  const { isSignedIn, getToken } = useAuth();
  return useQuery({
    queryKey: [CONVERSATIONS_KEY],
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
  const { isSignedIn, getToken } = useAuth();
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: [THREAD_KEY, profileID],
    queryFn: async (): Promise<DirectMessage[]> => {
      const token = await getToken();
      if (!token) return [];
      const response = await axios.post<DirectMessage[]>(
        `${backendUrl()}/user/messages/thread`,
        { token, profileID }
      );
      void queryClient.invalidateQueries({ queryKey: [CONVERSATIONS_KEY] });
      return response.data;
    },
    enabled: !!isSignedIn && !!profileID,
    refetchInterval: THREAD_POLL_MS,
    refetchIntervalInBackground: false,
  });
};

const errorMessage = (error: unknown) => {
  const data = axios.isAxiosError(error)
    ? (error.response?.data as { error?: unknown } | undefined)
    : undefined;
  return typeof data?.error === "string"
    ? data.error
    : "Couldn't send the message. Please try again.";
};

export const useSendMessage = () => {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { profileID: string; body: string }) => {
      const token = await getToken();
      if (!token) throw new Error("Not signed in");
      await axios.patch(`${backendUrl()}/user/messages`, { token, ...input });
    },
    onSuccess: (_data, input) => {
      void queryClient.invalidateQueries({
        queryKey: [THREAD_KEY, input.profileID],
      });
      void queryClient.invalidateQueries({ queryKey: [CONVERSATIONS_KEY] });
    },
    onError: (error) =>
      showToast({
        message: errorMessage(error),
        icon: ExclamationTriangleIcon,
      }),
  });
};
