import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OnboardingForm } from "@/components/onboarding/OnboardingForm";
import { ProfileUnavailable } from "@/components/profile/ProfileUnavailable";
import { PageHeader } from "@/components/ui/PageHeader";
import { getCurrentProfile, requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Set up your profile" };

export default async function OnboardingPage() {
  await requireUser("/onboarding");
  const result = await getCurrentProfile();
  if (result.status !== "ok") return <ProfileUnavailable reason={result.status} />;
  if (result.profile.onboardingCompleted) redirect("/dashboard");

  const firstName = result.profile.displayName.split(" ")[0];
  return (
    <div className="container-page py-10 sm:py-14">
      <PageHeader
        eyebrow={`Welcome to ScamSense, ${firstName}`}
        title="Let's make your scenarios feel familiar"
        description="A few quick questions so your simulations match the way you actually use money. It takes about a minute, and your answers are saved as you go."
        className="mx-auto mb-8 max-w-2xl"
      />
      <OnboardingForm initialProfile={result.profile} />
    </div>
  );
}
