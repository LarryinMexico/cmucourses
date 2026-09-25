import React, { useEffect, useState } from "react";
import { emptyProfile, LIMITS } from "@cmucourses/profile";
import { useAppDispatch, useAppSelector } from "~/app/hooks";
import { useFetchCourseInfos } from "~/app/api/course";
import { useFetchProfile } from "~/app/api/profile";
import {
  selectActiveUserSchedule,
  selectCourseSessionsInActiveSchedule,
  selectCoursesInActiveSchedule,
  selectSessionInActiveSchedule,
  userSchedulesSlice,
} from "~/app/userSchedules";
import {
  buildGeneratorInput,
  candidateToCourseSessions,
  generateCandidates,
  standaloneSectionKeys,
  MAX_POOL,
  plannedCourseIDsForSession,
  poolCourseIDs,
  ScheduleCandidate,
  SectionRef,
} from "~/app/scheduleGenerator";
import {
  INPUT_CLASS,
  OptionalNumberInput,
  Pill,
  PRIMARY_BUTTON_CLASS,
} from "~/components/profile/fields";
import CandidateCard, { sameRef } from "./CandidateCard";

const describeRef = (ref: SectionRef) =>
  `${ref.courseID} ${ref.lecture}${ref.section ? ` / ${ref.section}` : ""}`;

/**
 * Builds up to 3 candidate schedules from the courses already added to the active schedule (see
 * ScheduleSearch), for whichever semester is picked in SectionSelector's dropdown. "Use this
 * schedule" fills in the same courseSessions state SectionSelector's manual radio buttons would.
 * Picks can be locked (kept) or excluded (never chosen) and the run repeated; that refinement,
 * the option count and the units range are local to this panel and never written to the profile.
 * Saved and planned courses can be added as a pool: the generator then chooses which of them to
 * add so the total fits the units range, and "Use this schedule" adds the chosen ones.
 */
