import "server-only";
/**
 * Optional certificate email through the EXISTING Zapier workflow (Step 11):
 *   Webhooks by Zapier (Catch Hook) → Gmail (Send Email, sender scamsense.certificates@gmail.com).
 *
 * Flow: authenticate (route) → certificate ownership (RLS + user filter) → begin_certificate_email_request
 * (dedupe/rate limit, row = PROCESSING) → render + store the PDF privately → short-lived signed URL → ONE POST to the
 * Catch Hook → SUBMITTED (Zapier accepted) or FAILED. Badges, certificates, scores, and reports never depend on this.
 */
import type { ModuleKey } from "@/content/modules";
import { ApiError } from "@/lib/api/server";
import { getServerEnv } from "@/lib/env";
import { renderCertificatePdf } from "@/lib/pdf/render";
import { getTrustedWriter, isTrustedWriterConfigured } from "@/lib/supabase/admin";
import type { SupabaseServerClient } from "@/lib/supabase/server";
import type { CertificateView } from "./certificate";
import {
  emailStatusFromRow,
  RATE_LIMITED_MESSAGE,
  type CertificateEmailRequest,
  type EmailRequestRow,
  type EmailStatusView,
} from "./emailStatus";
import { requireModuleRewards } from "./server";
import { signedCertificateUrl } from "./storage";
import { postCertificateWebhook, type WebhookResult } from "./zapier";

export interface EmailRequestResult {
  email: EmailStatusView;
  /** created = a new send was attempted now; the others returned an earlier request without sending again. */
  outcome: "created" | "existing" | "in_flight" | "duplicate";
}

export interface EmailDeps {
  fetchImpl?: typeof fetch;
  webhookUrl?: string;
  /** Returns the signed PDF URL (injected in tests). */
  pdfUrl?: (view: CertificateView) => Promise<string>;
}

type BeginResult = {
  outcome: "created" | "existing" | "in_flight" | "duplicate" | "rate_limited";
  request: EmailRequestRow | null;
};

function writer() {
  if (!isTrustedWriterConfigured())
    throw new ApiError(
      503,
      "service_unavailable",
      "Certificate email isn't available right now. Please try again later.",
    );
  return getTrustedWriter();
}

export async function requestCertificateEmail(
  supabase: SupabaseServerClient,
  userId: string,
  moduleKey: ModuleKey | string,
  body: CertificateEmailRequest,
  deps: EmailDeps = {},
): Promise<EmailRequestResult> {
  const { certificate } = await requireModuleRewards(supabase, userId, moduleKey);
  const admin = writer();

  const begun = await admin.rpc("begin_certificate_email_request", {
    p_user_id: userId,
    p_certificate_id: certificate.id,
    p_recipient_email: body.email,
    p_idempotency_key: body.requestId,
  });
  if (begun.error) {
    console.error("[certificate-email] begin failed", { code: begun.error.code });
    throw new ApiError(
      503,
      "service_unavailable",
      "Certificate email isn't available right now. Please try again later.",
    );
  }
  const { outcome, request } = begun.data as BeginResult;
  if (outcome === "rate_limited") throw new ApiError(429, "rate_limited", RATE_LIMITED_MESSAGE);
  if (!request)
    throw new ApiError(503, "service_unavailable", "Certificate email isn't available right now.");
  if (outcome !== "created") return { outcome, email: emailStatusFromRow(request) };

  // New request: prepare the attachment, then hand everything to Zapier once.
  let result: WebhookResult | { ok: false; httpStatus: null; errorCode: "pdf_unavailable" };
  try {
    const url = await (deps.pdfUrl ?? ((v) => signedCertificateUrl(v, renderCertificatePdf)))(certificate);
    result = await postCertificateWebhook(
      deps.webhookUrl ?? getServerEnv().ZAPIER_CERTIFICATE_WEBHOOK_URL,
      {
        recipientEmail: request.recipient_email,
        displayName: certificate.recipientName,
        moduleTitle: certificate.moduleTitle,
        certificateId: certificate.certificateId,
        completionDate: certificate.completedOn,
        certificatePdfUrl: url,
      },
      { fetchImpl: deps.fetchImpl },
    );
  } catch (e) {
    // Without the PDF the email would arrive without its attachment, so Zapier is not called at all.
    console.error("[certificate-email] attachment failed", {
      reason: e instanceof Error ? e.message : "unknown",
    });
    result = { ok: false, httpStatus: null, errorCode: "pdf_unavailable" };
  }
  if (!result.ok)
    console.error("[certificate-email] not sent", { code: result.errorCode, http: result.httpStatus });

  const finished = await admin.rpc("finish_certificate_email_request", {
    p_user_id: userId,
    p_request_id: request.id,
    p_status: result.ok ? "SUBMITTED" : "FAILED",
    p_http_status: result.httpStatus,
    p_error_code: result.ok ? null : result.errorCode,
  });
  const row = (finished.data as EmailRequestRow | null) ?? {
    ...request,
    status: result.ok ? "SUBMITTED" : "FAILED",
    error_code: result.ok ? null : result.errorCode,
  };
  return { outcome, email: emailStatusFromRow(row) };
}
