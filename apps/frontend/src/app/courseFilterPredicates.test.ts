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

describe("catalog filters for Match-my-goals lists", () => {
  const match = (over: Partial<Course>, filters: object) =>
    courseMatchesClientFilters({ ...course(), ...over }, filters, []);

  it("departments: the course's department must be chosen", () => {
    expect(match({}, { departments: ["Computer Science"] })).toBe(true);
    expect(match({}, { departments: ["Mathematical Sciences"] })).toBe(false);
  });

  it("levels: the hundreds digit of the course number", () => {
    expect(match({}, { levels: [2] })).toBe(true);
    expect(match({}, { levels: [1, 3] })).toBe(false);
  });

  it("units: a single value, any value of a range or list, and variable units", () => {
    const range = { units: { min: 9, max: 12 } };
    expect(match({ units: "12" }, range)).toBe(true);
    expect(match({ units: "6" }, range)).toBe(false);
    expect(match({ units: "1-12" }, range)).toBe(true);
    expect(match({ units: "3,5,9" }, range)).toBe(true);
    expect(match({ units: "3,5" }, range)).toBe(false);
    expect(match({ units: "VAR" }, range)).toBe(true);
  });

  it("classTimes: buckets by begin time, tba for an untimed meeting", () => {
    expect(match({}, { classTimes: ["morning"] })).toBe(true);
    expect(match({}, { classTimes: ["afternoon", "evening"] })).toBe(false);
    const tba = course();
    tba.schedules![0]!.lectures[0]!.times[0]!.begin = "TBA";
    tba.schedules![0]!.lectures[0]!.times[0]!.end = "TBA";
    expect(courseMatchesClientFilters(tba, { classTimes: ["tba"] }, [])).toBe(
      true
    );
    expect(
      courseMatchesClientFilters(tba, { classTimes: ["morning"] }, [])
    ).toBe(false);
  });
});
