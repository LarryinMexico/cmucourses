// Declarations for dependencies that ship no types of their own.

declare module "namecase" {
  /** Capitalizes a personal name, handling Mc/Mac/O'/van-style prefixes. */
  const namecase: (name: string) => string;
  export default namecase;
}

// @types/react-big-calendar covers the package entry point but none of the
// lib/ internals ScheduleCalendar builds its custom week view on.
declare module "react-big-calendar/lib/TimeGrid" {
  import { ComponentType, CSSProperties } from "react";
  import { DateLocalizer } from "react-big-calendar";

  interface TimeGridProps {
    date: Date;
    localizer: DateLocalizer;
    range: Date[];
    eventOffset?: number;
    max?: Date;
    min?: Date;
    scrollToTime?: Date;
    style?: CSSProperties;
    // The week view forwards whatever else react-big-calendar passes down.
    [prop: string]: unknown;
  }

  const TimeGrid: ComponentType<TimeGridProps>;
  export default TimeGrid;
}

declare module "react-big-calendar/lib/Toolbar" {
  import { Component } from "react";
  import { Event, ToolbarProps } from "react-big-calendar";

  export default class Toolbar<
    TEvent extends object = Event,
    TResource extends object = object
  > extends Component<ToolbarProps<TEvent, TResource>> {}
}
