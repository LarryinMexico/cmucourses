import axios from "axios";
import { useAuth } from "@clerk/nextjs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SavedSchedule, SavedScheduleInput } from "@cmucourses/profile";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { showToast } from "~/components/Toast";
import { backendUrl } from "~/app/api/social";

export const SAVED_SCHEDULES_KEY = "savedSchedules";

const serverError = (error: unknown, fallback: string) => {
  const data = axios.isAxiosError(error)
    ? (error.response?.data as { error?: unknown } | undefined)
    : undefined;
  return typeof data?.error === "string" ? data.error : fallback;
};

/** The signed-in account's named schedules. Keyed by user id so accounts never share a cache. */
export const useSavedSchedules = () => {
  const { isSignedIn, userId, getToken } = useAuth();
  return useQuery({
    queryKey: [SAVED_SCHEDULES_KEY, userId],
    queryFn: async (): Promise<SavedSchedule[]> => {
      const token = await getToken();
      if (!token) return [];
      const response = await axios.post<SavedSchedule[]>(
        `${backendUrl()}/user/schedules`,
        { token }
      );
      return response.data;
    },
    enabled: !!isSignedIn,
  });
};

export const useSaveSchedule = () => {
  const { userId, getToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      schedule: SavedScheduleInput
    ): Promise<SavedSchedule> => {
      const token = await getToken();
      if (!token) throw new Error("Not signed in");
      const response = await axios.patch<SavedSchedule>(
        `${backendUrl()}/user/schedules`,
        { token, schedule }
      );
      return response.data;
    },
    onSuccess: () =>
      void queryClient.invalidateQueries({
        queryKey: [SAVED_SCHEDULES_KEY, userId],
      }),
    onError: (error) =>
      showToast({
        message: serverError(
          error,
          "Couldn't save the schedule. Please try again."
        ),
        icon: ExclamationTriangleIcon,
      }),
  });
};

export const useDeleteSavedSchedule = () => {
  const { userId, getToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const token = await getToken();
      if (!token) throw new Error("Not signed in");
      await axios.delete(`${backendUrl()}/user/schedules`, {
        data: { token, id },
      });
    },
    onSuccess: () =>
      void queryClient.invalidateQueries({
        queryKey: [SAVED_SCHEDULES_KEY, userId],
      }),
    onError: (error) =>
      showToast({
        message: serverError(
          error,
          "Couldn't delete the schedule. Please try again."
        ),
        icon: ExclamationTriangleIcon,
      }),
  });
};
