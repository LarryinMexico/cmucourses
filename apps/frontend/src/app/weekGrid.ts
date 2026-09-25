import { parseCatalogTime, type PostBusyBlock } from "@cmucourses/profile";
import type { ScheduleMeeting } from "./scheduleSharing";

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
    });
  }

  return { blocks, offGrid };
};
