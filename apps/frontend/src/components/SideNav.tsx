import {
  AcademicCapIcon,
  BriefcaseIcon,
  ChatBubbleBottomCenterTextIcon,
  ClockIcon,
  MagnifyingGlassIcon,
  StarIcon,
  UserCircleIcon,
  BookOpenIcon,
  CalendarDaysIcon,
  IdentificationIcon,
  UserGroupIcon,
} from "@heroicons/react/24/outline";
import React from "react";
import Link from "next/link";

const SideNavItem = ({
  icon,
  text,
  link,
  newTab = false,
  active = false,
  isNew = false,
}: {
  icon: React.ComponentType<{ className: string }>;
  text: string;
  link: string;
  newTab?: boolean;
  active?: boolean;
  /** Pages this fork added or substantially extended; they hover red so a demo can point them out. */
  isNew?: boolean;
}) => {
  const Icon = icon;

  const contents = (
    <div className="group flex cursor-pointer flex-col items-center lg:flex-row">
      <div className="flex">
        <Icon
          className={`h-7 w-7 lg:h-6 lg:w-6 ${
            isNew ? "group-hover:stroke-red-500" : "group-hover:stroke-blue-500"
          } ${
            !active
              ? "stroke-gray-500"
              : isNew
                ? "stroke-red-600"
                : "stroke-blue-600"
          }`}
        />
      </div>
      <div
        className={`${
          !active ? "text-gray-500" : isNew ? "text-red-600" : "text-blue-600"
        } ${
          isNew ? "group-hover:text-red-500" : "group-hover:text-blue-500"
        } text-xs lg:ml-2 lg:text-lg`}
      >
        {text}
      </div>
    </div>
  );

  if (link && !newTab) return <Link href={link}>{contents}</Link>;
  else
    return (
      <a href={link} target="_blank" rel="noreferrer">
        {contents}
      </a>
    );
};

export const SideNav = ({ activePage }: { activePage?: string }) => {
  return (
    <div className="bg-white border-gray-100 flex flex-row justify-between shrink-0 gap-x-3 gap-y-10 overflow-auto border-r px-6 py-6 md:flex-col md:justify-start lg:items-start lg:gap-y-6 lg:pr-10 lg:pl-6">
      <SideNavItem
        icon={MagnifyingGlassIcon}
        text="Search"
        link="/"
        active={activePage === "search"}
      />
      <SideNavItem
        icon={StarIcon}
        text="Saved"
        link="/saved"
        active={activePage === "saved"}
      />
      <SideNavItem
        icon={ClockIcon}
        text="Schedules"
        link="/schedules"
        active={activePage === "schedules"}
        isNew
      />
      <SideNavItem
        icon={UserCircleIcon}
        text="Instructors"
        link="/instructors"
        active={activePage === "instructors"}
      />
      <SideNavItem
        icon={BookOpenIcon}
        text="Geneds"
        link="/geneds"
        active={activePage === "geneds"}
      />
      <SideNavItem
        icon={CalendarDaysIcon}
        text="Finals"
        link="/finals"
        active={activePage === "finals"}
      />
      <SideNavItem
        icon={BriefcaseIcon}
        text="Careers"
        link="/careers"
        active={activePage === "careers"}
        isNew
      />
      <SideNavItem
        icon={AcademicCapIcon}
        text="Requirements"
        link="/requirements"
        active={activePage === "requirements"}
        isNew
      />
      <SideNavItem
        icon={UserGroupIcon}
        text="Circles"
        link="/circles"
        active={activePage === "circles"}
        isNew
      />
      <SideNavItem
        icon={ChatBubbleBottomCenterTextIcon}
        text="Feedback"
        link="https://forms.gle/6vPTN6Eyqd1w7pqJA"
        newTab
        active={false}
      />
      <SideNavItem
        icon={IdentificationIcon}
        text="Profile"
        link="/profile"
        active={activePage === "profile"}
        isNew
      />
    </div>
  );
};
