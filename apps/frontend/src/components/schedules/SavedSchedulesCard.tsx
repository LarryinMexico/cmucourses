import React, { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import {
  CloudArrowUpIcon,
  FolderOpenIcon,
  PencilSquareIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import type { SavedSchedule, SavedScheduleInput } from "@cmucourses/profile";
import { useAppDispatch, useAppSelector } from "~/app/hooks";
import {
  selectActiveUserSchedule,
  userSchedulesSlice,
  type UserSchedule,
} from "~/app/userSchedules";
import {
  useDeleteSavedSchedule,
  useSaveSchedule,
  useSavedSchedules,
} from "~/app/api/savedSchedules";
import { sessionToString } from "~/app/utils";
import {
  INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "~/components/profile/fields";
import InlineConfirm from "~/components/InlineConfirm";
import { AuthErrorNotice } from "~/components/AuthErrorNotice";

const SUMMER_SESSIONS = ["summer one", "summer two", "summer all"] as const;

/** The builder's active schedule as the account copy would store it, or why it can't be saved yet. */
export const toSavedInput = (
  schedule: UserSchedule,
  name: string,
  /** The saved copy it came from still exists; otherwise saving creates a new one. */
  updating: boolean
): SavedScheduleInput | string => {
  const { semester, year, session } = schedule.session;
  if (semester === "" || !year) return "Pick a semester first";
  if (schedule.courses.length === 0) return "Add courses first";
  return {
    ...(updating && schedule.savedId ? { id: schedule.savedId } : {}),
    name: name.trim() || schedule.name,
    semester,
    year,
    session:
      semester === "summer"
        ? (SUMMER_SESSIONS.find((s) => s === session) ?? null)
        : null,
    courses: schedule.courses.map((courseID) => ({
      courseID,
      lecture: schedule.courseSessions[courseID]?.Lecture || null,
      section: schedule.courseSessions[courseID]?.Section || null,
    })),
  };
};

const label = (s: SavedSchedule) =>
  sessionToString({
    year: s.year,
    semester: s.semester,
    ...(s.session ? { session: s.session } : {}),
  });

const Row = ({
  schedule,
  isOpen,
}: {
  schedule: SavedSchedule;
  isOpen: boolean;
}) => {
  const dispatch = useAppDispatch();
  const save = useSaveSchedule();
  const remove = useDeleteSavedSchedule();
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(schedule.name);

  return (
    <li className="py-2 text-sm">
      {renaming ? (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate(
              {
                id: schedule.id,
                name,
                semester: schedule.semester,
                year: schedule.year,
                session: schedule.session,
                courses: schedule.courses,
              },
              {
                onSuccess: (result) => {
                  dispatch(
                    userSchedulesSlice.actions.renameSavedCopies({
                      savedId: schedule.id,
                      name: result.name,
                    })
                  );
                  setRenaming(false);
                },
              }
            );
          }}
        >
          <input
            className={`${INPUT_CLASS} min-w-0 flex-1`}
            value={name}
            aria-label="Schedule name"
            autoFocus
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setName(schedule.name);
                setRenaming(false);
              }
            }}
          />
          <button
            type="submit"
            className={PRIMARY_BUTTON_CLASS}
            disabled={save.isPending || name.trim() === ""}
          >
            Save
          </button>
          <button
            type="button"
            className={SECONDARY_BUTTON_CLASS}
            onClick={() => {
              setName(schedule.name);
              setRenaming(false);
            }}
          >
            Cancel
          </button>
        </form>
      ) : (
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <div className="truncate text-gray-700">
              {schedule.name}
              {isOpen && (
                <span className="ml-2 text-gray-400 text-xs">open</span>
              )}
            </div>
            <div className="text-gray-400 text-xs">
              {label(schedule)} · {schedule.courses.length} courses
            </div>
          </div>
          <button
            type="button"
            title="Open in the builder"
            aria-label={`Open ${schedule.name}`}
            className="rounded p-1 text-gray-500 hover:bg-gray-50"
            onClick={() =>
              dispatch(userSchedulesSlice.actions.loadSavedSchedule(schedule))
            }
          >
            <FolderOpenIcon className="h-5 w-5" />
          </button>
          <button
            type="button"
            title="Rename"
            aria-label={`Rename ${schedule.name}`}
            className="rounded p-1 text-gray-500 hover:bg-gray-50"
            onClick={() => setRenaming(true)}
          >
            <PencilSquareIcon className="h-5 w-5" />
          </button>
          <InlineConfirm
            question="Delete this saved schedule? Posts shared from it stay."
            confirmLabel="Delete"
            disabled={remove.isPending}
            onConfirm={() =>
              remove.mutate(schedule.id, {
                onSuccess: () =>
                  dispatch(
                    userSchedulesSlice.actions.clearSavedId(schedule.id)
                  ),
              })
            }
            trigger={(open) => (
              <button
                type="button"
                title="Delete"
                aria-label={`Delete ${schedule.name}`}
                className="rounded p-1 text-gray-500 hover:bg-gray-50"
                disabled={remove.isPending}
                onClick={open}
              >
                <TrashIcon className="h-5 w-5" />
              </button>
            )}
          />
        </div>
      )}
    </li>
  );
};

