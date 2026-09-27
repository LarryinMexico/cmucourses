import { parseCatalogTime, type PostBusyBlock } from "@cmucourses/profile";
import type { ScheduleMeeting } from "./scheduleSharing";
import type { Course } from "./types";
import { sessionToString } from "./utils";

/** The week grid on Circles posts spans Mon-Fri, 8:00 to 22:00 (minutes after midnight). */
export const GRID_START = 8 * 60;
export const GRID_END = 22 * 60;
export const GRID_DAYS = [1, 2, 3, 4, 5];
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export interface GridBlock {
  kind: "class" | "busy";
  /** 1 = Monday ... 5 = Friday. */
  day: number;
  /** Percent of the grid's height. */
  top: number;
  height: number;
  title: string;
  subtitle: string | null;
  color: string | null;
  /** Side-by-side placement when blocks overlap: column `col` of `cols` (0-based). */
  col: number;
  cols: number;
}

const span = GRID_END - GRID_START;

const place = (begin: number, end: number) => {
  const from = Math.max(begin, GRID_START);
  const to = Math.min(end, GRID_END);
  if (to <= from) return null;
  return {
    top: ((from - GRID_START) / span) * 100,
    height: ((to - from) / span) * 100,
  };
};

/**
 * Positions a post's classes and busy times on the week grid. Anything that cannot be drawn (no
 * set time, a weekend, entirely outside 8:00-22:00) is listed in `offGrid` instead of dropped.
 */
export const layoutWeek = (
  meetings: ScheduleMeeting[],
  busy: PostBusyBlock[],
  colors: { [courseID: string]: string }
): { blocks: GridBlock[]; offGrid: string[] } => {
  const blocks: GridBlock[] = [];
  const offGrid: string[] = [];

  for (const meeting of meetings) {
    const name = `${meeting.courseID} ${meeting.label}`;
    const begin = parseCatalogTime(meeting.time.begin);
    const end = parseCatalogTime(meeting.time.end);
    if (begin === null || end === null) {
      offGrid.push(`${name} (time not set)`);
      continue;
    }
    for (const day of meeting.time.days) {
      const at = place(begin, end);
      if (!GRID_DAYS.includes(day) || !at) {
        offGrid.push(
          `${name} (${DAY_NAMES[day] ?? "?"} ${meeting.time.begin})`
        );
        continue;
      }
      blocks.push({
        kind: "class",
        day,
        ...at,
        title: meeting.courseID,
        subtitle: meeting.label,
        color: colors[meeting.courseID] ?? null,
        col: 0,
        cols: 1,
      });
    }
  }

  for (const block of busy) {
    const at = place(block.begin, block.end);
    if (!GRID_DAYS.includes(block.day) || !at) continue; // weekend or off-hours busy time: nothing to clash with
    blocks.push({
      kind: "busy",
      day: block.day,
      ...at,
      title: block.label ?? "Busy",
      subtitle: null,
      color: null,
      col: 0,
      cols: 1,
    });
  }

  assignColumns(blocks);
  return { blocks, offGrid };
};

/**
 * Overlapping blocks on the same day would paint over each other. Per day, blocks that overlap
 * (directly or through a chain) form a group; each takes the lowest column free at its start, and
 * every block in the group shares the group's column count.
 */
const assignColumns = (blocks: GridBlock[]) => {
  for (const day of GRID_DAYS) {
    const sorted = blocks
      .filter((b) => b.day === day)
      .sort((a, b) => a.top - b.top || b.height - a.height);
    let group: GridBlock[] = [];
    let groupEnd = -1;
    let columnEnds: number[] = [];
    const close = () => {
      for (const b of group) b.cols = columnEnds.length;
      group = [];
      columnEnds = [];
    };
    for (const block of sorted) {
      if (group.length > 0 && block.top >= groupEnd) close();
      let col = columnEnds.findIndex((end) => end <= block.top);
      if (col === -1) col = columnEnds.length;
      columnEnds[col] = block.top + block.height;
      block.col = col;
      group.push(block);
      groupEnd = Math.max(groupEnd, block.top + block.height);
    }
    if (group.length > 0) close();
  }
};

/**
 * Courses on a post that produced no meetings at all, with why, so they are named under the grid
 * instead of silently missing. A course whose details have not arrived yet is left out.
 */
export const unplacedCourses = (
  courseIDs: string[],
  details: Course[],
  semester: string,
  meetings: ScheduleMeeting[],
  notFound: string[]
): string[] =>
  courseIDs.flatMap((id) => {
    if (meetings.some((m) => m.courseID === id)) return [];
    if (notFound.includes(id)) return [`${id} (not in the catalog)`];
    const course = details.find((d) => d.courseID === id);
    if (!course) return [];
    const offered = (course.schedules ?? []).some(
      (s) => sessionToString(s) === semester
    );
    return [
      offered ? `${id} (no section picked)` : `${id} (not offered ${semester})`,
    ];
  });
