"use client";

import { useState } from "react";
import { apiRequest } from "@/lib/api/client";
import type { ScenarioAction } from "@/lib/domain/progression";
import { Icon } from "@/components/icons/Icon";
import { Button } from "@/components/ui/Button";

const LABELS: Record<Exclude<ScenarioAction, "locked">, string> = {
  start: "Start scenario",
  resume: "Resume",
  replay: "Replay as practice",
  resume_replay: "Resume practice",
};

/**
 * Starts, resumes, or replays a scenario via POST /api/scenarios/[key]/attempts, then opens the player. The server
 * decides which (one unfinished attempt per scenario; a completed scenario gets a new practice attempt).
 */
export function StartScenarioButton({
  scenarioKey,
  action,
  variant = "primary",
}: {
  scenarioKey: string;
  action: Exclude<ScenarioAction, "locked">;
  variant?: "primary" | "secondary";
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    setBusy(true);
    setError(null);
    const r = await apiRequest<{ attemptId: string }>(
      `/api/scenarios/${encodeURIComponent(scenarioKey)}/attempts`,
      {
        method: "POST",
      },
    );
    if (!r.ok) {
      setBusy(false);
      setError(r.error.message);
      return;
    }
    window.location.assign(`/play/${r.data.attemptId}`);
  }

  return (
    <div>
      <Button
        variant={variant}
        onClick={go}
        loading={busy}
        loadingText={action === "start" ? "Preparing your scenario…" : "Opening…"}
        iconRight={<Icon name={action.startsWith("resume") ? "arrow-right" : "play"} className="size-5" />}
      >
        {LABELS[action]}
      </Button>
      {error && (
        <p role="alert" className="mt-3 flex items-start gap-2 text-small">
          <Icon name="info" className="mt-0.5 size-4" />
          {error}
        </p>
      )}
    </div>
  );
}
