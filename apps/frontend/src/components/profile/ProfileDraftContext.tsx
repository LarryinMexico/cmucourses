import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { isEqual } from "lodash-es";
import { useRouter } from "next/router";
import { Profile, profilePatchSchema } from "@cmucourses/profile";
import { useUpdateProfile } from "~/app/api/profile";
import { PROFILE_SECTIONS } from "./completeness";
import { PRIMARY_BUTTON_CLASS, SECONDARY_BUTTON_CLASS } from "./fields";
import {
  changedPatch,
  dirtySections,
  DraftKey,
  ProfileDraft,
  sectionForIssue,
  sectionsOfKey,
  toProfileDraft,
} from "./profileDraft";

/**
 * Local edits of one saved value. When the saved value changes (a save elsewhere, a refetch)
 * and there are no unsaved edits, the draft follows it.
 */
export function useDraft<T>(saved: T) {
  const [draft, setDraft] = useState(saved);
  const [base, setBase] = useState(saved);
  if (!isEqual(saved, base)) {
    if (isEqual(draft, base)) setDraft(saved);
    setBase(saved);
  }
  return { draft, setDraft, dirty: !isEqual(draft, saved) };
}

type ContextValue = {
  draft: ProfileDraft;
  update: <K extends DraftKey>(key: K, value: ProfileDraft[K]) => void;
  /** Card id -> the first validation message for it. */
  errors: Record<string, string>;
  /** Cards with unsaved changes, in page order. */
  dirty: string[];
  saveAll: () => void;
  discard: () => void;
  saving: boolean;
  /** Where a click on an in-app link was headed while edits were unsaved; the save bar asks. */
  pendingHref: string | null;
  saveAndLeave: () => void;
  leave: () => void;
  stay: () => void;
};

const ProfileDraftContext = createContext<ContextValue | null>(null);

export const useProfileDraft = (): ContextValue => {
  const value = useContext(ProfileDraftContext);
  if (!value)
    throw new Error("useProfileDraft must be used inside ProfileDraftProvider");
  return value;
};

/** One draft field as a `{ draft, setDraft }` pair, for a card that edits a single section. */
export const useDraftField = <K extends DraftKey>(key: K) => {
  const { draft, update } = useProfileDraft();
  return {
    draft: draft[key],
    setDraft: (value: ProfileDraft[K]) => update(key, value),
  };
};

/** Several draft fields as one `{ draft, setDraft }` object, for a card that edits a few sections. */
export const useDraftFields = <K extends DraftKey>(keys: readonly K[]) => {
  const { draft, update } = useProfileDraft();
  const picked = Object.fromEntries(keys.map((key) => [key, draft[key]])) as {
    [P in K]: ProfileDraft[P];
  };
  return {
    draft: picked,
    setDraft: (next: { [P in K]: ProfileDraft[P] }) => {
      for (const key of keys)
        if (!isEqual(next[key], picked[key])) update(key, next[key]);
    },
  };
};

/**
 * Holds every unsaved edit on the Profile page, so one Save all writes them together. The
 * Private/Public switches are part of the draft too.
 */
