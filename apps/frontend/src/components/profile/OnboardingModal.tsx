import React, { Fragment, useEffect, useState } from "react";
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import { useAuth } from "@clerk/nextjs";
import { Academic } from "@cmucourses/profile";
import { useFetchProfile, useUpdateProfile } from "~/app/api/profile";
import { AcademicFields } from "./AcademicSection";
import { CareerGoalsEditor } from "./CareersSection";
import { PRIMARY_BUTTON_CLASS, SECONDARY_BUTTON_CLASS } from "./fields";
import { EMPTY_ACADEMIC } from "./options";

const STEPS = 2;

/**
 * Shown once to a signed-in user whose profile has never been onboarded. Finishing or skipping
 * both mark it done on the server, so it won't come back on other devices either.
 */
export const OnboardingModal = () => {
  const { isSignedIn } = useAuth();
  const { data: profile } = useFetchProfile();
  const update = useUpdateProfile();

  const [step, setStep] = useState(1);
  const [academic, setAcademic] = useState<Academic>(EMPTY_ACADEMIC);
  const [careers, setCareers] = useState<string[]>([]);
  const [dismissed, setDismissed] = useState(false);
  const [seeded, setSeeded] = useState(false);

  const open =
    !!isSignedIn && !!profile && profile.onboardedAt === null && !dismissed;

  // Seed once from whatever is already on the profile (user may have saved on /profile first).
  useEffect(() => {
    if (!profile || seeded) return;
    setAcademic(profile.academic ?? EMPTY_ACADEMIC);
    setCareers(profile.careers ?? []);
    setSeeded(true);
  }, [profile, seeded]);

  // Overlay / Esc only hides for this session; only "Skip for now" writes completeOnboarding.
  const dismissForSession = () => setDismissed(true);

  const skip = () => {
    setDismissed(true);
    update.mutate({ completeOnboarding: true });
  };

  const finish = () => {
    setDismissed(true);
    // Only PATCH sections the modal actually edits, seeded from profile so Finish never
    // wipes data the user already saved on the Profile page.
    update.mutate({
      academic,
      careers,
      completeOnboarding: true,
    });
  };

  return (
    <Transition appear show={open} as={Fragment}>
      <Dialog
        as="div"
        className="relative z-50"
        onClose={dismissForSession}
        open={open}
      >
        <TransitionChild
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 z-40 bg-opacity-40 bg-black " />
        </TransitionChild>

        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <TransitionChild
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <DialogPanel className="w-full max-w-xl transform rounded p-6 text-left align-middle shadow transition-all bg-white">
                <div className="flex items-baseline justify-between">
                  <DialogTitle
                    as="h3"
                    className="text-lg font-medium leading-6 text-gray-900"
                  >
                    Welcome to CMU Courses
                  </DialogTitle>
                  <div className="text-gray-400 text-sm">
                    Step {step} of {STEPS}
                  </div>
                </div>
                <p className="mt-1 text-sm text-gray-400">
                  {step === 1
                    ? "Tell us a bit about you so we can tailor course suggestions to your goals."
                    : "What are you working toward? Pick up to three, in order of priority."}
                </p>

                <div className="mt-4">
                  {step === 1 ? (
                    <AcademicFields
                      value={academic}
                      onChange={setAcademic}
                      showMinors={false}
                    />
                  ) : (
                    <CareerGoalsEditor value={careers} onChange={setCareers} />
                  )}
                </div>

                <p className="mt-4 text-sm text-gray-400">
                  You can change all of this later on your Profile page.
                </p>

                <div className="mt-4 flex justify-between">
                  <button
                    type="button"
                    className={SECONDARY_BUTTON_CLASS}
                    onClick={skip}
                  >
                    Skip for now
                  </button>
                  <div className="flex gap-2">
                    {step > 1 && (
                      <button
                        type="button"
                        className={SECONDARY_BUTTON_CLASS}
                        onClick={() => setStep(step - 1)}
                      >
                        Back
                      </button>
                    )}
                    {step < STEPS ? (
                      <button
                        type="button"
                        className={PRIMARY_BUTTON_CLASS}
                        onClick={() => setStep(step + 1)}
                      >
                        Next
                      </button>
                    ) : (
                      <button
                        type="button"
                        className={PRIMARY_BUTTON_CLASS}
                        onClick={finish}
                      >
                        Finish
                      </button>
                    )}
                  </div>
                </div>
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};
