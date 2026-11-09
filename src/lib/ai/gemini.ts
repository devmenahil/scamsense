import "server-only";
/**
 * The ONE place ScamSense talks to Gemini (official @google/genai SDK). Every call:
 *   • asks for structured JSON (`responseJsonSchema`) and re-validates it with the caller's Zod-based parser;
 *   • has a bounded deadline (per category) and a per-request timeout (GEMINI_TIMEOUT_MS, capped by the deadline);
 *   • retries at most twice on timeouts, network errors, 429 and 5xx, with exponential backoff + jitter, honouring the
 *     API's retry delay when it gives one (never waiting past the deadline); invalid output is retried once;
 *   • passes a server-side rate limiter (global RPM + per-user budget) before sending anything;
 *   • records counters in the development usage monitor (no prompts, outputs, or personal data).
 * It never throws for operational problems: callers get `{ ok: false, reason }` and use their deterministic fallback
 * (R27). The model name comes only from GEMINI_MODEL (CLAUDE.md); the key never leaves the server.
 */
import { ApiError, GoogleGenAI, ThinkingLevel } from "@google/genai";
import { getServerEnv } from "@/lib/env";
import { recordUsage, type GeminiCategory } from "./usage";

import { InvalidOutputError } from "./errors";
export { InvalidOutputError };

export type GeminiFailure =
  "not_configured" | "rate_limited" | "quota_exhausted" | "timeout" | "invalid_output" | "api_error";

export type GeminiResult<T> =
  | {
      ok: true;
      value: T;
      model: string;
      usage: { inputTokens: number; outputTokens: number };
      latencyMs: number;
      retries: number;
    }
  | { ok: false; reason: GeminiFailure; retries: number; latencyMs: number };

export interface GeminiJsonRequest<T> {
  category: GeminiCategory;
  /** Rate-limit key (the user id from the verified session); never sent to Gemini. */
  rateKey: string;
  systemInstruction: string;
  prompt: string;
  /** JSON Schema for structured output (Gemini enforces it; `parse` still re-validates). */
  jsonSchema: Record<string, unknown>;
  /** Validates and normalizes the parsed JSON. Throw InvalidOutputError (or any error) to reject it. */
  parse: (raw: unknown) => T;
  maxOutputTokens: number;
  temperature?: number;
  thinking?: "minimal" | "low";
}

/** The raw transport (the SDK in production, a fake in tests). */
export type GenerateFn = (args: {
  model: string;
  systemInstruction: string;
  prompt: string;
  jsonSchema: Record<string, unknown>;
  maxOutputTokens: number;
  temperature: number;
  thinking: "minimal" | "low";
  timeoutMs: number;
}) => Promise<{
  text: string | undefined;
  finishReason?: string;
  inputTokens?: number;
  outputTokens?: number;
}>;

export interface GeminiDeps {
  generate: GenerateFn;
  model: string;
  requestTimeoutMs: number;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
  random: () => number;
}

/** Total time a category may spend, including retries (a page should never hang on Gemini). */
export const CATEGORY_DEADLINE_MS: Record<GeminiCategory, number> = {
  classification: 12_000,
  personalization: 20_000,
  evaluation: 35_000,
};
export const MAX_RETRIES = 2;
const BASE_BACKOFF_MS = 600;
const MAX_BACKOFF_MS = 8_000;

/* ------------------------------------------------------------------------------------------------ rate limiting */

/** Global requests per minute (free tier friendly; override with GEMINI_MAX_RPM). */
const DEFAULT_MAX_RPM = 12;
/** Per-user logical calls per 10 minutes: far above legitimate play (≈2 per scenario), well below abuse. */
export const PER_USER_CALLS_PER_10_MIN = 24;

const globalWindow: number[] = [];
const userWindows = new Map<string, number[]>();

function prune(list: number[], now: number, windowMs: number) {
  while (list.length > 0 && now - list[0]! > windowMs) list.shift();
}

/** Reserves a slot for one logical call, or returns false when the user's or the global budget is spent. */
export function takeRateLimitSlot(rateKey: string, now: number, maxRpm: number): boolean {
  prune(globalWindow, now, 60_000);
  const mine = userWindows.get(rateKey) ?? [];
  prune(mine, now, 600_000);
  if (globalWindow.length >= maxRpm || mine.length >= PER_USER_CALLS_PER_10_MIN) return false;
  globalWindow.push(now);
  mine.push(now);
  userWindows.set(rateKey, mine);
  return true;
}

