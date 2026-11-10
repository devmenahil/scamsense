/**
 * Certificate email request status (Step 11). Pure and client-safe.
 *
 * Honest statuses only: a 2xx from the Zapier Catch Hook means Zapier ACCEPTED the request. It does not prove Gmail
 * delivered the message, and ScamSense has no delivery confirmation, so "delivered" is never shown.
 */
import { z } from "zod";

export type EmailRequestStatus = "not_submitted" | "processing" | "submitted" | "failed";

export interface EmailRequestRow {
  id: string;
  status: "PROCESSING" | "SUBMITTED" | "FAILED";
  recipient_email: string;
  error_code: string | null;
  created_at: string;
  finished_at: string | null;
}

export const EMAIL_REQUEST_COLUMNS = "id, status, recipient_email, error_code, created_at, finished_at";

/** A PROCESSING row older than this was abandoned (matches begin_certificate_email_request). */
export const PROCESSING_STALE_MS = 2 * 60 * 1000;

export interface EmailStatusView {
  status: EmailRequestStatus;
  /** Masked address of the latest request ("le•••@example.com"), or null. */
  maskedEmail: string | null;
  /** When the latest request was made (ISO), or null. */
  requestedAt: string | null;
  /** Why it failed (stable code), only for `failed`. */
  errorCode: string | null;
}

export const NOT_SUBMITTED: EmailStatusView = {
  status: "not_submitted",
  maskedEmail: null,
  requestedAt: null,
  errorCode: null,
};

export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at <= 0) return "•••";
  const local = email.slice(0, at);
  const shown = local.length <= 2 ? local.slice(0, 1) : local.slice(0, 2);
  return `${shown}•••${email.slice(at)}`;
}

export function emailStatusFromRow(row: EmailRequestRow | null, now = Date.now()): EmailStatusView {
  if (!row) return NOT_SUBMITTED;
  const base = { maskedEmail: maskEmail(row.recipient_email), requestedAt: row.created_at };
  if (row.status === "SUBMITTED") return { ...base, status: "submitted", errorCode: null };
  if (row.status === "FAILED") return { ...base, status: "failed", errorCode: row.error_code };
  const stale = now - Date.parse(row.created_at) > PROCESSING_STALE_MS;
  return stale
    ? { ...base, status: "failed", errorCode: "abandoned" }
    : { ...base, status: "processing", errorCode: null };
}

/** User-facing copy. Calm, accurate, and never claims delivery. */
export const EMAIL_STATUS_COPY: Record<EmailRequestStatus, { title: string; body: string }> = {
  not_submitted: {
    title: "No email requested yet.",
    body: "Your certificate stays here on screen either way.",
  },
  processing: {
    title: "Sending your request…",
    body: "We're passing your certificate to our email service. This usually takes a few seconds.",
  },
  submitted: {
    title: "Your certificate email request has been submitted.",
    body:
      "Our email service accepted the request. The email usually arrives within a few minutes; check your spam " +
      "folder if you don't see it. We can't confirm delivery from here.",
  },
  failed: {
    title: "We couldn't send your certificate right now.",
    body: "Nothing is lost: your badge, certificate, and report are all still here. Please try again in a little while.",
  },
};

export const RATE_LIMITED_MESSAGE =
  "You've requested this certificate several times in the last hour. Please wait a little before trying again.";

/** Email body schema (client + server). */
export const certificateEmailRequestSchema = z
  .object({
    email: z
      .string()
      .trim()
      .max(254, "That email address is too long.")
      .pipe(z.email("Enter an email address like name@example.com.")),
    /** One per intentional send; a network retry reuses it, so it can never send twice. */
    requestId: z.uuid(),
  })
  .strict();
export type CertificateEmailRequest = z.infer<typeof certificateEmailRequestSchema>;
