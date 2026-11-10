import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { getModule, MODULES } from "@/content/modules";
import { sampleReport } from "@/lib/testing/reportFixture";
import { getScenarioTemplate } from "@/content/scenarios/templates.server";
import { buildModuleReport, excerpt, REPORT_FUNDS_NOTICE } from "@/lib/report/build";
import {
  buildCertificateView,
  CERTIFICATE_CODE_PATTERN,
  CERTIFICATE_DISCLAIMER,
  certificatePdfFileName,
  formatCompletionDate,
  reportFileName,
  type CertificateRow,
} from "./certificate";
import {
  certificateEmailRequestSchema,
  EMAIL_STATUS_COPY,
  emailStatusFromRow,
  maskEmail,
  PROCESSING_STALE_MS,
} from "./emailStatus";
import { buildZapierPayload, postCertificateWebhook, ZAPIER_PAYLOAD_FIELDS } from "./zapier";

const MIGRATION = readFileSync("supabase/migrations/20261115090000_module_rewards.sql", "utf8");

const certRow: CertificateRow = {
  id: "11111111-1111-4111-8111-111111111111",
  module_key: "spot-the-trap",
  certificate_code: "SS1-7F3A-91C2-0B4E",
  recipient_name: "Test Learner",
  module_title: "Spot the Trap",
  completed_at: "2026-11-10T23:30:00.000Z",
  issued_at: "2026-11-10T23:30:01.000Z",
};

describe("module rewards migration (drift guards)", () => {
  it("maps every module to its official badge key", () => {
    for (const m of MODULES) expect(MIGRATION).toContain(`('${m.key}', '${m.badgeKey}')`);
    expect(MODULES.map((m) => m.badgeName)).toEqual([
      "Scam Spotter",
      "Fraud Detective",
      "ScamSense Guardian",
    ]);
  });
  it("snapshots the official module titles", () => {
    for (const m of MODULES) expect(MIGRATION).toContain(`when '${m.key}' then '${m.title}'`);
  });
  it("makes rewards unique per run and per user+module, and final", () => {
    for (const c of [
      "badges_run_key unique (module_run_id)",
      "badges_user_module_key unique (user_id, module_key)",
      "certificates_run_key unique (module_run_id)",
      "certificates_user_module_key unique (user_id, module_key)",
      "certificates_code_key unique (certificate_code)",
      "certificate_email_requests_idempotency_key unique (user_id, idempotency_key)",
      "create trigger badges_immutable",
      "create trigger certificates_immutable",
    ])
      expect(MIGRATION).toContain(c);
  });
  it("awards only on the single completion transition, and only from original attempts", () => {
    expect(MIGRATION).toContain("if old.completed_at is null and new.completed_at is not null then");
    expect(MIGRATION).toMatch(/a\.attempt_number = 1 and a\.state = 'COMPLETED' and not s\.is_replay/);
    expect(MIGRATION).toContain("on conflict do nothing");
  });
  it("keeps writes server-only and storage private", () => {
    expect(MIGRATION).toMatch(
      /revoke all on table public\.certificates from public, anon, authenticated, service_role/,
    );
    expect(MIGRATION).not.toMatch(
      /grant (insert|update|delete)[^;]*(badges|certificates|certificate_email_requests)/,
    );
    expect(MIGRATION).toContain("('certificate-pdfs', 'certificate-pdfs', false");
    expect(MIGRATION).not.toMatch(/create policy[^;]*storage\.objects/);
    expect(MIGRATION).toMatch(
      /grant execute on function public\.begin_certificate_email_request[^;]*to service_role;/,
    );
    expect(MIGRATION).not.toMatch(/grant execute[^;]*to (anon|authenticated)/);
  });
  it("uses the same certificate code format as the app", () => {
    expect(MIGRATION).toContain(`'${CERTIFICATE_CODE_PATTERN.source}'`);
  });
});

describe("certificate view", () => {
  it("builds the preview/PDF data from the stored row", () => {
    const v = buildCertificateView(certRow)!;
    expect(v).toMatchObject({
      certificateId: "SS1-7F3A-91C2-0B4E",
      recipientName: "Test Learner",
      moduleTitle: "Spot the Trap",
      moduleOrder: 1,
      badgeName: "Scam Spotter",
      completedOn: "November 10, 2026",
    });
  });
  it("formats the date in UTC so preview and PDF agree", () => {
    expect(formatCompletionDate("2026-11-10T23:59:59Z")).toBe("November 10, 2026");
    expect(formatCompletionDate("nope")).toBe("Date unavailable");
  });
  it("rejects unknown modules and malformed codes", () => {
    expect(buildCertificateView({ ...certRow, module_key: "nope" })).toBeNull();
    expect(buildCertificateView({ ...certRow, certificate_code: "DEMO-0000" })).toBeNull();
  });
  it("names files predictably", () => {
    expect(certificatePdfFileName(buildCertificateView(certRow)!)).toBe(
      "ScamSense-Certificate-Spot-the-Trap-SS1-7F3A-91C2-0B4E.pdf",
    );
    expect(reportFileName(2, "Trust Under Pressure", "2026-11-10T10:00:00Z")).toBe(
      "ScamSense-Analysis-Report-Module-2-Trust-Under-Pressure-2026-11-10.pdf",
    );
  });
  it("says it is not a PayPal certification", () => {
    expect(CERTIFICATE_DISCLAIMER).toMatch(/not a PayPal certification/);
    expect(CERTIFICATE_DISCLAIMER).toMatch(/endorsement or accreditation/);
  });
});

