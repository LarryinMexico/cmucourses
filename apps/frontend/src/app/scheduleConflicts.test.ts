import {
  describeConflicts,
  optionTimes,
  scheduleConflicts,
} from "./scheduleConflicts";
import { Course, Schedule, Time } from "./types";
import { CourseSessions } from "./userSchedules";

const t = (days: number[], begin: string, end: string): Time => ({
  days,
  begin,
  end,
  building: "",
  room: "",
});

const lesson = (name: string, times: Time[]) => ({
  name,
  times,
  instructors: [],
  location: "",
});

const course = (
  courseID: string,
  lectures: { name: string; times: Time[] }[],
  sections: { name: string; lecture: string; times: Time[] }[] = []
): Course =>
  ({
    courseID,
    schedules: [
      {
        courseID,
        year: "2026",
        semester: "fall",
        lectures: lectures.map((l) => lesson(l.name, l.times)),
        sections: sections.map((s) => ({
          ...lesson(s.name, s.times),
          lecture: s.lecture,
        })),
      } as unknown as Schedule,
    ],
  }) as unknown as Course;

const SEMESTER = "Fall 2026";

const picks = (
  entries: Record<string, { Lecture?: string; Section?: string }>
): CourseSessions =>
  Object.fromEntries(
    Object.entries(entries).map(([id, p]) => [id, { ...p, Color: "" }])
  ) as CourseSessions;

describe("scheduleConflicts", () => {
  const a = course("15-122", [
    { name: "Lec 1", times: [t([1, 3], "09:00AM", "10:20AM")] },
  ]);
  const b = course("21-127", [
    { name: "Lec 1", times: [t([3], "10:00AM", "10:50AM")] },
    { name: "Lec 2", times: [t([3], "10:20AM", "11:10AM")] },
  ]);

  test("reports an overlap on both courses", () => {
    const result = scheduleConflicts(
      [a, b],
      picks({ "15-122": { Lecture: "Lec 1" }, "21-127": { Lecture: "Lec 1" } }),
      SEMESTER
    );
    expect(result["15-122"]).toEqual([
      { label: "Lec 1", withCourseID: "21-127", withLabel: "Lec 1" },
    ]);
    expect(result["21-127"]).toHaveLength(1);
  });

  test("back-to-back is not a conflict", () => {
    const result = scheduleConflicts(
      [a, b],
      picks({ "15-122": { Lecture: "Lec 1" }, "21-127": { Lecture: "Lec 2" } }),
      SEMESTER
    );
    expect(result).toEqual({});
  });

  test("TBA never conflicts", () => {
    const tba = course("99-999", [
      { name: "Lec", times: [t([1, 3], "TBA", "TBA")] },
    ]);
    const result = scheduleConflicts(
      [a, tba],
      picks({ "15-122": { Lecture: "Lec 1" }, "99-999": { Lecture: "Lec" } }),
      SEMESTER
    );
    expect(result).toEqual({});
  });

  test("a course's own lecture and section never conflict", () => {
    const own = course(
      "15-213",
      [{ name: "Lec 1", times: [t([2], "02:00PM", "03:50PM")] }],
      [{ name: "A", lecture: "Lec 1", times: [t([2], "02:00PM", "04:50PM")] }]
    );
    const result = scheduleConflicts(
      [own],
      picks({ "15-213": { Lecture: "Lec 1", Section: "A" } }),
      SEMESTER
    );
    expect(result).toEqual({});
  });

  test("a section clashing with another course names the section", () => {
    const own = course(
      "15-213",
      [{ name: "Lec 1", times: [t([2], "02:00PM", "03:20PM")] }],
      [{ name: "A", lecture: "Lec 1", times: [t([3], "09:30AM", "10:20AM")] }]
    );
    const result = scheduleConflicts(
      [a, own],
      picks({
        "15-122": { Lecture: "Lec 1" },
        "15-213": { Lecture: "Lec 1", Section: "A" },
      }),
      SEMESTER
    );
    expect(result["15-213"]).toEqual([
      { label: "Section A", withCourseID: "15-122", withLabel: "Lec 1" },
    ]);
  });

  test("only the selected semester counts", () => {
    const result = scheduleConflicts(
      [a, b],
      picks({ "15-122": { Lecture: "Lec 1" }, "21-127": { Lecture: "Lec 1" } }),
      "Spring 2026"
    );
    expect(result).toEqual({});
  });
});

describe("optionTimes", () => {
  test("a section brings its lecture's times", () => {
    const own = course(
      "15-213",
      [{ name: "Lec 1", times: [t([2], "02:00PM", "03:20PM")] }],
      [{ name: "A", lecture: "Lec 1", times: [t([3], "09:30AM", "10:20AM")] }]
    );
    expect(optionTimes(own.schedules![0]!, "Section", "A")).toHaveLength(2);
  });
});

describe("describeConflicts", () => {
  test("joins distinct courses", () => {
    expect(
      describeConflicts([
        { label: "Lec 1", withCourseID: "15-122", withLabel: "Lec 1" },
        { label: "Section A", withCourseID: "15-122", withLabel: "Lec 1" },
        { label: "Lec 1", withCourseID: "21-127", withLabel: "Section B" },
      ])
    ).toBe("Conflicts with 15-122 Lec 1 and 21-127 Section B");
  });
});
