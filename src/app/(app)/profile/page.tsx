import type { Metadata } from "next";
import Link from "next/link";
import { ProfileManager } from "@/components/profile/ProfileManager";
import { ProfileUnavailable } from "@/components/profile/ProfileUnavailable";
import { BadgeShelf } from "@/components/rewards/BadgeShelf";
import { Icon } from "@/components/icons/Icon";
import { Card } from "@/components/ui/Card";
import { requireOnboardedProfile } from "@/lib/auth/session";
import { getCurrentProgress } from "@/lib/progress/current";
import { getCurrentRewards } from "@/lib/rewards/current";
import { earnedBadges } from "@/lib/rewards/earned";

export const metadata: Metadata = { title: "My Profile" };
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const result = await requireOnboardedProfile("/profile");
  if (result.status !== "ok") return <ProfileUnavailable reason={result.status} />;
  const [rewards, progress] = await Promise.all([getCurrentRewards(), getCurrentProgress("/profile")]);
  const earned = earnedBadges(rewards, progress.status === "ok" ? progress.snapshot : null);
  const count = Object.keys(earned).length;

  return (
    <div className="container-page py-8 sm:py-12">
      <ProfileManager initialProfile={result.profile} />

      <Card as="section" aria-labelledby="profile-badges-heading" className="mt-8">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="profile-badges-heading" className="font-heading text-lg font-extrabold">
            Your badges
          </h2>
          <p className="text-small text-teal/85">{count} of 3 earned</p>
        </div>
        <BadgeShelf earned={earned} className="mt-4" />
        <Link
          href="/certificates"
          className="mt-4 inline-flex min-h-11 items-center gap-1.5 font-heading font-extrabold underline decoration-2 underline-offset-4"
        >
          Certificates and reports
          <Icon name="arrow-right" className="size-4" />
        </Link>
      </Card>
    </div>
  );
}