export function resetRateLimits(): void {
  globalWindow.length = 0;
  userWindows.clear();
}

/* ------------------------------------------------------------------------------------------------ errors */

type Classified = { retryable: boolean; reason: GeminiFailure; retryAfterMs?: number };

/** Parses "retryDelay": "12s" (google.rpc.RetryInfo) from an API error message, if present. */
export function retryDelayFromMessage(message: string): number | undefined {
  const m = message.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/);
  return m ? Math.ceil(Number(m[1]) * 1000) : undefined;
}

export function classifyError(e: unknown): Classified {
  if (e instanceof InvalidOutputError || e instanceof SyntaxError)
    return { retryable: true, reason: "invalid_output" };
  if (
    e instanceof Error &&
    (e.name === "AbortError" || e.name === "TimeoutError" || /timed? ?out/i.test(e.message))
  )
    return { retryable: true, reason: "timeout" };
  const status = e instanceof ApiError ? e.status : (e as { status?: unknown })?.status;
  if (typeof status === "number") {
    const message = e instanceof Error ? e.message : "";
    if (status === 429) {
      const quota = /quota|per day|PerDay|exhausted/i.test(message) && !/per minute|PerMinute/i.test(message);
      return {
        retryable: !quota,
        reason: quota ? "quota_exhausted" : "rate_limited",
        retryAfterMs: retryDelayFromMessage(message),
      };
    }
    if (status === 400 || status === 401 || status === 403 || status === 404)
      return { retryable: false, reason: "not_configured" };
    if (status >= 500) return { retryable: true, reason: "api_error" };
    return { retryable: false, reason: "api_error" };
  }
  // fetch failures and other network errors
  return { retryable: true, reason: "api_error" };
}

/** Exponential backoff with full jitter, or the server's retry delay (+ a little jitter) when provided. */
export function backoffMs(attempt: number, random: () => number, retryAfterMs?: number): number {
  if (retryAfterMs !== undefined) return retryAfterMs + Math.floor(random() * 250);
  const ceiling = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** attempt);
  return Math.floor(ceiling / 2 + random() * (ceiling / 2));
}

/* ------------------------------------------------------------------------------------------------ core */

export async function callGeminiJson<T>(
  req: GeminiJsonRequest<T>,
  deps: GeminiDeps | null,
): Promise<GeminiResult<T>> {
  const started = deps?.now() ?? Date.now();
  if (!deps) {
    recordUsage(req.category, { errors: 1 });
    return { ok: false, reason: "not_configured", retries: 0, latencyMs: 0 };
  }
  const maxRpm =
    Number(process.env.GEMINI_MAX_RPM) > 0 ? Number(process.env.GEMINI_MAX_RPM) : DEFAULT_MAX_RPM;
  if (!takeRateLimitSlot(req.rateKey, deps.now(), maxRpm)) {
    recordUsage(req.category, { rateLimitEvents: 1 });
    return { ok: false, reason: "rate_limited", retries: 0, latencyMs: 0 };
  }
  const deadline = started + CATEGORY_DEADLINE_MS[req.category];
  let retries = 0;
  let invalidRetried = false;
  let last: Classified = { retryable: false, reason: "api_error" };

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const remaining = deadline - deps.now();
    if (remaining < 1_000) {
      last = { retryable: false, reason: "timeout" };
      break;
    }
    try {
      recordUsage(req.category, { requests: 1 }, deps.model);
      const res = await deps.generate({
        model: deps.model,
        systemInstruction: req.systemInstruction,
        prompt: req.prompt,
        jsonSchema: req.jsonSchema,
        maxOutputTokens: req.maxOutputTokens,
        temperature: req.temperature ?? 0.4,
        thinking: req.thinking ?? "minimal",
        timeoutMs: Math.min(deps.requestTimeoutMs, remaining),
      });
      recordUsage(req.category, { inputTokens: res.inputTokens ?? 0, outputTokens: res.outputTokens ?? 0 });
      if (!res.text) throw new InvalidOutputError("empty response");
      if (res.finishReason && res.finishReason !== "STOP")
        throw new InvalidOutputError(`finish ${res.finishReason}`);
      const value = req.parse(JSON.parse(res.text));
      recordUsage(req.category, { successes: 1 });
      return {
        ok: true,
        value,
        model: deps.model,
        usage: { inputTokens: res.inputTokens ?? 0, outputTokens: res.outputTokens ?? 0 },
        latencyMs: deps.now() - started,
        retries,
      };
    } catch (e) {
      last = classifyError(
        e instanceof Error && !(e instanceof InvalidOutputError) && isParseFailure(e)
          ? new InvalidOutputError(e.message)
          : e,
      );
      if (last.reason === "invalid_output") {
        recordUsage(req.category, { invalidOutputs: 1 });
        if (invalidRetried) break;
        invalidRetried = true;
      } else if (last.reason === "rate_limited" || last.reason === "quota_exhausted") {
        recordUsage(req.category, { rateLimitEvents: 1, errors: 1 });
      } else {
        recordUsage(req.category, { errors: 1 });
      }
      // Log the category and reason only (never the prompt, output, or user data).
      console.warn("[gemini] call failed", { category: req.category, reason: last.reason, attempt });
      if (!last.retryable || attempt === MAX_RETRIES) break;
      const wait = backoffMs(attempt, deps.random, last.retryAfterMs);
      if (deps.now() + wait > deadline - 1_000) break;
      retries++;
      recordUsage(req.category, { retries: 1 });
      await deps.sleep(wait);
    }
  }
  return { ok: false, reason: last.reason, retries, latencyMs: deps.now() - started };
}