export const ProfileDraftProvider = ({
  profile,
  children,
}: {
  profile: Profile;
  children: React.ReactNode;
}) => {
  const saved = useMemo(() => toProfileDraft(profile), [profile]);
  const { draft, setDraft } = useDraft(saved);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const [errors, setErrors] = useState<Record<string, string>>({});
  const mutation = useUpdateProfile();
  const dirty = useMemo(() => dirtySections(draft, saved), [draft, saved]);

  const update = useCallback(
    <K extends DraftKey>(key: K, value: ProfileDraft[K]) => {
      setDraft((prev) => ({ ...prev, [key]: value }));
      setErrors((prev) => {
        const sections = sectionsOfKey(key);
        if (!sections.some((id) => id in prev)) return prev;
        const next = { ...prev };
        sections.forEach((id) => delete next[id]);
        return next;
      });
    },
    [setDraft]
  );

  const saveAll = (onDone?: () => void) => {
    const sent = draftRef.current;
    const patch = changedPatch(sent, saved);
    const keys = Object.keys(patch) as DraftKey[];
    if (keys.length === 0) {
      onDone?.();
      return;
    }
    const parsed = profilePatchSchema.safeParse(patch);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const id = sectionForIssue(issue.path);
        if (!(id in next)) next[id] = issue.message;
      }
      setErrors(next);
      const first = PROFILE_SECTIONS.find((s) => s.id in next);
      if (first)
        document
          .getElementById(first.id)
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    setErrors({});
    mutation.mutate(patch, {
      // The server normalizes (trims, standardizes course IDs, dedupes); take its values for
      // what was sent, unless it was edited again while the save was in flight.
      onSuccess: (fresh) => {
        const normalized = toProfileDraft(fresh);
        setDraft((prev) => {
          const next = { ...prev };
          for (const key of keys) {
            if (isEqual(prev[key], sent[key]))
              (next as Record<DraftKey, unknown>)[key] = normalized[key];
          }
          return next;
        });
        onDone?.();
      },
    });
  };

  const discard = () => {
    setDraft(saved);
    setErrors({});
  };

  // Leaving through an in-app link with unsaved edits asks first, in the save bar. A capture
  // listener on document runs before React's (and so Next <Link>'s) click handlers. The browser's
  // Back button is not intercepted: the Pages Router cannot reliably cancel it.
  const router = useRouter();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const hasUnsaved = dirty.length > 0;
  useEffect(() => {
    if (!hasUnsaved) {
      setPendingHref(null);
      return;
    }
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as Element | null)?.closest?.("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target && anchor.target !== "_self") return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname) return;
      e.preventDefault();
      e.stopPropagation();
      setPendingHref(url.pathname + url.search + url.hash);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [hasUnsaved]);

  const go = (href: string) => {
    setPendingHref(null);
    void router.push(href);
  };
  const saveAndLeave = () => {
    const href = pendingHref;
    if (href) saveAll(() => go(href));
  };
  const leave = () => {
    if (!pendingHref) return;
    discard();
    go(pendingHref);
  };
  const stay = () => setPendingHref(null);

  // Reloading or closing the tab with unsaved edits asks first.
  useEffect(() => {
    if (!hasUnsaved) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasUnsaved]);

  return (
    <ProfileDraftContext.Provider
      value={{
        draft,
        update,
        errors,
        dirty,
        saveAll: () => saveAll(),
        discard,
        saving: mutation.isPending,
        pendingHref,
        saveAndLeave,
        leave,
        stay,
      }}
    >
      {children}
    </ProfileDraftContext.Provider>
  );
};

/** The Profile page's one Save: sticks to the top of the page while anything is unsaved. */
export const ProfileSaveBar = () => {
  const {
    dirty,
    errors,
    saveAll,
    discard,
    saving,
    pendingHref,
    saveAndLeave,
    leave,
    stay,
  } = useProfileDraft();
  const hasErrors = Object.keys(errors).length > 0;
  if (dirty.length === 0 && !hasErrors) return null;

  if (pendingHref)
    return (
      <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-gray-200 border-b bg-white px-4 py-3 text-sm">
        <div className={hasErrors ? "text-red-600" : "text-gray-600"}>
          {hasErrors
            ? "Fix the highlighted sections to save, or leave without saving."
            : "You have unsaved changes."}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            disabled={saving}
            onClick={saveAndLeave}
          >
            {saving ? "Saving..." : "Save and leave"}
          </button>
          <button
            type="button"
            className={SECONDARY_BUTTON_CLASS}
            disabled={saving}
            onClick={leave}
          >
            Leave without saving
          </button>
          <button
            type="button"
            className={SECONDARY_BUTTON_CLASS}
            disabled={saving}
            onClick={stay}
          >
            Stay
          </button>
        </div>
      </div>
    );

  const titles = PROFILE_SECTIONS.filter((s) => dirty.includes(s.id)).map(
    (s) => s.title
  );
  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-gray-200 border-b bg-white px-4 py-3 text-sm">
      <div className={hasErrors ? "text-red-600" : "text-gray-600"}>
        {hasErrors
          ? "Fix the highlighted sections to save."
          : `Unsaved changes: ${titles.join(", ")}`}
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          className={SECONDARY_BUTTON_CLASS}
          disabled={saving}
          onClick={discard}
        >
          Discard
        </button>
        <button
          type="button"
          className={PRIMARY_BUTTON_CLASS}
          disabled={saving || dirty.length === 0}
          onClick={saveAll}
        >
          {saving ? "Saving..." : "Save all"}
        </button>
      </div>
    </div>
  );
};
