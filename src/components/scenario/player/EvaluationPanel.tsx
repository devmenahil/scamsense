"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiRequest } from "@/lib/api/client";
import { Icon } from "@/components/icons/Icon";
import { Button } from "@/components/ui/Button";
import { LoadingState } from "@/components/ui/Spinner";

type Status =
  | { status: "complete" }
  | { status: "pending" }
  | { status: "failed"; basicAvailable: boolean; geminiAvailable: boolean }
  | { status: "not_ready" };

/**
 * After the decision and explanation are locked (FINALIZED), asks the server to evaluate the attempt ONCE, then opens
 * the results. Duplicate-safe: the server returns the stored result or "pending" for a concurrent request, and this
 * component polls the stored status (GET never calls Gemini). On failure nothing is invented: the learner can retry
 * or choose clearly labelled basic feedback.
 */
export function EvaluationPanel({ attemptId }: { attemptId: string }) {
  const router = useRouter();
  const [state, setState] = useState<
    Status | { status: "requesting" } | { status: "error"; message: string }
  >({
    status: "requesting",
  });
  const started = useRef(false);
  const resultsHref = `/play/${attemptId}/results`;

  const handle = useCallback(
    (s: Status) => {
      setState(s);
      if (s.status === "complete") router.replace(resultsHref);
    },
    [router, resultsHref],
  );

  const poll = useCallback(async () => {
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 2_000));
      const r = await apiRequest<{ evaluation: Status }>(`/api/attempts/${attemptId}/evaluation`);
      if (r.ok && r.data.evaluation.status !== "pending") return handle(r.data.evaluation);
    }
    setState({ status: "failed", basicAvailable: false, geminiAvailable: true });
  }, [attemptId, handle]);

  const request = useCallback(
    async (mode: "ai" | "basic") => {
      setState({ status: "requesting" });
      const r = await apiRequest<{ evaluation: Status }>(`/api/attempts/${attemptId}/evaluation`, {
        method: "POST",
        body: { mode },
      });
      if (!r.ok) return setState({ status: "error", message: r.error.message });
      if (r.data.evaluation.status === "pending") {
        setState({ status: "pending" });
        return poll();
      }
      handle(r.data.evaluation);
    },
    [attemptId, handle, poll],
  );

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void request("ai");
  }, [request]);

  if (state.status === "requesting" || state.status === "pending" || state.status === "complete") {
    return (
      <div className="mt-5 rounded-card bg-mist p-4">
        <LoadingState
          className="py-4"
          label={state.status === "complete" ? "Opening your results…" : "Reviewing your reasoning…"}
        />
        <p className="text-center text-caption text-teal/85">
          This usually takes a few seconds. Your decision and explanation are already saved.
        </p>
      </div>
    );
  }

  const failed = state.status === "failed" ? state : null;
  return (
    <div className="mt-5 rounded-card bg-yellow-tint p-4" role="status">
      <p className="flex items-start gap-2 font-heading font-extrabold">
        <Icon name="info" className="mt-0.5 size-5 shrink-0" />
        {state.status === "error" ? state.message : "Your personalized feedback isn't ready right now."}
      </p>
      <p className="mt-2 text-small">
        Nothing is lost: your decision, explanation, actions, and any Sandbox payment stay exactly as they
        are. Trying again never repeats a payment.
      </p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        {(!failed || failed.geminiAvailable) && (
          <Button onClick={() => void request("ai")} iconLeft={<Icon name="clock" className="size-5" />}>
            Try again
          </Button>
        )}
        {failed?.basicAvailable && (
          <Button variant="secondary" onClick={() => void request("basic")}>
            Continue with basic feedback
          </Button>
        )}
      </div>
      {failed?.basicAvailable && (
        <p className="mt-3 text-caption">
          Basic feedback uses the scenario&apos;s written explanations and a simple keyword check of your
          reasoning instead of a personalized review.
        </p>
      )}
    </div>
  );
}
