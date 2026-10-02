import type { NextPage } from "next";
import React from "react";
import CourseList from "~/components/CourseList";
import Aggregate from "~/components/Aggregate";
import ShowFilter from "~/components/ShowFilter";
import { useSavedCourses } from "~/app/savedCourses";
import { Page } from "~/components/Page";

const SavedPage: NextPage = () => {
  const { saved } = useSavedCourses();

  return (
    <Page
      activePage="saved"
      sidebar={
        <>
          <Aggregate />
          <ShowFilter />
        </>
      }
      content={
        <CourseList courseIDs={saved}>
          <div className="mt-6 text-center text-gray-400">
            Nothing saved yet!
          </div>
        </CourseList>
      }
    />
  );
};

export default SavedPage;
