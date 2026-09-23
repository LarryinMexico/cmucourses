import { useEffect, useRef } from "react";
import { useAuth } from "@clerk/nextjs";
import { useFetchProfile } from "~/app/api/profile";
import { filtersSlice } from "~/app/filters";
import { useAppDispatch } from "~/app/hooks";
import { uiSlice } from "~/app/ui";

const appliedKey = (userId: string) => `defaultFiltersApplied:${userId}`;

/**
 * Applies the signed-in student's saved default filters, once per browser tab session, when the
 * search page opens. After that the filters are theirs to change: coming back to the page, or a
 * profile refetch, must not put the default back over what they just set.
 *
 * The tab-session flag lives in sessionStorage (which can throw, e.g. in a private window) and a
 * ref covers the rest of this mount. redux-persist has rehydrated before pages render
 * (PersistGate), so the default lands on top of the last-used filters rather than under them.
 */
export const useApplyDefaultFilters = () => {
  const { isSignedIn, userId } = useAuth();
  const { data: profile } = useFetchProfile();
  const dispatch = useAppDispatch();
  const appliedFor = useRef<string | null>(null);
  const saved = profile?.savedFilters ?? null;

  useEffect(() => {
    if (!isSignedIn || !userId || !saved) return;
    if (appliedFor.current === userId) return;
    appliedFor.current = userId;
    try {
      if (sessionStorage.getItem(appliedKey(userId))) return;
      sessionStorage.setItem(appliedKey(userId), "1");
    } catch {
      // No sessionStorage: fall back to once per mount.
    }
    dispatch(filtersSlice.actions.applySavedFilters(saved));
    dispatch(uiSlice.actions.setMatchGoals(saved.matchGoals));
  }, [isSignedIn, userId, saved, dispatch]);
};

/** Marks the default as applied for this tab session, so saving one does not re-apply it on return. */
export const markDefaultFiltersApplied = (
  userId: string | null | undefined
) => {
  if (!userId) return;
  try {
    sessionStorage.setItem(appliedKey(userId), "1");
  } catch {
    // Nothing to remember it in; the ref in useApplyDefaultFilters still covers this mount.
  }
};
