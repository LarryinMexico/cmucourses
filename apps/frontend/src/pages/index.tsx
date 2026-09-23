import type { NextPage } from "next";
import Filter from "~/components/Filter";
import Aggregate from "~/components/Aggregate";
import Topbar from "~/components/Topbar";
import SearchBar from "~/components/SearchBar";
import CourseSearchList from "~/components/CourseSearchList";
import React from "react";
import { Page } from "~/components/Page";
import { useApplyDefaultFilters } from "~/app/defaultFilters";

const IndexPage: NextPage = () => {
  useApplyDefaultFilters();
  return (
    <Page
      sidebar={
        <>
          <Filter />
          <Aggregate />
        </>
      }
      content={
        <>
          <Topbar>
            <SearchBar />
          </Topbar>
          <CourseSearchList />
        </>
      }
      activePage="search"
    />
  );
};

export default IndexPage;
