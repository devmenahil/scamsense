"use client";

import { useState } from "react";
import { Icon } from "@/components/icons/Icon";
import { Button } from "@/components/ui/Button";
import { FeedbackBanner } from "@/components/ui/FeedbackBanner";

function fileNameFrom(header: string | null, fallback: string): string {
  const m = header?.match(/filename="([^"]+)"/);
  return m?.[1] ?? fallback;
}

/**
 * "Download Analysis Report" (R26). Fetches the caller's own PDF from the authenticated route and saves it, so a
 * failure shows a calm message on the page instead of navigating to an error. Repeat downloads change nothing stored.
 */
export function ReportDownloadButton({
  moduleKey,
  fallbackFileName,
  variant = "primary",
  fullWidth = true,
}: {
  moduleKey: string;
  fallbackFileName: string;
  variant?: "primary" | "secondary";
  fullWidth?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function download() {
    if (busy) return;
    setBusy(true);
    setError(undefined);
    try {
      const res = await fetch(`/api/modules/${moduleKey}/report`, {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (res.status === 401) {
        window.location.assign(
          `/sign-in?notice=expired&next=${encodeURIComponent(window.location.pathname)}`,
        );
        return;
      }
      if (!res.ok || !res.headers.get("Content-Type")?.startsWith("application/pdf")) {
        const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        setError(body?.error?.message ?? "We couldn't prepare your report right now. Please try again.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileNameFrom(res.headers.get("Content-Disposition"), fallbackFileName);
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch {
      setError("We couldn't reach ScamSense. Check your internet connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Button
        type="button"
        variant={variant}
        fullWidth={fullWidth}
        loading={busy}
        disabled={busy}
        onClick={download}
        iconLeft={<Icon name="report" className="size-5" />}
      >
        {busy ? "Preparing PDF…" : "Download Analysis Report"}
      </Button>
      {error && (
        <FeedbackBanner tone="look-again" title="Report not downloaded." live>
          {error}
        </FeedbackBanner>
      )}
    </div>
  );
}
