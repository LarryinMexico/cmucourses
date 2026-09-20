import axios, { isAxiosError } from "axios";
import { useAuth } from "@clerk/nextjs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { STALE_TIME } from "~/app/constants";
import { showToast } from "~/components/Toast";

export type RatingTargetType = "COURSE" | "INSTRUCTOR";

export interface Rating {
  targetType: RatingTargetType;
  targetID: string;
  stars: number;
  comment: string | null;
  wishIKnew: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RatingInput {
  targetType: RatingTargetType;
  targetID: string;
  stars: number;
  comment?: string | null;
  wishIKnew?: string | null;
}

// Ratings need the same full-Mongo-access backend as the profile (see .env.template) — the
// public production API has no /ratings or /user/rating routes.
const backendUrl = () =>
  process.env.NEXT_PUBLIC_PROFILE_BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || "";

const RATINGS_KEY = "ratings";
const OWN_RATING_KEY = "ownRating";

/** Other students' ratings for a course/instructor. Public: no sign-in required to read. */
export const useFetchRatings = (targetType: RatingTargetType, targetID: string) => {
  const { getToken } = useAuth();

  return useQuery({
    queryKey: [RATINGS_KEY, targetType, targetID],
    queryFn: async (): Promise<Rating[]> => {
      const token = (await getToken()) ?? "";
      const response = await axios.post<Rating[]>(
        `${backendUrl()}/ratings`,
        { token },
        { params: { targetType, targetID } }
      );
      return response.data;
    },
    staleTime: STALE_TIME,
  });
};

/** The signed-in user's own rating for a target, null if they haven't rated it. */
export const useFetchOwnRating = (targetType: RatingTargetType, targetID: string) => {
  const { isSignedIn, userId, getToken } = useAuth();

  return useQuery({
    queryKey: [OWN_RATING_KEY, targetType, targetID, userId],
    queryFn: async (): Promise<Rating | null> => {
      const token = await getToken();
      if (!token) return null;
      const response = await axios.post<Rating | null>(`${backendUrl()}/user/rating`, {
        token,
        targetType,
        targetID,
      });
      return response.data;
    },
    enabled: !!isSignedIn,
  });
};

/** Submits (upserts) the signed-in user's own rating. Rejects with 403 if ungated (see backend). */
export const useSubmitRating = () => {
  const { userId, getToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (rating: RatingInput): Promise<Rating> => {
      const token = await getToken();
      if (!token) throw new Error("Not signed in");
      const response = await axios.patch<Rating>(`${backendUrl()}/user/rating`, { token, rating });
      return response.data;
    },
    onSuccess: (rating) => {
      queryClient.setQueryData([OWN_RATING_KEY, rating.targetType, rating.targetID, userId], rating);
      void queryClient.invalidateQueries({ queryKey: [RATINGS_KEY, rating.targetType, rating.targetID] });
    },
    onError: (error) => {
      const message =
        isAxiosError(error) && error.response?.status === 403
          ? ((error.response.data as { error?: string })?.error ?? "You can't rate this yet.")
          : "Couldn't save your rating. Please try again.";
      showToast({ message, icon: ExclamationTriangleIcon });
    },
  });
};
