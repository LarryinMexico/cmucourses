import { useAuth } from "@clerk/nextjs";
import { useAppDispatch, useAppSelector } from "~/app/hooks";
import { userSlice } from "~/app/user";
import { useFetchProfile, useUpdateProfile } from "~/app/api/profile";

const NONE: string[] = [];

/**
 * Saved (starred) courses. Signed in, they live on the account (`profile.savedCourses`), so they
 * follow the student across devices and never mix with another account in the same browser.
 * Signed out, they stay in this browser, as before. Nothing is copied between the two.
 */
export const useSavedCourses = (): {
  saved: string[];
  isSaved: (courseID: string) => boolean;
  toggle: (courseID: string) => void;
} => {
  const { isSignedIn } = useAuth();
  const { data: profile } = useFetchProfile();
  const update = useUpdateProfile();
  const dispatch = useAppDispatch();
  const local = useAppSelector((state) => state.user.bookmarked);

  const saved = isSignedIn ? (profile?.savedCourses ?? NONE) : local;
  const isSaved = (courseID: string) => saved.includes(courseID);

  const toggle = (courseID: string) => {
    if (isSignedIn) {
      if (!profile) return;
      const next = isSaved(courseID)
        ? saved.filter((id) => id !== courseID)
        : [...saved, courseID];
      update.mutate({ savedCourses: next });
    } else if (isSaved(courseID)) {
      dispatch(userSlice.actions.removeBookmark(courseID));
    } else {
      dispatch(userSlice.actions.addBookmark(courseID));
    }
  };

  return { saved, isSaved, toggle };
};
