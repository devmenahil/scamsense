import type { Metadata } from "next";
import { OnboardingForm } from "@/components/onboarding/OnboardingForm";
import { DemoNotice } from "@/components/ui/DemoNotice";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "Set up your profile" };

export default function OnboardingPage() {
  return (
    <div className="container-page py-10 sm:py-14">
      <PageHeader
        eyebrow="Welcome to ScamSense"
        title="Let's make your scenarios feel familiar"
        description="A few quick questions so your simulations match the way you actually use money. It takes about a minute."
        className="mx-auto mb-8 max-w-2xl"
      />
      <OnboardingForm />
      <DemoNotice className="mx-auto mt-6 max-w-2xl">
        Profiles are saved from the next phase. For now your answers stay on this page and are not stored.
      </DemoNotice>
    </div>
  );
}