/** Named schedules kept on the account; the ones you can share in Scotty Circles. */
const SavedSchedulesCard = () => {
  const { isSignedIn } = useAuth();
  const dispatch = useAppDispatch();
  const active = useAppSelector(selectActiveUserSchedule);
  const { data, isPending, isError, error, refetch } = useSavedSchedules();
  const saved = data ?? [];
  const save = useSaveSchedule();
  const [name, setName] = useState("");

  if (!isSignedIn) return null;

  // Until the list is known we can't tell "update" from "save new"; guessing would make a duplicate.
  const listUnknown = !data;

  const updating =
    !!active?.savedId && saved.some((s) => s.id === active.savedId);
  const input = active
    ? toSavedInput(active, name, updating)
    : "Create a schedule first";

  return (
    <div className="mt-4">
      <div className="mb-2 text-lg">My saved schedules</div>
      <p className="mb-2 text-gray-500 text-xs">
        Saved to your account, so they follow you to any device. These are the
        schedules you can share in Scotty Circles.
      </p>
      <div className="flex gap-2">
        <input
          className={`${INPUT_CLASS} flex-1`}
          placeholder={active?.name ?? "Schedule name"}
          aria-label="Name to save as"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button
          type="button"
          className={`${PRIMARY_BUTTON_CLASS} items-center gap-1`}
          disabled={typeof input === "string" || save.isPending || listUnknown}
          title={typeof input === "string" ? input : undefined}
          onClick={() => {
            if (typeof input === "string") return;
            save.mutate(input, {
              onSuccess: (result) => {
                dispatch(
                  userSchedulesSlice.actions.setActiveScheduleSavedId(result.id)
                );
                setName("");
              },
            });
          }}
        >
          <CloudArrowUpIcon className="h-4 w-4" />
          {updating ? "Update" : "Save"}
        </button>
      </div>
      {typeof input === "string" && (
        <div className="mt-1 text-gray-400 text-xs">{input}</div>
      )}
      {updating && (
        <button
          type="button"
          className="mt-1 text-gray-500 text-xs underline"
          onClick={() =>
            dispatch(
              userSchedulesSlice.actions.setActiveScheduleSavedId(undefined)
            )
          }
        >
          Save as a new schedule instead
        </button>
      )}
      {isError ? (
        <AuthErrorNotice error={error} className="mt-2 text-sm">
          <div className="mt-2 text-gray-500 text-sm">
            Couldn&apos;t load your saved schedules.{" "}
            <button
              type="button"
              className="underline"
              onClick={() => void refetch()}
            >
              Retry
            </button>
          </div>
        </AuthErrorNotice>
      ) : isPending ? (
        <div className="mt-2 text-gray-400 text-sm">Loading…</div>
      ) : saved.length === 0 ? (
        <div className="mt-2 text-gray-400 text-sm">Nothing saved yet.</div>
      ) : (
        <ul className="mt-2 divide-y divide-gray-100">
          {saved.map((schedule) => (
            <Row
              key={schedule.id}
              schedule={schedule}
              isOpen={active?.savedId === schedule.id}
            />
          ))}
        </ul>
      )}
    </div>
  );
};

export default SavedSchedulesCard;
