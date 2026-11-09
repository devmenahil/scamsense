"use client";

import { useState } from "react";
import { apiRequest } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/icons/Icon";
import { Button } from "@/components/ui/Button";

/**
 * Signs out via /api/auth/sign-out, then does a full navigation so no private page stays in the client cache.
 * `compact` renders an icon-only pill for the header (still has an accessible name).
 */
export function SignOutButton({ compact = false, className }: { compact?: boolean; className?: string }) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function signOut() {
    setBusy(true);
    setFailed(false);
    const result = await apiRequest("/api/auth/sign-out", {
      method: "POST",
      redirectOnUnauthenticated: false,
    });
    if (!result.ok && result.error.code === "network") {
      setBusy(false);
      setFailed(true);
      return;
    }
    window.location.assign("/sign-in?notice=signed_out");
  }

  if (compact) {
    return (
      <button
        type="button"
        onClick={signOut}
        disabled={busy}
        aria-busy={busy || undefined}
        title={failed ? "Couldn't sign out. Check your connection and try again." : "Sign out"}
        className={cn(
          "inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-pill px-3 font-heading text-[0.9375rem] font-extrabold text-teal/85 hover:bg-mist hover:text-teal disabled:opacity-60",
          className,
        )}
      >
        <Icon name="sign-out" className="size-5" />
        <span className="sr-only xl:not-sr-only">{failed ? "Try again" : "Sign out"}</span>
      </button>
    );
  }

  return (
    <div className={className}>
      <Button
        variant="secondary"
        onClick={signOut}
        loading={busy}
        loadingText="Signing out…"
        iconLeft={<Icon name="sign-out" className="size-5" />}
      >
        Sign out
      </Button>
      {failed && (
        <p role="status" className="mt-2 text-caption">
          We couldn&apos;t reach ScamSense. Check your connection and try again.
        </p>
      )}
    </div>
  );
}