describe("certificate email status", () => {
  const row = {
    id: "r",
    recipient_email: "learner@example.com",
    error_code: null,
    created_at: new Date(1_000_000).toISOString(),
    finished_at: null,
  };
  it("distinguishes not submitted, processing, submitted, failed", () => {
    expect(emailStatusFromRow(null).status).toBe("not_submitted");
    expect(emailStatusFromRow({ ...row, status: "PROCESSING" }, 1_000_000 + 1000).status).toBe("processing");
    expect(emailStatusFromRow({ ...row, status: "SUBMITTED" }).status).toBe("submitted");
    expect(emailStatusFromRow({ ...row, status: "FAILED", error_code: "timeout" })).toMatchObject({
      status: "failed",
      errorCode: "timeout",
    });
  });
  it("treats an abandoned PROCESSING request as failed (retry allowed)", () => {
    const v = emailStatusFromRow({ ...row, status: "PROCESSING" }, 1_000_000 + PROCESSING_STALE_MS + 1);
    expect(v).toMatchObject({ status: "failed", errorCode: "abandoned" });
  });
  it("never claims delivery", () => {
    expect(EMAIL_STATUS_COPY.submitted.title).toBe("Your certificate email request has been submitted.");
    for (const c of Object.values(EMAIL_STATUS_COPY))
      expect(`${c.title} ${c.body}`).not.toMatch(/delivered/i);
  });
  it("masks addresses", () => {
    expect(maskEmail("learner@example.com")).toBe("le•••@example.com");
    expect(maskEmail("a@b.co")).toBe("a•••@b.co");
  });
  it("validates the request body", () => {
    const requestId = "6f1c2c0e-3c4b-4d7e-9a3b-2a1f0e9d8c7b";
    expect(
      certificateEmailRequestSchema.safeParse({ email: " learner@example.com ", requestId }).data?.email,
    ).toBe("learner@example.com");
    expect(certificateEmailRequestSchema.safeParse({ email: "not-an-email", requestId }).success).toBe(false);
    expect(certificateEmailRequestSchema.safeParse({ email: "a@b.co", requestId: "x" }).success).toBe(false);
    expect(
      certificateEmailRequestSchema.safeParse({ email: "a@b.co", requestId, displayName: "Mallory" }).success,
    ).toBe(false);
  });
});

