"use client";

import { useRef, useState, type FormEvent } from "react";
import { apiRequest } from "@/lib/api/client";
import {
  certificateEmailRequestSchema,
  EMAIL_STATUS_COPY,
  type EmailStatusView,
} from "@/lib/rewards/emailStatus";
import { Button } from "@/components/ui/Button";
import { FeedbackBanner } from "@/components/ui/FeedbackBanner";
import { Input } from "@/components/ui/Input";

const emailField = certificateEmailRequestSchema.shape.email;

/**
 * Optional certificate email (R25) through the existing Zapier → Gmail workflow.
 * - One request id per intentional send. If the network drops mid-request, "Try again" reuses the same id, so the
 *   server returns the original request instead of sending twice. After a final answer, the next send gets a new id.
 * - The button is disabled while a request is in flight (no accidental double clicks).
 * - Status copy never claims delivery: "submitted" means Zapier accepted the request.
 */
export function CertificateEmailForm({
  moduleKey,
  initialStatus,
}: {
  moduleKey: string;
  initialStatus: EmailStatusView;
}) {
  const [status, setStatus] = useState<EmailStatusView>(initialStatus);
  const [fieldError, setFieldError] = useState<string>();
  const [requestError, setRequestError] = useState<string>();
  const [busy, setBusy] = useState(false);
  /** Id of a request whose outcome we don't know yet (network failure); reused on retry. */
  const pendingId = useRef<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const parsed = emailField.safeParse(String(new FormData(e.currentTarget).get("email") ?? ""));
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message);
      return;
    }
    setFieldError(undefined);
    setRequestError(undefined);
    setBusy(true);
    const requestId = (pendingId.current ??= crypto.randomUUID());
    setStatus((s) => ({ ...s, status: "processing" }));
    const res = await apiRequest<{ email: EmailStatusView; outcome: string }>(
      `/api/certificates/${moduleKey}/email`,
      { method: "POST", body: { email: parsed.data, requestId } },
    );
    setBusy(false);
    if (res.ok) {
      pendingId.current = null;
      setStatus(res.data.email);
      return;
    }
    if (res.error.code !== "network") pendingId.current = null; // the server answered: a retry is a new request
    if (res.error.fields?.email) setFieldError(res.error.fields.email);
    setRequestError(res.error.message);
    setStatus((s) => ({ ...s, status: "failed" }));
  }

  const copy = EMAIL_STATUS_COPY[status.status];
  const label =
    status.status === "submitted"
      ? "Send again"
      : status.status === "failed"
        ? "Try again"
        : "Email my certificate";

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4" aria-busy={busy}>
      <Input
        label="Email address"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        maxLength={254}
        hint="Optional. Used only to send you this certificate as a PDF."
        error={fieldError}
        disabled={busy}
      />
      <Button type="submit" variant="secondary" loading={busy} disabled={busy}>
        {busy ? "Sending…" : label}
      </Button>
      {status.status !== "not_submitted" && (
        <FeedbackBanner tone={status.status === "failed" ? "look-again" : "info"} title={copy.title} live>
          {status.status === "failed" && requestError ? requestError : copy.body}
          {status.maskedEmail && status.status !== "processing" && (
            <span className="mt-1 block text-caption">Last request: {status.maskedEmail}</span>
          )}
        </FeedbackBanner>
      )}
    </form>
  );
}
