import React, { useEffect, useState } from "react";
import { emptyProfile, LIMITS } from "@cmucourses/profile";
import { useAppDispatch, useAppSelector } from "~/app/hooks";
import { useFetchCourseInfos } from "~/app/api/course";
import { useFetchProfile } from "~/app/api/profile";
import {
  selectCoursesInActiveSchedule,
  selectSessionInActiveSchedule,
  userSchedulesSlice,
} from "~/app/userSchedules";
import {
  buildGeneratorInput,
  generateCandidates,
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
 */
const GeneratePanel = () => {
  const dispatch = useAppDispatch();
  const scheduled = useAppSelector(selectCoursesInActiveSchedule);
  const selectedSession = useAppSelector(selectSessionInActiveSchedule);
  const scheduledKey = scheduled.join(",");
  const courseDetails = useFetchCourseInfos(scheduled);
  const { data: profile } = useFetchProfile();
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

  // Drop stale options when the semester or course list changes.
  useEffect(() => {
    setCandidates(null);
  }, [selectedSession, scheduledKey]);

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
      courseDetails,
      selectedSession,
      profile ?? emptyProfile(),
      {
        locks,
        excluded,
        maxCandidates,
        unitsRange: unitsRange ?? undefined,
      }
    );
    setCandidates(generateCandidates(input));
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

  const applyCandidate = (candidate: ScheduleCandidate) => {
    dispatch(userSchedulesSlice.actions.setActiveScheduleCourses(scheduled));
    const picked = new Set(candidate.picks.map((pick) => pick.courseID));
    // Clear leftover lecture/section picks from a previous semester for courses not in this result.
    for (const courseID of scheduled) {
      if (picked.has(courseID)) continue;
      dispatch(
        userSchedulesSlice.actions.updateActiveScheduleCourseSession({
          courseID,
          sessionType: "Lecture",
          session: "",
        })
      );
      dispatch(
        userSchedulesSlice.actions.updateActiveScheduleCourseSession({
          courseID,
          sessionType: "Section",
          session: "",
        })
      );
    }
    for (const pick of candidate.picks) {
      dispatch(
        userSchedulesSlice.actions.updateActiveScheduleCourseSession({
          courseID: pick.courseID,
          sessionType: "Lecture",
          session: pick.lecture,
        })
      );
      dispatch(
        userSchedulesSlice.actions.updateActiveScheduleCourseSession({
          courseID: pick.courseID,
          sessionType: "Section",
          session: pick.section || "",
        })
      );
    }
    dispatch(
      userSchedulesSlice.actions.setActiveScheduleGeneratedMeta({
        score: candidate.totalScore,
        reasons: candidate.reasons,
      })
    );
    setCandidates(null);
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
          >
            {candidates ? "Regenerate" : "Generate Schedules"}
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
                onUse={() => applyCandidate(candidate)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default GeneratePanel;