describe("Zapier webhook", () => {
  const payload = {
    recipientEmail: "learner@example.com",
    displayName: "Test Learner",
    moduleTitle: "Spot the Trap",
    certificateId: "SS1-7F3A-91C2-0B4E",
    completionDate: "November 10, 2026",
    certificatePdfUrl: "https://example.supabase.co/storage/v1/object/sign/certificate-pdfs/x.pdf?token=t",
  };
  it("keeps the existing Zap field names and adds only certificate fields", () => {
    expect(ZAPIER_PAYLOAD_FIELDS.slice(0, 3)).toEqual(["recipientEmail", "displayName", "moduleTitle"]);
    const extra = { ...payload, income: "5000", justification: "secret", apiKey: "k", secret: "s" };
    expect(Object.keys(buildZapierPayload(extra)).sort()).toEqual([...ZAPIER_PAYLOAD_FIELDS].sort());
  });
  it("posts JSON once and reports acceptance (not delivery)", async () => {
    const fetchImpl = vi.fn(async () => new Response('{"status":"success"}', { status: 200 }));
    const r = await postCertificateWebhook("https://hooks.zapier.com/hooks/catch/1/abc/", payload, {
      fetchImpl,
    });
    expect(r).toEqual({ ok: true, httpStatus: 200 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual(payload);
    expect(String(init.body)).not.toMatch(/secret|income|justification/i);
  });
  it("reports HTTP errors, timeouts, network errors, and a missing URL", async () => {
    expect(
      await postCertificateWebhook("https://h", payload, {
        fetchImpl: async () => new Response("", { status: 410 }),
      }),
    ).toEqual({ ok: false, httpStatus: 410, errorCode: "http_error" });
    const timeout = Object.assign(new Error("t"), { name: "TimeoutError" });
    expect(
      await postCertificateWebhook("https://h", payload, {
        fetchImpl: async () => {
          throw timeout;
        },
      }),
    ).toMatchObject({ ok: false, errorCode: "timeout" });
    expect(
      await postCertificateWebhook("https://h", payload, {
        fetchImpl: async () => {
          throw new TypeError("fetch failed");
        },
      }),
    ).toMatchObject({ ok: false, errorCode: "network" });
    expect(await postCertificateWebhook(undefined, payload)).toMatchObject({ errorCode: "not_configured" });
  });
});

describe("module analysis report model", () => {
  const r = sampleReport();
  it("orders scenarios, sums the module score, and formats Training Funds", () => {
    expect(r.scenarios.map((s) => s.scenarioKey)).toEqual(["m1-s1", "m1-s2"]);
    expect(r.score).toEqual({ points: 89, max: 200, scoredScenarios: 2 });
    expect(r.funds).toMatchObject({
      starting: "$3,000.00",
      ending: "$2,760.00",
      fraudLoss: "$240.00",
      spending: "$0.00",
    });
    expect(r.module.badgeName).toBe("Scam Spotter");
  });
  it("uses stored evaluation data and authored labels, never the humorous comment", () => {
    const s1 = r.scenarios[0]!;
    expect(s1.recognized.map((e) => e.title).length).toBe(2);
    expect(s1.unsupportedAssumptions).toHaveLength(1);
    expect(s1.verificationPerformed).toContain("Checked the sender's details");
    expect(s1.verificationMissed.length).toBeGreaterThan(0);
    expect(s1.missed[0]!.important || !s1.missed.some((m) => m.important)).toBe(true);
    expect(JSON.stringify(r)).not.toContain("must never appear");
  });
  it("summarizes long justifications", () => {
    expect(r.scenarios[1]!.justificationExcerpt!.length).toBeLessThanOrEqual(321);
    expect(r.scenarios[1]!.justificationExcerpt!.endsWith("…")).toBe(true);
    expect(excerpt("  short  text ")).toBe("short text");
    expect(excerpt(null)).toBeNull();
  });
  it("includes key lessons and official references", () => {
    expect(r.keyLessons.length).toBeGreaterThanOrEqual(2);
    expect(r.references.some((x) => x.url.startsWith("https://www.paypal.com/us/"))).toBe(true);
    expect(new Set(r.references.map((x) => x.url)).size).toBe(r.references.length);
  });
  it("labels Training Funds as fictional", () => {
    expect(REPORT_FUNDS_NOTICE).toMatch(/fictional/);
    expect(REPORT_FUNDS_NOTICE).toMatch(/Sandbox/);
  });
  it("handles a scenario whose feedback can't be read", () => {
    const t = getScenarioTemplate("m1-s1")!;
    const x = buildModuleReport({
      module: getModule("spot-the-trap")!,
      learnerName: "L",
      completedAt: "2026-11-10T12:00:00Z",
      generatedAt: "2026-11-10T12:00:00Z",
      certificateId: null,
      wallet: null,
      scenarios: [
        {
          position: 1,
          template: t,
          fallbackTitle: "x",
          scenarioKey: "m1-s1",
          completedAt: null,
          justification: null,
          verificationActionIds: [],
          results: null,
        },
      ],
    });
    expect(x.scenarios[0]).toMatchObject({ feedbackAvailable: false, score: null, decision: null });
    expect(x.funds).toBeNull();
    expect(x.score.points).toBe(0);
  });
});

describe("certificate is not directly downloadable (R25)", () => {
  const files = [
    "src/components/certificate/CertificatePreview.tsx",
    "src/components/certificate/CertificateEmailForm.tsx",
    "src/app/(app)/modules/[moduleKey]/complete/page.tsx",
    "src/app/api/certificates/[moduleKey]/route.ts",
    "src/app/api/certificates/[moduleKey]/email/route.ts",
  ].map((f) => [f, readFileSync(f, "utf8")] as const);
  it("has no certificate download control, PDF response, or signed URL in any browser-facing code", () => {
    for (const [f, src] of files) {
      expect(src, f).not.toMatch(/application\/pdf|signedCertificateUrl|certificatePdfUrl|download=/);
      expect(src, f).not.toMatch(/Download (my |your )?certificate/i);
    }
  });
  it("only the analysis report is served as a PDF download", () => {
    const report = readFileSync("src/app/api/modules/[moduleKey]/report/route.ts", "utf8");
    expect(report).toMatch(/Content-Disposition/);
    expect(report).toMatch(/requireApiUser/);
  });
});
