import { courseMatchesClientFilters } from "./courseFilterPredicates";
import type { Course } from "./types";

const course = (building = "WEH"): Course => ({
  courseID: "15-213",
  name: "Introduction to Computer Systems",
  desc: "",
  department: "Computer Science",
  units: "12",
  prereqs: [],
  prereqString: "",
  coreqs: [],
  crosslisted: [],
  schedules: [
    {
      courseID: "15-213",
      year: "2026",
      semester: "fall",
      lectures: [
        {
          name: "Lec 1",
          instructors: [],
          location: "Pittsburgh",
          times: [
            {
              days: [1, 3],
              begin: "10:00AM",
              end: "10:50AM",
              building,
              room: "7500",
            },
          ],
        },
      ],
      sections: [],
    },
  ],
});

describe("courseMatchesClientFilters", () => {
  test("matches allowed days and an exact time window", () => {
    expect(
      courseMatchesClientFilters(
        course(),
        { meetingDays: [1, 3], timeRange: { begin: 9 * 60, end: 12 * 60 } },
        []
      )
    ).toBe(true);
    expect(
      courseMatchesClientFilters(course(), { meetingDays: [2, 4] }, [])
    ).toBe(false);
  });

  test("Monday-only keeps Mon+Wed meetings (any-day match)", () => {
    expect(
      courseMatchesClientFilters(course(), { meetingDays: [1] }, [])
    ).toBe(true);
  });

  test("fit availability with no busy blocks does not hide courses", () => {
    expect(
      courseMatchesClientFilters(course(), { fitAvailability: true }, [])
    ).toBe(true);
  });

  test("filters to courses that fit saved availability", () => {
    expect(
      courseMatchesClientFilters(course(), { fitAvailability: true }, [
        { day: 1, begin: 8 * 60, end: 9 * 60, label: null },
      ])
    ).toBe(true);
    expect(
      courseMatchesClientFilters(course(), { fitAvailability: true }, [
        { day: 1, begin: 10 * 60, end: 11 * 60, label: null },
        { day: 3, begin: 10 * 60, end: 11 * 60, label: null },
      ])
    ).toBe(false);
  });

  test("scopes to Offered-in sessions when provided", () => {
    const withOld = course();
    withOld.schedules = [
      {
        courseID: "15-213",
        year: "2020",
        semester: "fall",
        lectures: [
          {
            name: "Lec 1",
            instructors: [],
            location: "Pittsburgh",
            times: [
              {
                days: [1],
                begin: "10:00AM",
                end: "10:50AM",
                building: "WEH",
                room: "1",
              },
            ],
          },
        ],
        sections: [],
      },
      ...(withOld.schedules || []),
    ];
    expect(
      courseMatchesClientFilters(
        withOld,
        {
          meetingDays: [1],
          sessions: [{ year: "2026", semester: "fall" }],
        },
        []
      )
    ).toBe(true);
    expect(
      courseMatchesClientFilters(
        withOld,
        {
          meetingDays: [1],
          sessions: [{ year: "2021", semester: "fall" }],
        },
        []
      )
    ).toBe(false);
  });
});
