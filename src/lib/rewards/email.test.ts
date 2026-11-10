import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/server";
import { createFakeDb, fakeClient, type FakeDb } from "@/lib/testing/fakeSupabase";
import type { SupabaseServerClient } from "@/lib/supabase/server";

let db: FakeDb;
vi.mock("@/lib/supabase/admin", () => ({
  getTrustedWriter: () => fakeClient(db),
  isTrustedWriterConfigured: () => true,
}));

const { requestCertificateEmail } = await import("./email.server");
const { getModuleRewards } = await import("./server");

const USER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CERT_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const REQ = "6f1c2c0e-3c4b-4d7e-9a3b-2a1f0e9d8c7b";
const HOOK = "https://hooks.zapier.com/hooks/catch/123/abc/";
const PDF_URL = "https://proj.supabase.co/storage/v1/object/sign/certificate-pdfs/x/v1/c.pdf?token=t";

function seedCompleted(userId = USER) {
  db.tables.module_runs = [
    { user_id: userId, module_key: "spot-the-trap", completed_at: "2026-11-10T12:00:00Z" },
  ];
  db.tables.certificates = [
    {
      id: CERT_ID,
      user_id: userId,
      module_key: "spot-the-trap",
      certificate_code: "SS1-7F3A-91C2-0B4E",
      recipient_name: "Test Learner",
      module_title: "Spot the Trap",
      completed_at: "2026-11-10T12:00:00Z",
      issued_at: "2026-11-10T12:00:01Z",
    },
  ];
  db.tables.badges = [
    {
      user_id: userId,
      module_key: "spot-the-trap",
      badge_key: "scam-spotter",
      module_score: 150,
      max_score: 200,
      awarded_at: "2026-11-10T12:00:00Z",
    },
  ];
}

function request(over: Record<string, unknown> = {}) {
  return {
    id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    status: "PROCESSING",
    recipient_email: "learner@example.com",
    error_code: null,
    created_at: new Date().toISOString(),
    finished_at: null,
    ...over,
  };
}

function handlers(outcome: string, req: Record<string, unknown> | null = request()) {
  const begin = vi.fn(() => ({ data: { outcome, request: req } }));
  const finish = vi.fn((a: Record<string, unknown>) => ({
    data: request({ status: a.p_status, error_code: a.p_error_code, finished_at: new Date().toISOString() }),
  }));
  db.rpc.begin_certificate_email_request = begin;
  db.rpc.finish_certificate_email_request = finish;
  return { begin, finish };
}

const supa = () => fakeClient(db) as unknown as SupabaseServerClient;
const body = { email: "learner@example.com", requestId: REQ };

beforeEach(() => {
  db = createFakeDb();
});

