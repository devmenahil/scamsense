import { ApiError } from "@google/genai";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import {
  backoffMs,
  callGeminiJson,
  CATEGORY_DEADLINE_MS,
  classifyError,
  PER_USER_CALLS_PER_10_MIN,
  resetRateLimits,
  retryDelayFromMessage,
  type GeminiDeps,
  type GeminiJsonRequest,
} from "./gemini";
import { getUsageSnapshot, resetUsage } from "./usage";

type Reply = Awaited<ReturnType<GeminiDeps["generate"]>> | Error;

function fakeDeps(replies: Reply[]) {
  let t = 0;
  const sleeps: number[] = [];
  const deps: GeminiDeps & { sent: number; sleeps: number[] } = {
    model: "test-model",
    requestTimeoutMs: 9_000,
    sent: 0,
    sleeps,
    now: () => t,
    random: () => 0.5,
    sleep: async (ms) => {
      sleeps.push(ms);
      t += ms;
    },
    generate: async () => {
      deps.sent++;
      t += 100;
      const r = replies.shift();
      if (!r) throw new Error("no more replies");
      if (r instanceof Error) throw r;
      return r;
    },
  };
  return deps;
}

const req = (over: Partial<GeminiJsonRequest<{ ok: boolean }>> = {}): GeminiJsonRequest<{ ok: boolean }> => ({
  category: "classification",
  rateKey: "user-1",
  systemInstruction: "s",
  prompt: "p",
  jsonSchema: {},
  parse: (raw) => z.object({ ok: z.boolean() }).strict().parse(raw),
  maxOutputTokens: 100,
  ...over,
});

const good = { text: '{"ok":true}', finishReason: "STOP", inputTokens: 40, outputTokens: 8 };

beforeEach(() => {
  resetUsage();
  resetRateLimits();
});
afterEach(() => {
  delete process.env.GEMINI_MAX_RPM;
});

describe("callGeminiJson", () => {
  it("returns validated JSON and records one request with token usage", async () => {
    const deps = fakeDeps([good]);
    const r = await callGeminiJson(req(), deps);
    expect(r).toMatchObject({
      ok: true,
      value: { ok: true },
      usage: { inputTokens: 40, outputTokens: 8 },
      retries: 0,
    });
    expect(deps.sent).toBe(1);
    expect(getUsageSnapshot().categories.classification).toMatchObject({
      requests: 1,
      successes: 1,
      inputTokens: 40,
      outputTokens: 8,
    });
  });

  it("is a calm 'not_configured' failure without an API key (no request)", async () => {
    expect(await callGeminiJson(req(), null)).toMatchObject({ ok: false, reason: "not_configured" });
  });

  it("retries invalid output once, then gives up (no fabricated value)", async () => {
    const deps = fakeDeps([{ text: '{"ok":"yes"}' }, { text: "not json" }, good]);
    const r = await callGeminiJson(req(), deps);
    expect(r).toMatchObject({ ok: false, reason: "invalid_output" });
    expect(deps.sent).toBe(2);
    expect(getUsageSnapshot().categories.classification.invalidOutputs).toBe(2);
  });

  it("rejects truncated output (finish reason other than STOP)", async () => {
    const deps = fakeDeps([{ text: '{"ok":true}', finishReason: "MAX_TOKENS" }, good]);
    expect(await callGeminiJson(req(), deps)).toMatchObject({ ok: true, retries: 1 });
  });

  it("retries 429 using the API's retry delay, and 5xx/network errors with jittered backoff", async () => {
    const limited = new ApiError({ status: 429, message: '{"error":{"details":[{"retryDelay":"2s"}]}}' });
    const deps = fakeDeps([limited, new ApiError({ status: 503, message: "unavailable" }), good]);
    const r = await callGeminiJson(req({ category: "evaluation" }), deps);
    expect(r).toMatchObject({ ok: true, retries: 2 });
    expect(deps.sleeps[0]).toBeGreaterThanOrEqual(2_000); // honoured retryDelay
    expect(deps.sleeps).toHaveLength(2);
    const u = getUsageSnapshot().categories.evaluation;
    expect(u).toMatchObject({ requests: 3, retries: 2, rateLimitEvents: 1, successes: 1 });
  });

  it("never waits past the category deadline", async () => {
    const limited = new ApiError({ status: 429, message: '"retryDelay": "60s"' });
    const deps = fakeDeps([limited, good]);
    const r = await callGeminiJson(req(), deps);
    expect(r).toMatchObject({ ok: false, reason: "rate_limited" });
    expect(deps.sent).toBe(1);
    expect(CATEGORY_DEADLINE_MS.classification).toBeLessThan(60_000);
  });

  it("does not retry configuration errors or exhausted daily quota", async () => {
    const deps = fakeDeps([new ApiError({ status: 404, message: "model not found" })]);
    expect(await callGeminiJson(req(), deps)).toMatchObject({ ok: false, reason: "not_configured" });
    const q = fakeDeps([
      new ApiError({ status: 429, message: "Quota exceeded for metric requests per day" }),
    ]);
    expect(await callGeminiJson(req(), q)).toMatchObject({ ok: false, reason: "quota_exhausted" });
    expect(q.sent).toBe(1);
  });

  it("rate-limits per user and globally before sending anything", async () => {
    process.env.GEMINI_MAX_RPM = "1000";
    for (let i = 0; i < PER_USER_CALLS_PER_10_MIN; i++) await callGeminiJson(req(), fakeDeps([good]));
    const blocked = fakeDeps([good]);
    expect(await callGeminiJson(req(), blocked)).toMatchObject({ ok: false, reason: "rate_limited" });
    expect(blocked.sent).toBe(0);
    expect(await callGeminiJson(req({ rateKey: "user-2" }), fakeDeps([good]))).toMatchObject({ ok: true });

    resetRateLimits();
    process.env.GEMINI_MAX_RPM = "2";
    await callGeminiJson(req({ rateKey: "a" }), fakeDeps([good]));
    await callGeminiJson(req({ rateKey: "b" }), fakeDeps([good]));
    expect(await callGeminiJson(req({ rateKey: "c" }), fakeDeps([good]))).toMatchObject({
      reason: "rate_limited",
    });
  });
});

describe("error helpers", () => {
  it("parses retry delays and classifies errors", () => {
    expect(retryDelayFromMessage('"retryDelay": "12s"')).toBe(12_000);
    expect(retryDelayFromMessage('"retryDelay":"0.5s"')).toBe(500);
    expect(retryDelayFromMessage("nothing")).toBeUndefined();
    expect(classifyError(Object.assign(new Error("aborted"), { name: "AbortError" }))).toMatchObject({
      reason: "timeout",
      retryable: true,
    });
    expect(classifyError(new ApiError({ status: 500, message: "x" }))).toMatchObject({
      reason: "api_error",
      retryable: true,
    });
    expect(classifyError(new TypeError("fetch failed"))).toMatchObject({ retryable: true });
  });

  it("backs off exponentially with jitter, capped", () => {
    expect(backoffMs(0, () => 0)).toBe(300);
    expect(backoffMs(0, () => 1)).toBe(600);
    expect(backoffMs(3, () => 1)).toBe(4_800);
    expect(backoffMs(10, () => 1)).toBe(8_000);
    expect(backoffMs(0, () => 0, 5_000)).toBe(5_000);
  });
});
