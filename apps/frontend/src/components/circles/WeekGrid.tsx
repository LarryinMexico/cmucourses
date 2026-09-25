import React, { useMemo } from "react";
import type { CirclePost } from "@cmucourses/profile";
import { useFetchCourseInfos } from "~/app/api/course";
import { meetingsForSchedule } from "~/app/scheduleSharing";
import { getCalendarColor, sessionToString } from "~/app/utils";
import { GRID_DAYS, GRID_END, GRID_START, layoutWeek } from "~/app/weekGrid";

const DAY_LABELS = ["", "Mon", "Tue", "Wed", "Thu", "Fri"];
const HOURS = Array.from(
  { length: (GRID_END - GRID_START) / 60 + 1 },
  (_, i) => GRID_START / 60 + i
);
const hourLabel = (h: number) =>
  h === 12 ? "12p" : h > 12 ? `${h - 12}p` : `${h}a`;

// Busy times are hatched so they read as "unavailable", not as another class.
const BUSY_STYLE: React.CSSProperties = {
  backgroundImage:
    "repeating-linear-gradient(135deg, rgba(107,114,128,0.18) 0 6px, rgba(107,114,128,0.08) 6px 12px)",
};

/**
 * A read-only Mon-Fri week of one post: the classes it picked and the author's busy times.
 * Course details come from the shared, batched course cache, so a feed of cards costs one request.
 */
const WeekGrid = ({ post }: { post: CirclePost }) => {
  const courseIDs = useMemo(
    () => post.courses.map((course) => course.courseID),
    [post.courses]
  );
  const details = useFetchCourseInfos(courseIDs);
  const semester = sessionToString({
    year: post.year,
    semester: post.semester,
    ...(post.session ? { session: post.session } : {}),
  });

  const { blocks, offGrid } = useMemo(() => {
    const selections = Object.fromEntries(
      post.courses.map((course) => [
        course.courseID,
        { Lecture: course.lecture ?? "", Section: course.section ?? "" },
      ])
    );
    const colors = Object.fromEntries(
      post.courses.map((course, i) => [course.courseID, getCalendarColor(i)])
    );
    return layoutWeek(
      meetingsForSchedule(semester, selections, details),
      post.busyBlocks,
      colors
    );
  }, [post.courses, post.busyBlocks, details, semester]);

  const loading = details.length < courseIDs.length;

  return (
    <div>
      <div className="flex text-gray-500 text-xs">
        <div className="w-8 shrink-0" />
        {GRID_DAYS.map((day) => (
          <div key={day} className="flex-1 text-center">
            {DAY_LABELS[day]}
          </div>
        ))}
      </div>
      <div className="relative mt-1 flex h-80 rounded border border-gray-100">
        <div className="relative w-8 shrink-0">
          {HOURS.slice(0, -1).map((h, i) => (
            <div
              key={h}
              className="absolute right-1 -translate-y-1/2 text-gray-400 text-[10px]"
              style={{ top: `${(i / (HOURS.length - 1)) * 100}%` }}
            >
              {i === 0 ? "" : hourLabel(h)}
            </div>
          ))}
        </div>
        {GRID_DAYS.map((day) => (
          <div
            key={day}
            className="relative flex-1 border-gray-100 border-l"
            aria-label={DAY_LABELS[day]}
          >
            {HOURS.slice(1, -1).map((h, i) => (
              <div
                key={h}
                className="absolute inset-x-0 border-gray-50 border-t"
                style={{ top: `${((i + 1) / (HOURS.length - 1)) * 100}%` }}
              />
            ))}
            {blocks
              .filter((block) => block.day === day)
              .map((block, i) => (
                <div
                  key={i}
                  title={`${block.title}${block.subtitle ? ` ${block.subtitle}` : ""}`}
                  className={
                    block.kind === "busy"
                      ? "absolute inset-x-0.5 overflow-hidden rounded px-1 text-gray-600 text-[10px] leading-tight"
                      : "nightwind-prevent absolute inset-x-0.5 overflow-hidden rounded px-1 text-[10px] leading-tight shadow-sm"
                  }
                  style={{
                    top: `${block.top}%`,
                    height: `${block.height}%`,
                    ...(block.kind === "busy"
                      ? BUSY_STYLE
                      : {
                          backgroundColor: block.color ?? "#E5E7EB",
                          color: "#374151",
                        }),
                  }}
                >
                  <div className="truncate font-semibold">{block.title}</div>
                  {block.subtitle && (
                    <div className="truncate">{block.subtitle}</div>
                  )}
                </div>
              ))}
          </div>
        ))}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/60 text-gray-400 text-xs">
            Loading schedule…
          </div>
        )}
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-3 text-gray-500 text-xs">
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded" style={BUSY_STYLE} />
          Busy
        </span>
        {offGrid.length > 0 && (
          <span>Not on the grid: {offGrid.join(", ")}</span>
        )}
      </div>
    </div>
  );
};

export default WeekGrid;
