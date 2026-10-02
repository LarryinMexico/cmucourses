import { timePairOverlaps, type MeetingTime } from "@cmucourses/profile";
import { Course, Schedule, Time } from "./types";
import { CourseSessions } from "./userSchedules";
import { sessionToString } from "./utils";

/** One chosen lecture or section of a course in the manual builder. */
export interface PickedMeeting {
  courseID: string;
  /** "Lec 1", "Section A", ... */
  label: string;
  times: MeetingTime[];
}

/** A clash between a course's pick and another course's pick. */
export interface Conflict {
  label: string;
  withCourseID: string;
  withLabel: string;
}

const toMeetingTimes = (times: Time[] | undefined): MeetingTime[] =>
  (times ?? []).map(({ days, begin, end }) => ({
    days: days ?? [],
    begin,
    end,
  }));

const labelFor = (kind: "Lecture" | "Section", name: string) =>
  kind === "Section" ? `Section ${name}` : name;

const scheduleIn = (course: Course, semester: string): Schedule | undefined =>
  course.schedules?.find((schedule) => sessionToString(schedule) === semester);

/** The lecture and section each course has picked for the semester, with their meeting times. */
export const pickedMeetings = (
  courses: Course[],
  selected: CourseSessions,
  semester: string
): PickedMeeting[] =>
  courses.flatMap((course) => {
    const schedule = scheduleIn(course, semester);
    const picks = selected[course.courseID];
    if (!schedule || !picks) return [];
    const lecture = schedule.lectures.find((l) => l.name === picks.Lecture);
    const section = schedule.sections.find((s) => s.name === picks.Section);
    const meetings: PickedMeeting[] = [];
    if (lecture)
      meetings.push({
        courseID: course.courseID,
        label: labelFor("Lecture", lecture.name),
        times: toMeetingTimes(lecture.times),
      });
    if (section)
      meetings.push({
        courseID: course.courseID,
        label: labelFor("Section", section.name),
        times: toMeetingTimes(section.times),
      });
    return meetings;
  });

/**
 * Which of `others` overlap `times`. Only other courses count: a course's own lecture and
 * section are meant to fit together, and the catalog often lists them over the same hours.
 * TBA times never conflict (timePairOverlaps, shared with the schedule generator).
 */
export const clashesWith = (
  courseID: string,
  times: MeetingTime[],
  others: PickedMeeting[]
): PickedMeeting[] =>
  others.filter(
    (other) =>
      other.courseID !== courseID &&
      times.some((time) => other.times.some((o) => timePairOverlaps(time, o)))
  );

/** Every course's clashes with the other courses' picks; courses without one are left out. */
export const scheduleConflicts = (
  courses: Course[],
  selected: CourseSessions,
  semester: string
): Record<string, Conflict[]> => {
  const picked = pickedMeetings(courses, selected, semester);
  const result: Record<string, Conflict[]> = {};
  for (const meeting of picked) {
    for (const other of clashesWith(meeting.courseID, meeting.times, picked)) {
      (result[meeting.courseID] ??= []).push({
        label: meeting.label,
        withCourseID: other.courseID,
        withLabel: other.label,
      });
    }
  }
  return result;
};

/**
 * The times a student would attend by choosing `name` in the selector: a section brings its
 * own lecture with it (SectionSelector picks both), a lecture-only course just the lecture.
 */
export const optionTimes = (
  schedule: Schedule,
  kind: "Lecture" | "Section",
  name: string
): MeetingTime[] => {
  if (kind === "Lecture") {
    return toMeetingTimes(
      schedule.lectures.find((l) => l.name === name)?.times
    );
  }
  const section = schedule.sections.find((s) => s.name === name);
  const lecture = schedule.lectures.find((l) => l.name === section?.lecture);
  return [...toMeetingTimes(section?.times), ...toMeetingTimes(lecture?.times)];
};

/** "Conflicts with 15-213 Lec 1 and 21-127 Section B" (one line per course in the selector). */
export const describeConflicts = (conflicts: Conflict[]): string => {
  const names = [
    ...new Set(conflicts.map((c) => `${c.withCourseID} ${c.withLabel}`)),
  ];
  if (names.length <= 1) return `Conflicts with ${names[0] ?? ""}`;
  return `Conflicts with ${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
};
