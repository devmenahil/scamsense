import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildCheckoutRequest } from "./checkout";
import { createPayPalClient, SandboxGuardError } from "./paypal";

const SANDBOX = "https://api-m.sandbox.paypal.com";
const SECRET = "sandbox-secret-value";
const TOKEN = "A21AA-sandbox-token";
const request = buildCheckoutRequest({
  attempt: {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    scenarioKey: "m2-s2",
    state: "PAYMENT_PENDING",
    isPractice: false,
    decisionId: "place_order",
  },
  run: { currency: "USD", startingFundsMinor: 300_000 },
  payableDecisionIds: ["place_order"],
  display: { payee: "Circuitry Market", description: "Aster 14 Laptop" },
  checkoutSequence: 1,
});
const order = (status: string) => ({
  id: "ORDER1",
  status,
  purchase_units: [{ custom_id: request.attemptId, amount: { currency_code: "USD", value: "360.00" } }],
});

type Reply = { status: number; body: unknown } | "network";

function mockFetch(replies: Reply[]) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fn = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    const r = String(url).endsWith("/v1/oauth2/token")
      ? { status: 200, body: { access_token: TOKEN, expires_in: 32400 } }
      : replies.shift();
    if (!r || r === "network") throw new TypeError("fetch failed");
    return new Response(JSON.stringify(r.body), {
      status: r.status,
      headers: { "content-type": "application/json" },
    });
  });
  return { fn: fn as unknown as typeof fetch, calls };
}

const client = (f: typeof fetch) =>
  createPayPalClient({ clientId: "sandbox-client-id", clientSecret: SECRET, apiBase: SANDBOX, fetch: f });

let warn: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  warn = vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => warn.mockRestore());

describe("PayPal Orders v2 client (Sandbox only)", () => {
  it("refuses any API base other than the Sandbox host", () => {
    for (const base of [
      "https://api-m.paypal.com",
      "https://api.paypal.com",
      "http://api-m.sandbox.paypal.com",
    ]) {
      expect(() => createPayPalClient({ clientId: "x", clientSecret: "y", apiBase: base })).toThrow(
        SandboxGuardError,
      );
    }
  });

  it("creates an order on the Sandbox endpoint with the idempotent PayPal-Request-Id and a cached token", async () => {
    const m = mockFetch([
      { status: 201, body: order("CREATED") },
      { status: 200, body: order("CREATED") }, // PayPal returns the same order for a repeated request id
    ]);
    const c = client(m.fn);
    const a = await c.createOrder(request);
    const b = await c.createOrder(request);
    expect(a).toMatchObject({
      ok: true,
      value: { orderId: "ORDER1", status: "CREATED", amountMinor: 36_000 },
    });
    expect(b).toEqual(a);
    const tokenCalls = m.calls.filter((x) => x.url.endsWith("/v1/oauth2/token"));
    expect(tokenCalls).toHaveLength(1);
    const creates = m.calls.filter((x) => x.url === `${SANDBOX}/v2/checkout/orders`);
    expect(creates).toHaveLength(2);
    for (const call of creates) {
      const h = call.init.headers as Record<string, string>;
      expect(h["PayPal-Request-Id"]).toBe(request.idempotencyKey);
      expect(h.Authorization).toBe(`Bearer ${TOKEN}`);
      expect(JSON.parse(String(call.init.body))).toMatchObject({
        intent: "CAPTURE",
        purchase_units: [{ amount: { currency_code: "USD", value: "360.00" }, custom_id: request.attemptId }],
      });
    }
    expect(m.calls.every((x) => x.url.startsWith(SANDBOX))).toBe(true);
  });

  it("captures with its own idempotent request id and maps PayPal errors", async () => {
    const m = mockFetch([
      { status: 422, body: { name: "UNPROCESSABLE_ENTITY", details: [{ issue: "INSTRUMENT_DECLINED" }] } },
      { status: 422, body: { name: "UNPROCESSABLE_ENTITY", details: [{ issue: "ORDER_ALREADY_CAPTURED" }] } },
      { status: 500, body: { name: "INTERNAL_SERVER_ERROR" } },
      {
        status: 409,
        body: { name: "RESOURCE_CONFLICT", details: [{ issue: "PREVIOUS_REQUEST_IN_PROGRESS" }] },
      },
      "network",
    ]);
    const c = client(m.fn);
    expect(await c.captureOrder("ORDER1", "cap-1")).toEqual({
      ok: false,
      error: { kind: "rejected", status: 422, issue: "INSTRUMENT_DECLINED" },
    });
    expect(await c.captureOrder("ORDER1", "cap-1")).toMatchObject({
      error: { issue: "ORDER_ALREADY_CAPTURED" },
    });
    // 5xx, in-progress, and network errors mean "unknown": callers reconcile, they never capture again.
    expect(await c.captureOrder("ORDER1", "cap-1")).toMatchObject({
      error: { kind: "unavailable", status: 500 },
    });
    expect(await c.captureOrder("ORDER1", "cap-1")).toMatchObject({
      error: { kind: "unavailable", status: 409 },
    });
    expect(await c.captureOrder("ORDER1", "cap-1")).toMatchObject({
      error: { kind: "unavailable", status: null },
    });
    const captures = m.calls.filter((x) => x.url.endsWith("/capture"));
    expect(
      captures.every((x) => (x.init.headers as Record<string, string>)["PayPal-Request-Id"] === "cap-1"),
    ).toBe(true);
    expect(await c.captureOrder("../evil", "cap-1")).toMatchObject({
      ok: false,
      error: { kind: "rejected" },
    });
  });

  it("refreshes an expired token once on 401", async () => {
    const m = mockFetch([
      { status: 401, body: { error: "invalid_token" } },
      { status: 200, body: order("APPROVED") },
    ]);
    expect(await client(m.fn).getOrder("ORDER1")).toMatchObject({ ok: true, value: { status: "APPROVED" } });
    expect(m.calls.filter((x) => x.url.endsWith("/v1/oauth2/token"))).toHaveLength(2);
  });

  it("never logs the secret, the token, or credentials", async () => {
    const m = mockFetch([
      { status: 422, body: { name: "UNPROCESSABLE_ENTITY", details: [{ issue: "X" }] } },
      "network",
    ]);
    const c = client(m.fn);
    await c.getOrder("ORDER1");
    await c.getOrder("ORDER1");
    const logged = JSON.stringify(warn.mock.calls);
    expect(logged).not.toContain(SECRET);
    expect(logged).not.toContain(TOKEN);
    expect(logged).not.toContain("sandbox-client-id");
  });
});
