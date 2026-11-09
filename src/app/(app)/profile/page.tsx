import type { Metadata } from "next";
import { ProfileManager } from "@/components/profile/ProfileManager";
import { ProfileUnavailable } from "@/components/profile/ProfileUnavailable";
import { requireOnboardedProfile } from "@/lib/auth/session";

export const metadata: Metadata = { title: "My Profile" };

export default async function ProfilePage() {
  const result = await requireOnboardedProfile("/profile");
  if (result.status !== "ok") return <ProfileUnavailable reason={result.status} />;
  return (
    <div className="container-page py-8 sm:py-12">
      <ProfileManager initialProfile={result.profile} />
    </div>
  );
}
