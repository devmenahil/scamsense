import { SignOutButton } from "@/components/auth/SignOutButton";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

/** Calm fallback when the signed-in user's profile cannot be read (network/database issue or missing row). */
export function ProfileUnavailable({ reason }: { reason: "error" | "missing" }) {
  return (
    <div className="container-page py-10 sm:py-14">
      <EmptyState
        icon="user"
        title={reason === "error" ? "We couldn't load your profile" : "We couldn't find your profile"}
        description={
          reason === "error"
            ? "This is usually temporary. Please refresh the page in a moment."
            : "Please sign out and sign back in. If this keeps happening, create your account again."
        }
        action={
          reason === "error" ? (
            <ButtonLink href="/dashboard" variant="secondary">
              Try again
            </ButtonLink>
          ) : (
            <SignOutButton />
          )
        }
      />
    </div>
  );
}