describe("certificate email request", () => {
  it("sends the existing Zap fields plus the certificate ID and a signed PDF URL, once", async () => {
    seedCompleted();
    const { begin, finish } = handlers("created");
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 200 }));
    const pdfUrl = vi.fn(async () => PDF_URL);
    const r = await requestCertificateEmail(supa(), USER, "spot-the-trap", body, {
      fetchImpl,
      webhookUrl: HOOK,
      pdfUrl,
    });

    expect(r).toMatchObject({
      outcome: "created",
      email: { status: "submitted", maskedEmail: "le•••@example.com" },
    });
    expect(begin).toHaveBeenCalledWith(
      expect.objectContaining({ p_user_id: USER, p_certificate_id: CERT_ID, p_idempotency_key: REQ }),
    );
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(HOOK);
    expect(JSON.parse(String(init.body))).toEqual({
      recipientEmail: "learner@example.com",
      displayName: "Test Learner",
      moduleTitle: "Spot the Trap",
      certificateId: "SS1-7F3A-91C2-0B4E",
      completionDate: "November 10, 2026",
      certificatePdfUrl: PDF_URL,
    });
    expect(finish).toHaveBeenCalledWith(
      expect.objectContaining({ p_status: "SUBMITTED", p_http_status: 200 }),
    );
  });

  it("records a webhook failure as FAILED and keeps everything else intact", async () => {
    seedCompleted();
    const { finish } = handlers("created");
    const r = await requestCertificateEmail(supa(), USER, "spot-the-trap", body, {
      fetchImpl: async () => new Response("gone", { status: 410 }),
      webhookUrl: HOOK,
      pdfUrl: async () => PDF_URL,
    });
    expect(r.email.status).toBe("failed");
    expect(finish).toHaveBeenCalledWith(
      expect.objectContaining({ p_status: "FAILED", p_http_status: 410, p_error_code: "http_error" }),
    );
    // The certificate and badge are untouched and still readable.
    const state = await getModuleRewards(supa(), USER, "spot-the-trap");
    expect(state).toMatchObject({ status: "ok", certificate: { certificateId: "SS1-7F3A-91C2-0B4E" } });
  });

  it("never emails without the attachment: a PDF failure skips Zapier", async () => {
    seedCompleted();
    const { finish } = handlers("created");
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 200 }));
    const r = await requestCertificateEmail(supa(), USER, "spot-the-trap", body, {
      fetchImpl,
      webhookUrl: HOOK,
      pdfUrl: async () => {
        throw new Error("certificate_upload_failed");
      },
    });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(r.email.status).toBe("failed");
    expect(finish).toHaveBeenCalledWith(expect.objectContaining({ p_error_code: "pdf_unavailable" }));
  });

  it("fails calmly when the webhook URL isn't configured", async () => {
    seedCompleted();
    handlers("created");
    const r = await requestCertificateEmail(supa(), USER, "spot-the-trap", body, {
      webhookUrl: "",
      pdfUrl: async () => PDF_URL,
    });
    expect(r.email).toMatchObject({ status: "failed", errorCode: "not_configured" });
  });

  it.each(["existing", "in_flight", "duplicate"])("does not send again for a %s request", async (outcome) => {
    seedCompleted();
    const { finish } = handlers(
      outcome,
      request({ status: outcome === "in_flight" ? "PROCESSING" : "SUBMITTED" }),
    );
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 200 }));
    const pdfUrl = vi.fn(async () => PDF_URL);
    const r = await requestCertificateEmail(supa(), USER, "spot-the-trap", body, {
      fetchImpl,
      webhookUrl: HOOK,
      pdfUrl,
    });
    expect(r.outcome).toBe(outcome);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(pdfUrl).not.toHaveBeenCalled();
    expect(finish).not.toHaveBeenCalled();
  });

  it("rate-limits with 429", async () => {
    seedCompleted();
    handlers("rate_limited", null);
    await expect(
      requestCertificateEmail(supa(), USER, "spot-the-trap", body, { webhookUrl: HOOK }),
    ).rejects.toMatchObject({ status: 429, code: "rate_limited" });
  });

  it("refuses unfinished modules and another user's certificate", async () => {
    handlers("created");
    await expect(requestCertificateEmail(supa(), USER, "spot-the-trap", body)).rejects.toMatchObject({
      status: 409,
      code: "module_not_completed",
    });
    seedCompleted(OTHER); // the certificate exists, but belongs to someone else
    const err = await requestCertificateEmail(supa(), USER, "spot-the-trap", body).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(409);
    expect(db.calls.rpc).not.toContain("begin_certificate_email_request");
  });

  it("rejects unknown modules", async () => {
    await expect(requestCertificateEmail(supa(), USER, "nope", body)).rejects.toMatchObject({ status: 404 });
  });
});

describe("module rewards reads", () => {
  it("returns the stored certificate, badge score, and no email yet", async () => {
    seedCompleted();
    const s = await getModuleRewards(supa(), USER, "spot-the-trap");
    expect(s).toMatchObject({
      status: "ok",
      badge: { badgeName: "Scam Spotter", moduleScore: 150, maxScore: 200 },
      email: { status: "not_submitted" },
    });
  });

  it("repairs missing rewards once through the trusted writer, never by itself", async () => {
    db.tables.module_runs = [
      { user_id: USER, module_key: "spot-the-trap", completed_at: "2026-11-10T12:00:00Z" },
    ];
    const ensure = vi.fn(() => {
      seedCompleted();
      return { data: "awarded" };
    });
    db.rpc.ensure_module_rewards = ensure;
    const s = await getModuleRewards(supa(), USER, "spot-the-trap");
    expect(ensure).toHaveBeenCalledTimes(1);
    expect(s.status).toBe("ok");
    await getModuleRewards(supa(), USER, "spot-the-trap");
    expect(ensure).toHaveBeenCalledTimes(1);
  });

  it("reports not_completed without awarding anything", async () => {
    db.rpc.ensure_module_rewards = vi.fn(() => ({ data: "not_completed" }));
    expect((await getModuleRewards(supa(), USER, "spot-the-trap")).status).toBe("not_completed");
    expect(db.calls.rpc).toEqual([]);
  });
});
