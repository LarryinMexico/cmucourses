import type { NextPage } from "next";
import React from "react";
import { useRouter } from "next/router";
import { SignInButton, useAuth } from "@clerk/nextjs";
import { Profile } from "@cmucourses/profile";
import { Page } from "~/components/Page";
import Loading from "~/components/Loading";
import { useFetchProfile } from "~/app/api/profile";
import { PublicInfoSection } from "~/components/profile/PublicInfoSection";
import { AcademicSection } from "~/components/profile/AcademicSection";
import { CareersSection } from "~/components/profile/CareersSection";
import { SkillsSection } from "~/components/profile/SkillsSection";
import { WorkloadSection } from "~/components/profile/WorkloadSection";
import { TimeSection } from "~/components/profile/TimeSection";
import { CoursesSection } from "~/components/profile/CoursesSection";
import { PlanSection } from "~/components/profile/PlanSection";
import { PROFILE_SECTIONS } from "~/components/profile/completeness";
import { PRIMARY_BUTTON_CLASS } from "~/components/profile/fields";
import {
  ProfileDraftProvider,
  ProfileSaveBar,
} from "~/components/profile/ProfileDraftContext";

const Completeness = ({ profile }: { profile: Profile }) => {
  const missing = PROFILE_SECTIONS.filter(
    (section) => !section.isComplete(profile)
  );
  const done = PROFILE_SECTIONS.length - missing.length;

  return (
    <div className="text-gray-500 text-sm">
      {done} of {PROFILE_SECTIONS.length} sections complete.
      {missing.length > 0 && (
        <>
          {" "}
          Missing:{" "}
          {missing.map((section, index) => (
            <React.Fragment key={section.id}>
              {index > 0 && ", "}
              <a
                href={`#${section.id}`}
                className="text-blue-600 hover:underline"
              >
                {section.title}
              </a>
            </React.Fragment>
          ))}
        </>
      )}
    </div>
  );
};

/** Opens the first-login setup again (OnboardingModal watches `?welcome=1`). */
const WelcomeAgain = () => {
  const router = useRouter();
  return (
    <button
      type="button"
      className="mt-1 text-blue-600 text-sm hover:underline"
      onClick={() =>
        void router.replace(
          { query: { ...router.query, welcome: "1" } },
          undefined,
          { shallow: true }
        )
      }
    >
      Run the welcome setup again
    </button>
  );
};

const ProfileContent = () => {
  const { isLoaded, isSignedIn } = useAuth();
  const { data: profile, isError, refetch } = useFetchProfile();

  if (!isLoaded) return <Loading />;

  if (!isSignedIn) {
    return (
      <div className="mt-6 text-center text-gray-400">
        <p>
          Sign in to set up your profile. It keeps your goals and preferences
          across devices.
        </p>
        <div className="mt-4 inline-flex">
          <div className={PRIMARY_BUTTON_CLASS}>
            <SignInButton />
          </div>
        </div>
      </div>
    );
  }

  // A failed refetch keeps the loaded profile; only a first load that failed replaces the cards.
  if (isError && !profile) {
    return (
      <div className="mt-6 text-center text-gray-400">
        <p>We couldn&apos;t load your profile.</p>
        {process.env.NODE_ENV === "development" && (
          <p className="mt-1 text-xs">
            If this sits then fails, Atlas is likely blocking this network. Add
            your IP (or 0.0.0.0/0 for a dev cluster) under Network Access.
          </p>
        )}
        <button
          type="button"
          className="mt-2 text-blue-600 hover:underline"
          onClick={() => void refetch()}
        >
          Try again
        </button>
      </div>
    );
  }

  if (!profile) return <Loading />;

  return (
    <ProfileDraftProvider profile={profile}>
      <ProfileSaveBar />
      <div className="m-auto max-w-4xl space-y-4 p-6">
        <div>
          <h1 className="text-gray-700 text-lg">Your Profile</h1>
          <Completeness profile={profile} />
          <WelcomeAgain />
        </div>
        <PublicInfoSection />
        <AcademicSection />
        <CareersSection />
        <SkillsSection />
        <WorkloadSection />
        <TimeSection />
        <CoursesSection />
        <PlanSection />
      </div>
    </ProfileDraftProvider>
  );
};

const ProfilePage: NextPage = () => {
  return (
    <Page
      activePage="profile"
      title="Profile - CMU Courses"
      content={<ProfileContent />}
    />
  );
};

export default ProfilePage;
