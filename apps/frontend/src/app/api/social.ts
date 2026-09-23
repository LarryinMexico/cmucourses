import axios from "axios";
import { useAuth } from "@clerk/nextjs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type PublishedSchedule,
  type ScheduleComment,
  type SocialDirectory,
  type SocialReaction,
} from "@cmucourses/profile";
import { showToast } from "~/components/Toast";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";

const backendUrl = () =>
  process.env.NEXT_PUBLIC_PROFILE_BACKEND_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  "";

const DIRECTORY_KEY = "socialDirectory";

const COMMENTS_KEY = "scheduleComments";

const EMPTY_DIRECTORY: SocialDirectory = {
  me: { profileID: null, publishedSchedule: null },
  people: [],
};

export const useSocialDirectory = () => {
  const { isSignedIn, getToken } = useAuth();
  return useQuery({
    queryKey: [DIRECTORY_KEY],
    queryFn: async (): Promise<SocialDirectory> => {
      const token = await getToken();
      if (!token) return EMPTY_DIRECTORY;
      const response = await axios.post<SocialDirectory>(
        `${backendUrl()}/social/directory`,
        { token }
      );
      return response.data;
    },
    enabled: !!isSignedIn,
  });
};

const useSocialMutation = <T extends object>(path: string) => {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: T) => {
      const token = await getToken();
      if (!token) throw new Error("Not signed in");
      await axios.patch(`${backendUrl()}${path}`, { token, ...input });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [DIRECTORY_KEY] });
    },
    onError: () =>
      showToast({
        message: "Couldn't update Scotty Circles. Please try again.",
        icon: ExclamationTriangleIcon,
      }),
  });
};

export const usePublishSocialSchedule = () =>
  useSocialMutation<{ schedule: PublishedSchedule | null }>(
    "/user/social/schedule"
  );

export const useToggleFollow = () =>
  useSocialMutation<{ profileID: string; follow: boolean }>(
    "/user/social/follow"
  );

export const useReactToSchedule = () =>
  useSocialMutation<{
    profileID: string;
    reaction: SocialReaction | null;
  }>("/user/social/reaction");

/** The server's own message ("Follow this student to comment") beats a generic failure toast. */
const commentError = (error: unknown) =>
  axios.isAxiosError(error) &&
  typeof (error.response?.data as { error?: unknown } | undefined)?.error ===
    "string"
    ? (error.response?.data as { error: string }).error
    : "Couldn't update comments. Please try again.";

export const useScheduleComments = (profileID: string, enabled: boolean) => {
  const { isSignedIn, getToken } = useAuth();
  return useQuery({
    queryKey: [COMMENTS_KEY, profileID],
    queryFn: async (): Promise<ScheduleComment[]> => {
      const token = await getToken();
      if (!token) return [];
      const response = await axios.post<ScheduleComment[]>(
        `${backendUrl()}/social/comments`,
        { token, profileID }
      );
      return response.data;
    },
    enabled: !!isSignedIn && enabled,
  });
};

const useCommentMutation = <T extends { profileID: string }>(
  send: (url: string, token: string, input: T) => Promise<unknown>
) => {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: T) => {
      const token = await getToken();
      if (!token) throw new Error("Not signed in");
      await send(backendUrl(), token, input);
    },
    onSuccess: (_data, input) => {
      void queryClient.invalidateQueries({
        queryKey: [COMMENTS_KEY, input.profileID],
      });
    },
    onError: (error) =>
      showToast({
        message: commentError(error),
        icon: ExclamationTriangleIcon,
      }),
  });
};

export const useAddComment = () =>
  useCommentMutation<{ profileID: string; body: string }>((url, token, input) =>
    axios.patch(`${url}/user/social/comment`, { token, ...input })
  );

/** `profileID` is only used to know which comment list to refresh. */
export const useDeleteComment = () =>
  useCommentMutation<{ profileID: string; commentID: string }>(
    (url, token, { commentID }) =>
      axios.delete(`${url}/user/social/comment`, {
        data: { token, commentID },
      })
  );
