import axios from "axios";
import { useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import {
  emptyProfile,
  Profile,
  ProfilePatch,
  ProfilePatchInput,
  profilePatchSchema,
} from "@cmucourses/profile";
import { showToast } from "~/components/Toast";

// Profiles may be served by a different backend than the course catalog (see .env.template).
const profileUrl = () =>
  `${process.env.NEXT_PUBLIC_PROFILE_BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || ""}/user/profile`;

const PROFILE_KEY = "profile";

const applyPatch = (
  profile: Profile,
  { completeOnboarding, ...sections }: ProfilePatch
): Profile => ({
  ...profile,
  ...sections,
  onboardedAt: completeOnboarding
    ? (profile.onboardedAt ?? new Date().toISOString())
    : profile.onboardedAt,
});

export const useFetchProfile = () => {
  const { isLoaded, isSignedIn, userId, getToken } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (isLoaded && !isSignedIn)
      queryClient.removeQueries({ queryKey: [PROFILE_KEY] });
  }, [isLoaded, isSignedIn, queryClient]);

  return useQuery({
    queryKey: [PROFILE_KEY, userId],
    queryFn: async (): Promise<Profile> => {
      const token = await getToken();
      if (!token) return emptyProfile();
      const response = await axios.post<Profile>(profileUrl(), { token });
      return response.data;
    },
    enabled: !!isSignedIn,
    // Every page reads this (for onboarding), so skip refetching on each navigation; it still
    // refetches on window focus once stale, which is how edits from another device show up.
    staleTime: 60 * 1000,
  });
};

/** Saves the sections present in the patch, updating the cached profile optimistically. */
export const useUpdateProfile = () => {
  const { userId, getToken } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = [PROFILE_KEY, userId];

  return useMutation({
    mutationFn: async (patch: ProfilePatchInput): Promise<Profile> => {
      const token = await getToken();
      if (!token) throw new Error("Not signed in");
      const response = await axios.patch<Profile>(profileUrl(), {
        token,
        profile: patch,
      });
      return response.data;
    },
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<Profile>(queryKey);
      const parsed = profilePatchSchema.safeParse(patch);
      if (previous && parsed.success)
        queryClient.setQueryData(queryKey, applyPatch(previous, parsed.data));
      return { previous };
    },
    onError: (_error, _patch, context) => {
      if (context?.previous)
        queryClient.setQueryData(queryKey, context.previous);
      showToast({
        message: "Couldn't save your profile. Please try again.",
        icon: ExclamationTriangleIcon,
      });
    },
    onSuccess: (profile) => {
      queryClient.setQueryData(queryKey, profile);
    },
  });
};