const GeneratePanel = () => {
  const dispatch = useAppDispatch();
  const scheduled = useAppSelector(selectCoursesInActiveSchedule);
  const selectedSession = useAppSelector(selectSessionInActiveSchedule);
  const scheduledKey = scheduled.join(",");
  const courseDetails = useFetchCourseInfos(scheduled);
  const currentSessions = useAppSelector(selectCourseSessionsInActiveSchedule);
  const generatedMeta = useAppSelector(selectActiveUserSchedule)?.generated;
  const [appliedIndex, setAppliedIndex] = useState<number | null>(null);
  const { data: profile } = useFetchProfile();
  const saved = useAppSelector((state) => state.user.bookmarked);
  const [includeSaved, setIncludeSaved] = useState(false);
  const [includePlanned, setIncludePlanned] = useState(false);
  const [candidates, setCandidates] = useState<ScheduleCandidate[] | null>(
    null
  );
  const [locks, setLocks] = useState<SectionRef[]>([]);
  const [excluded, setExcluded] = useState<SectionRef[]>([]);
  const [maxCandidates, setMaxCandidates] = useState(3);
  // null = follow the profile's units range; set once the student edits it here.
  const [unitsRange, setUnitsRange] = useState<{
    min: number | null;
    max: number | null;
  } | null>(null);
  const shownUnits = unitsRange ?? {
    min: profile?.workload?.unitsMin ?? null,
    max: profile?.workload?.unitsMax ?? null,
  };

  const plannedIDs = plannedCourseIDsForSession(
    profile?.plannedCourses ?? [],
    selectedSession
  );
  const notScheduled = (ids: string[]) =>
    ids.filter((id) => !scheduled.includes(id));
  const pool = poolCourseIDs({
    saved,
    planned: plannedIDs,
    scheduled,
    includeSaved,
    includePlanned,
  });
  const poolKey = pool.ids.join(",");
  const poolDetails = useFetchCourseInfos(pool.ids);

  // Every course's catalog data must be in before generating: a course whose info has not
  // arrived would look like one with no schedule and be left out.
  const loading =
    courseDetails.length < scheduled.length ||
    poolDetails.length < pool.ids.length;

  // Drop stale options when the semester, course list or pool changes.
  useEffect(() => {
    setCandidates(null);
    setAppliedIndex(null);
  }, [selectedSession, scheduledKey, poolKey]);

  // Section names only mean something within one semester's schedule, so a new semester clears
  // every lock and exclusion. Removing a course only drops that course's.
  useEffect(() => {
    setLocks([]);
    setExcluded([]);
  }, [selectedSession]);
  useEffect(() => {
    const kept = new Set(scheduledKey.split(","));
    setLocks((prev) => prev.filter((ref) => kept.has(ref.courseID)));
    setExcluded((prev) => prev.filter((ref) => kept.has(ref.courseID)));
  }, [scheduledKey]);

  const generate = () => {
    const input = buildGeneratorInput(
      scheduled,
      [...courseDetails, ...poolDetails],
      selectedSession,
      profile ?? emptyProfile(),
      {
        locks,
        excluded,
        maxCandidates,
        poolIDs: pool.ids,
        unitsRange: unitsRange ?? undefined,
      }
    );
    setCandidates(generateCandidates(input));
    setAppliedIndex(null);
  };

  // One lock per course: locking another pick of the same course replaces the first.
  const toggleLock = (ref: SectionRef) =>
    setLocks((prev) =>
      prev.some((lock) => sameRef(lock, ref))
        ? prev.filter((lock) => !sameRef(lock, ref))
        : [...prev.filter((lock) => lock.courseID !== ref.courseID), ref]
    );

  const exclude = (ref: SectionRef) => {
    setLocks((prev) => prev.filter((lock) => !sameRef(lock, ref)));
    setExcluded((prev) =>
      prev.some((item) => sameRef(item, ref)) ? prev : [...prev, ref]
    );
  };

  const applyCandidate = (candidate: ScheduleCandidate, index: number) => {
    // Pool courses the candidate chose are not in the schedule yet; give them an entry to fill.
    const base = { ...currentSessions };
    for (const pick of candidate.picks) {
      if (!base[pick.courseID])
        base[pick.courseID] = { Lecture: "", Section: "", Color: "" };
    }
    const courseSessions = candidateToCourseSessions(
      base,
      candidate.picks,
      standaloneSectionKeys([...courseDetails, ...poolDetails], selectedSession)
    );
    // Only the placed courses are sent; everything else keeps the student's own choice.
    const placed = Object.fromEntries(
      candidate.picks.map((pick) => [
        pick.courseID,
        courseSessions[pick.courseID]!,
      ])
    );
    dispatch(
      userSchedulesSlice.actions.applyGeneratedSchedule({
        courseSessions: placed,
        addCourses: candidate.picks
          .map((pick) => pick.courseID)
          .filter((id) => !scheduled.includes(id)),
        generated: {
          option: index + 1,
          score: candidate.totalScore,
          reasons: candidate.reasons,
        },
      })
    );
    setAppliedIndex(index);
  };

  return (
    <div className="mt-4">
      <div className="mb-2 text-lg">Generate</div>
      {scheduled.length === 0 ? (
        <div className="text-gray-400 text-sm">
          Add courses above to generate schedules.
        </div>
      ) : selectedSession === "" ? (
        <div className="text-gray-400 text-sm">
          Pick a semester in the Semester dropdown above first.
        </div>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-baseline gap-2 text-gray-500 text-sm">
            <label htmlFor="generate-count">Options</label>
            <select
              id="generate-count"
              className={INPUT_CLASS}
              value={maxCandidates}
              onChange={(e) => setMaxCandidates(parseInt(e.target.value))}
            >
              {[1, 2, 3].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <span className="ml-2">Units</span>
            <OptionalNumberInput
              value={shownUnits.min}
              min={0}
              max={LIMITS.units}
              onChange={(min) => setUnitsRange({ ...shownUnits, min })}
            />
            <span>to</span>
            <OptionalNumberInput
              value={shownUnits.max}
              min={0}
              max={LIMITS.units}
              onChange={(max) => setUnitsRange({ ...shownUnits, max })}
            />
          </div>
          <div className="mb-3 space-y-1 text-gray-500 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={includeSaved}
                onChange={(e) => setIncludeSaved(e.target.checked)}
              />
              Also consider my Saved courses ({notScheduled(saved).length})
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={includePlanned}
                onChange={(e) => setIncludePlanned(e.target.checked)}
              />
              Also consider courses planned for this semester (
              {notScheduled(plannedIDs).length})
            </label>
            {pool.cut > 0 && (
              <div className="text-gray-400 text-xs">
                Only {MAX_POOL} are considered; {pool.cut} left out.
              </div>
            )}
            {pool.ids.length > 0 &&
              shownUnits.min === null &&
              shownUnits.max === null && (
                <div className="text-gray-400 text-xs">
                  Set a units range above so the generator can choose which of
                  these to add.
                </div>
              )}
          </div>
          {(locks.length > 0 || excluded.length > 0) && (
            <div className="mb-3 flex flex-wrap gap-2 text-sm">
              {locks.map((ref) => (
                <Pill
                  key={`lock-${describeRef(ref)}`}
                  label={`Keep ${describeRef(ref)}`}
                  onRemove={() => toggleLock(ref)}
                />
              ))}
              {excluded.map((ref) => (
                <Pill
                  key={`exclude-${describeRef(ref)}`}
                  label={`Never ${describeRef(ref)}`}
                  onRemove={() =>
                    setExcluded((prev) =>
                      prev.filter((item) => !sameRef(item, ref))
                    )
                  }
                />
              ))}
            </div>
          )}
          <button
            type="button"
            className={`${PRIMARY_BUTTON_CLASS} w-full`}
            onClick={generate}
            disabled={loading}
          >
            {loading
              ? "Loading course data…"
              : candidates
                ? "Regenerate"
                : "Generate Schedules"}
          </button>
        </>
      )}
      {candidates && (
        <div className="mt-4 space-y-4">
          {candidates.length === 0 ? (
            <div className="text-gray-400 text-sm">
              {locks.length > 0
                ? "No conflict-free schedule exists with the locked picks. Try unlocking one."
                : "No conflict-free schedule exists for these courses. Try changing the course list or semester."}
            </div>
          ) : (
            candidates.map((candidate, index) => (
              <CandidateCard
                key={index}
                candidate={candidate}
                index={index}
                locks={locks}
                onToggleLock={toggleLock}
                onExclude={exclude}
                inUse={
                  appliedIndex === index && generatedMeta?.option === index + 1
                }
                unplaced={scheduled.filter(
                  (id) => !candidate.picks.some((pick) => pick.courseID === id)
                )}
                semester={selectedSession}
                onUse={() => applyCandidate(candidate, index)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default GeneratePanel;
