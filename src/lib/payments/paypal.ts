/**
 * PayPal Orders v2 REST client — SANDBOX ONLY (R28, R31). Server code only: it holds the client secret and OAuth token.
 *
 * Guards: `assertSandbox()` refuses any API base other than https://api-m.sandbox.paypal.com (the env schema also
 * rejects PAYPAL_ENV ≠ sandbox at startup). Secrets and tokens are never logged or returned; logs carry the operation,
 * HTTP status, PayPal issue code and debug id only.
 *
 * Every call has a timeout. A timeout or network/5xx error is reported as `unavailable`: the outcome is UNKNOWN, so
 * callers must reconcile by reading the order later — never by sending a second capture.
 *
 * Pure-ish: `createPayPalClient()` takes its config and `fetch`, so tests can drive it with mocked responses.
 */
import "server-only";
import { PAYPAL_SANDBOX_API_BASE } from "@/lib/env.schema";
import { buildOrderBody, parseOrder, type CheckoutRequest, type OrderSnapshot } from "./checkout";

export interface PayPalConfig {
  clientId: string;
  clientSecret: string;
  apiBase: string;
  timeoutMs?: number;
  fetch?: typeof fetch;
}

export type PayPalFailure =
  | { kind: "not_configured" }
  /** Network error, timeout, 5xx, or an unreadable response: the result is unknown. */
  | { kind: "unavailable"; status: number | null }
  /** PayPal answered with a 4xx (e.g. ORDER_NOT_APPROVED, INSTRUMENT_DECLINED, ORDER_ALREADY_CAPTURED). */
  | { kind: "rejected"; status: number; issue: string | null };

export type PayPalResult<T> = { ok: true; value: T } | { ok: false; error: PayPalFailure };

export interface PayPalClient {
  createOrder(request: CheckoutRequest): Promise<PayPalResult<OrderSnapshot>>;
  captureOrder(orderId: string, requestId: string): Promise<PayPalResult<OrderSnapshot>>;
  getOrder(orderId: string): Promise<PayPalResult<OrderSnapshot>>;
}

export class SandboxGuardError extends Error {
  constructor() {
    super("ScamSense only talks to the PayPal Sandbox API.");
    this.name = "SandboxGuardError";
  }
}

export function assertSandbox(apiBase: string): void {
  if (apiBase !== PAYPAL_SANDBOX_API_BASE) throw new SandboxGuardError();
}

const ORDER_ID = /^[A-Z0-9]{1,64}$/i;

function log(op: string, status: number | null, issue: string | null, debugId: string | null) {
  // Operational metadata only: no tokens, no secrets, no payer data, no amounts tied to people.
  console.warn("[paypal]", { op, status, issue, debugId });
}

export function createPayPalClient(config: PayPalConfig): PayPalClient {
  assertSandbox(config.apiBase);
  const doFetch = config.fetch ?? fetch;
  const timeoutMs = config.timeoutMs ?? 15_000;
  let token: { value: string; expiresAt: number } | null = null;

  async function getToken(): Promise<PayPalResult<string>> {
    if (token && token.expiresAt > Date.now()) return { ok: true, value: token.value };
    let res: Response;
    try {
      res = await doFetch(`${config.apiBase}/v1/oauth2/token`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "grant_type=client_credentials",
        signal: AbortSignal.timeout(timeoutMs),
        cache: "no-store",
      });
    } catch {
      log("oauth", null, "network", null);
      return { ok: false, error: { kind: "unavailable", status: null } };
    }
    const body = (await res.json().catch(() => null)) as {
      access_token?: string;
      expires_in?: number;
    } | null;
    if (!res.ok || !body?.access_token) {
      log("oauth", res.status, null, res.headers.get("paypal-debug-id"));
      return res.status >= 500
        ? { ok: false, error: { kind: "unavailable", status: res.status } }
        : { ok: false, error: { kind: "rejected", status: res.status, issue: "AUTHENTICATION_FAILURE" } };
    }
    const lifetime = Math.max(60, Number(body.expires_in) || 300);
    // Refresh a minute before PayPal's expiry.
    token = { value: body.access_token, expiresAt: Date.now() + (lifetime - 60) * 1000 };
    return { ok: true, value: token.value };
  }

  async function call(
    op: string,
    method: "GET" | "POST",
    path: string,
    init: { requestId?: string; body?: unknown } = {},
    retried = false,
  ): Promise<PayPalResult<OrderSnapshot>> {
    const t = await getToken();
    if (!t.ok) return t;
    let res: Response;
    try {
      res = await doFetch(`${config.apiBase}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${t.value}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
          ...(init.requestId ? { "PayPal-Request-Id": init.requestId } : {}),
        },
        body: method === "POST" ? JSON.stringify(init.body ?? {}) : undefined,
        signal: AbortSignal.timeout(timeoutMs),
        cache: "no-store",
      });
    } catch {
      log(op, null, "network", null);
      return { ok: false, error: { kind: "unavailable", status: null } };
    }
    const json = (await res.json().catch(() => null)) as {
      name?: string;
      details?: { issue?: string }[];
    } | null;
    if (res.status === 401 && !retried) {
      token = null; // expired or revoked token: fetch a new one once
      return call(op, method, path, init, true);
    }
    if (!res.ok) {
      const issue = json?.details?.[0]?.issue ?? json?.name ?? null;
      log(op, res.status, issue, res.headers.get("paypal-debug-id"));
      return res.status >= 500 || res.status === 409 // 409: PREVIOUS_REQUEST_IN_PROGRESS — outcome not known yet
        ? { ok: false, error: { kind: "unavailable", status: res.status } }
        : { ok: false, error: { kind: "rejected", status: res.status, issue } };
    }
    const order = parseOrder(json);
    if (!order) {
      log(op, res.status, "unparseable_response", res.headers.get("paypal-debug-id"));
      return { ok: false, error: { kind: "unavailable", status: res.status } };
    }
    return { ok: true, value: order };
  }

  return {
    createOrder: (request) =>
      call("create_order", "POST", "/v2/checkout/orders", {
        requestId: request.idempotencyKey,
        body: buildOrderBody(request),
      }),
    captureOrder: (orderId, requestId) => {
      if (!ORDER_ID.test(orderId)) {
        return Promise.resolve({
          ok: false,
          error: { kind: "rejected", status: 400, issue: "INVALID_ORDER_ID" },
        });
      }
      return call("capture_order", "POST", `/v2/checkout/orders/${orderId}/capture`, { requestId });
    },
    getOrder: (orderId) => {
      if (!ORDER_ID.test(orderId)) {
        return Promise.resolve({
          ok: false,
          error: { kind: "rejected", status: 400, issue: "INVALID_ORDER_ID" },
        });
      }
      return call("get_order", "GET", `/v2/checkout/orders/${orderId}`);
    },
  };
}
