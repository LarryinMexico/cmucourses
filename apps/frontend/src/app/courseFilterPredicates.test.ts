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
    expect(courseMatchesClientFilters(course(), { meetingDays: [1] }, [])).toBe(
      true
    );
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

  describe("summer sub-sessions", () => {
    const summer = (): Course => {
      const base = course();
      const lecture = (name: string, day: number) => ({
        name,
        instructors: [],
        location: "Pittsburgh",
        times: [
          {
            days: [day],
            begin: "10:00AM",
            end: "10:50AM",
            building: "WEH",
            room: "1",
          },
        ],
      });
      base.schedules = [
        {
          courseID: "15-213",
          year: "2026",
          semester: "summer",
          session: "summer one",
          lectures: [lecture("Lec 1", 1)],
          sections: [],
        },
        {
          courseID: "15-213",
          year: "2026",
          semester: "summer",
          session: "summer two",
          lectures: [lecture("Lec 1", 2)],
          sections: [],
        },
      ];
      return base;
    };
    const monday = { meetingDays: [1] };
    const tuesday = { meetingDays: [2] };

    it("a chosen sub-session only looks at that sub-session", () => {
      const one = [
        {
          year: "2026",
          semester: "summer" as const,
          session: "summer one" as const,
        },
      ];
      expect(
        courseMatchesClientFilters(summer(), { ...monday, sessions: one }, [])
      ).toBe(true);
      expect(
        courseMatchesClientFilters(summer(), { ...tuesday, sessions: one }, [])
      ).toBe(false);
    });

    it("a plain Summer choice covers every sub-session", () => {
      const any = [{ year: "2026", semester: "summer" as const }];
      expect(
        courseMatchesClientFilters(summer(), { ...monday, sessions: any }, [])
      ).toBe(true);
      expect(
        courseMatchesClientFilters(summer(), { ...tuesday, sessions: any }, [])
      ).toBe(true);
    });
  });
});
