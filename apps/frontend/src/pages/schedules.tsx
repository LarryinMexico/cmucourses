import { NextPage } from "next";
import React, { useState } from "react";
import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/24/outline";
import Aggregate from "~/components/Aggregate";
import Topbar from "~/components/Topbar";
import { useAppSelector } from "~/app/hooks";
import ScheduleSelector from "~/components/ScheduleSelector";
import CourseList from "~/components/CourseList";
import ScheduleSearch from "~/components/ScheduleSearch";
import ScheduleData from "~/components/ScheduleData";
import { selectCoursesInActiveSchedule } from "~/app/userSchedules";
import { Page } from "~/components/Page";
import Loading from "~/components/Loading";
import ShowFilter from "~/components/ShowFilter";
import ScheduleCalendar from "~/components/ScheduleCalendar";
import SectionSelector from "~/components/SectionSelector";
import SavedSchedulesCard from "~/components/schedules/SavedSchedulesCard";
import GeneratePanel from "~/components/schedules/GeneratePanel";
import { CAL_VIEW, SCHED_VIEW } from "~/app/constants";

/** FCE aggregation and card display settings: rarely changed, so folded away by default. */
const DisplayOptions = () => {
  const [open, setOpen] = useState(false);
  const Icon = open ? ChevronUpIcon : ChevronDownIcon;
  return (
    <div className="mt-4">
      <button
        type="button"
        aria-expanded={open}
        className="flex w-full items-center justify-between text-gray-700 text-lg"
        onClick={() => setOpen(!open)}
      >
        Display options
        <Icon className="h-5 w-5" />
      </button>
      {open && (
        <div className="mt-2 space-y-4">
          <Aggregate />
          <ShowFilter />
        </div>
      )}
    </div>
  );
};

const SchedulePage: NextPage = () => {
  const scheduled = useAppSelector(selectCoursesInActiveSchedule);
  const scheduleView = useAppSelector((state) => state.user.scheduleView);
  return (
    <Page
      activePage={"schedules"}
      content={
        <>
          <Topbar>
            <ScheduleSearch />
            <ScheduleData scheduled={scheduled} />
          </Topbar>
          {scheduleView === SCHED_VIEW && (
            <CourseList courseIDs={scheduled}>
              {/* This are the elements to show when we have no results to show. */}
              {scheduled.length ? ( // We have things in our schedule, but have no results => still loading
                <Loading />
              ) : (
                // We haven't added anything to the schedule yet
                <div className="mt-6 text-center text-gray-400">
                  Nothing in your schedule yet!
                </div>
              )}
            </CourseList>
          )}
          {scheduleView === CAL_VIEW &&
            (scheduled.length ? (
              <ScheduleCalendar courseIDs={scheduled} />
            ) : (
              <div className="mt-8 text-center text-gray-400">
                Nothing in your schedule yet!
              </div>
            ))}
        </>
      }
      sidebar={
        <>
          {/* Pick a semester and sections, then generate, then keep: in the order they're used. */}
          <ScheduleSelector />
          <DisplayOptions />
          <SectionSelector courseIDs={scheduled} />
          <GeneratePanel />
          <SavedSchedulesCard />
        </>
      }
    />
  );
};

export default SchedulePage;
