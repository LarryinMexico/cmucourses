import axios from "axios";
import { useAuth } from "@clerk/nextjs";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type {
  FeedPage,
  ScheduleComment,
  SocialDirectory,
  SocialReaction,
} from "@cmucourses/profile";
import { showToast } from "~/components/Toast";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";

export const backendUrl = () =>
  process.env.NEXT_PUBLIC_PROFILE_BACKEND_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  "";

// Every key carries the Clerk user id, so two accounts in one browser never share cached data.
const DIRECTORY_KEY = "socialDirectory";
const FEED_KEY = "circleFeed";
const COMMENTS_KEY = "postComments";

export type FeedFilter = "all" | "following" | "mine";

/** The server's own message ("Follow this student to comment") beats a generic failure toast. */
export const serverMessage = (error: unknown, fallback: string) => {
  const data = axios.isAxiosError(error)
    ? (error.response?.data as { error?: unknown } | undefined)
    : undefined;
  return typeof data?.error === "string" ? data.error : fallback;
};

const toastError = (fallback: string) => (error: unknown) =>
  showToast({
    message: serverMessage(error, fallback),
    icon: ExclamationTriangleIcon,
  });

const post = async <T>(
  getToken: () => Promise<string | null>,
  path: string,
  body: object = {}
): Promise<T> => {
  const token = await getToken();
  if (!token) throw new Error("Not signed in");
  const response = await axios.post<T>(`${backendUrl()}${path}`, {
    token,
    ...body,
  });
  return response.data;
};

/**
 * People you can find in Circles, plus your own state (profile id, posts, whether others can see
 * you). Polled while Circles is open so a follow from the other side shows up without a reload.
 */
export const useSocialDirectory = () => {
  const { isSignedIn, userId, getToken } = useAuth();
  return useQuery({
    queryKey: [DIRECTORY_KEY, userId],
    queryFn: () => post<SocialDirectory>(getToken, "/social/directory"),
    enabled: !!isSignedIn,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });
};

/** The Circles feed, newest first, loaded a page at a time as you scroll. */
export const useFeed = (filter: FeedFilter) => {
  const { isSignedIn, userId, getToken } = useAuth();
  return useInfiniteQuery({
    queryKey: [FEED_KEY, userId, filter],
    queryFn: ({ pageParam }) =>
      post<FeedPage>(getToken, "/social/feed", {
        filter,
        ...(pageParam ? { cursor: pageParam } : {}),
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    enabled: !!isSignedIn,
  });
};

/**
 * The newest post for a filter, polled every 30s so the feed can offer "New posts" rather than
 * reshuffling under the reader. Its key starts with the feed's, so social actions refresh it too.
 */
export const useFeedHead = (filter: FeedFilter) => {
  const { isSignedIn, userId, getToken } = useAuth();
  return useQuery({
    queryKey: [FEED_KEY, userId, filter, "head"],
    queryFn: () => post<FeedPage>(getToken, "/social/feed", { filter }),
    select: (page) => page.posts[0] ?? null,
    enabled: !!isSignedIn,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });
};

/** Refreshes everything a social action can change: the feed pages and the directory. */
const useRefreshSocial = () => {
  const { userId } = useAuth();
  const queryClient = useQueryClient();
  // Returned so a mutation stays pending until the fresh data is in; otherwise a Follow button
  // re-enables still reading "Follow" and a reaction un-highlights for a moment.
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: [FEED_KEY, userId] }),
      queryClient.invalidateQueries({ queryKey: [DIRECTORY_KEY, userId] }),
    ]);
};

const useSocialMutation = <T extends object>(
  method: "patch" | "delete",
  path: string,
  fallback: string
) => {
  const { getToken } = useAuth();
  const refresh = useRefreshSocial();
  return useMutation({
    mutationFn: async (input: T) => {
      const token = await getToken();
      if (!token) throw new Error("Not signed in");
      const url = `${backendUrl()}${path}`;
      if (method === "delete")
        await axios.delete(url, { data: { token, ...input } });
      else await axios.patch(url, { token, ...input });
    },
    onSuccess: () => refresh(),
    onError: toastError(fallback),
  });
};

export const useToggleFollow = () =>
  useSocialMutation<{ profileID: string; follow: boolean }>(
    "patch",
    "/user/social/follow",
    "Couldn't update who you follow. Please try again."
  );

export const useSharePost = () =>
  useSocialMutation<{ savedScheduleId: string }>(
    "patch",
    "/user/posts",
    "Couldn't share the schedule. Please try again."
  );

export const useDeletePost = () =>
  useSocialMutation<{ postId: string }>(
    "delete",
    "/user/posts",
    "Couldn't delete the post. Please try again."
  );

export const useReactToPost = () =>
  useSocialMutation<{ postId: string; reaction: SocialReaction | null }>(
    "patch",
    "/user/posts/reaction",
    "Couldn't react. Please try again."
  );

export const usePostComments = (postId: string, enabled: boolean) => {
  const { isSignedIn, userId, getToken } = useAuth();
  return useQuery({
    queryKey: [COMMENTS_KEY, userId, postId],
    queryFn: () =>
      post<ScheduleComment[]>(getToken, "/social/posts/comments", { postId }),
    enabled: !!isSignedIn && enabled,
  });
};

const useCommentMutation = <T extends { postId: string }>(
  send: (url: string, token: string, input: T) => Promise<unknown>
) => {
  const { userId, getToken } = useAuth();
  const queryClient = useQueryClient();
  const refresh = useRefreshSocial();
  return useMutation({
    mutationFn: async (input: T) => {
      const token = await getToken();
      if (!token) throw new Error("Not signed in");
      await send(backendUrl(), token, input);
    },
    onSuccess: (_data, input) =>
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: [COMMENTS_KEY, userId, input.postId],
        }),
        refresh(), // comment counts
      ]),
    onError: toastError("Couldn't update comments. Please try again."),
  });
};

export const useAddComment = () =>
  useCommentMutation<{ postId: string; body: string }>((url, token, input) =>
    axios.patch(`${url}/user/posts/comment`, { token, ...input })
  );

/** `postId` is only used to know which comment list to refresh. */
export const useDeleteComment = () =>
  useCommentMutation<{ postId: string; commentID: string }>(
    (url, token, { commentID }) =>
      axios.delete(`${url}/user/posts/comment`, { data: { token, commentID } })
  );
