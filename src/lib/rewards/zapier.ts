/**
 * Zapier Catch Hook client for the optional certificate email (Step 11). Pure apart from the injected `fetch`.
 *
 * The existing Zap (Webhooks by Zapier → Catch Hook, then Gmail → Send Email) already maps `recipientEmail`,
 * `displayName`, and `moduleTitle`; those names must not change. Step 11 adds `certificateId`, `completionDate`, and
 * `certificatePdfUrl` (a short-lived signed URL that Gmail's Attachments field downloads).
 *
 * The payload is an explicit allowlist: no income, profile details, justifications, Training Funds, PayPal data,
 * credentials, or API keys can be added by accident. `ZAPIER_WEBHOOK_SECRET` is NOT sent: a Catch Hook has no
 * built-in way to verify it, and the existing Zap has no filter step, so sending it would only copy a secret into
 * Zapier's task history. The unguessable webhook URL (server-only env var) is the access control.
 */

export interface ZapierCertificatePayload {
  recipientEmail: string;
  displayName: string;
  moduleTitle: string;
  certificateId: string;
  completionDate: string;
  certificatePdfUrl: string;
}

export const ZAPIER_PAYLOAD_FIELDS = [
  "recipientEmail",
  "displayName",
  "moduleTitle",
  "certificateId",
  "completionDate",
  "certificatePdfUrl",
] as const satisfies readonly (keyof ZapierCertificatePayload)[];

export function buildZapierPayload(input: ZapierCertificatePayload): ZapierCertificatePayload {
  // Rebuild field by field so nothing else can ride along.
  return {
    recipientEmail: input.recipientEmail,
    displayName: input.displayName,
    moduleTitle: input.moduleTitle,
    certificateId: input.certificateId,
    completionDate: input.completionDate,
    certificatePdfUrl: input.certificatePdfUrl,
  };
}

export type WebhookResult =
  | { ok: true; httpStatus: number }
  | {
      ok: false;
      httpStatus: number | null;
      errorCode: "timeout" | "network" | "http_error" | "not_configured";
    };

export const ZAPIER_TIMEOUT_MS = 8000;

/** One POST, no automatic retry loop (the learner can retry; each retry is a new, deduplicated request). */
export async function postCertificateWebhook(
  url: string | undefined,
  payload: ZapierCertificatePayload,
  opts: { fetchImpl?: typeof fetch; timeoutMs?: number } = {},
): Promise<WebhookResult> {
  if (!url) return { ok: false, httpStatus: null, errorCode: "not_configured" };
  const doFetch = opts.fetchImpl ?? fetch;
  try {
    const res = await doFetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(buildZapierPayload(payload)),
      signal: AbortSignal.timeout(opts.timeoutMs ?? ZAPIER_TIMEOUT_MS),
      cache: "no-store",
      redirect: "error",
    });
    // Drain the body so the connection can be reused; its content is not needed.
    await res.text().catch(() => undefined);
    return res.ok
      ? { ok: true, httpStatus: res.status }
      : { ok: false, httpStatus: res.status, errorCode: "http_error" };
  } catch (e) {
    const name = e instanceof Error ? e.name : "";
    return {
      ok: false,
      httpStatus: null,
      errorCode: name === "TimeoutError" || name === "AbortError" ? "timeout" : "network",
    };
  }
}