/** Zod and validation failures from `parse` are invalid output, not transport errors. */
function isParseFailure(e: Error): boolean {
  return e.name === "ZodError" || e.name === "$ZodError";
}

/* ------------------------------------------------------------------------------------------------ production deps */

let sdkClient: GoogleGenAI | null = null;
let testDeps: GeminiDeps | null | undefined;

/** Tests inject a fake transport (or null = "not configured"); `undefined` restores the real SDK. */
export function setGeminiDepsForTests(deps: GeminiDeps | null | undefined): void {
  testDeps = deps;
}

export function isGeminiConfigured(): boolean {
  if (testDeps !== undefined) return testDeps !== null;
  const env = getServerEnv();
  return !!env.GEMINI_API_KEY && !!env.GEMINI_MODEL;
}

export function geminiDeps(): GeminiDeps | null {
  if (testDeps !== undefined) return testDeps;
  const env = getServerEnv();
  if (!env.GEMINI_API_KEY || !env.GEMINI_MODEL) return null;
  sdkClient ??= new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  const client = sdkClient;
  return {
    model: env.GEMINI_MODEL,
    requestTimeoutMs: env.GEMINI_TIMEOUT_MS,
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    now: () => Date.now(),
    random: Math.random,
    generate: async (a) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), a.timeoutMs);
      try {
        const res = await client.models.generateContent({
          model: a.model,
          contents: a.prompt,
          config: {
            systemInstruction: a.systemInstruction,
            responseMimeType: "application/json",
            responseJsonSchema: a.jsonSchema,
            maxOutputTokens: a.maxOutputTokens,
            temperature: a.temperature,
            thinkingConfig: {
              thinkingLevel: a.thinking === "low" ? ThinkingLevel.LOW : ThinkingLevel.MINIMAL,
            },
            abortSignal: controller.signal,
            // Retries are ours (bounded, jittered, deadline-aware): the SDK's own retry loop is switched off.
            httpOptions: { timeout: a.timeoutMs, retryOptions: { attempts: 1 } },
          },
        });
        return {
          text: res.text,
          finishReason: res.candidates?.[0]?.finishReason,
          inputTokens: res.usageMetadata?.promptTokenCount,
          outputTokens:
            (res.usageMetadata?.candidatesTokenCount ?? 0) + (res.usageMetadata?.thoughtsTokenCount ?? 0),
        };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

/** Convenience: call with the configured (or test) dependencies. */
export function generateJson<T>(req: GeminiJsonRequest<T>): Promise<GeminiResult<T>> {
  return callGeminiJson(req, geminiDeps());
}

/**
 * Wraps untrusted user text for a prompt: quotes are neutralized and the text is fenced, so it reads as DATA. The
 * system instruction tells the model that fenced text is never an instruction (prompt-injection defence; outputs are
 * validated regardless).
 */
export function fenceUntrusted(label: string, text: string | null | undefined, max = 1_200): string {
  const clean = (text ?? "")
    .slice(0, max)
    .replace(/<\/?untrusted[^>]*>/gi, "")
    .replace(/[\u0000-\u001f\u007f]/g, " ");
  return `<untrusted name="${label}">${clean}</untrusted>`;
}
