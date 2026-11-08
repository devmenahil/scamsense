import { describe, expect, it } from "vitest";
import { PAYPAL_SANDBOX_API_BASE, parseEnv, serverEnvSchema } from "./env.schema";

describe("serverEnvSchema", () => {
  it("defaults to PayPal Sandbox when PayPal vars are blank", () => {
    const env = parseEnv(serverEnvSchema, { PAYPAL_ENV: "", PAYPAL_API_BASE: "" });
    expect(env.PAYPAL_ENV).toBe("sandbox");
    expect(env.PAYPAL_API_BASE).toBe(PAYPAL_SANDBOX_API_BASE);
    expect(env.GEMINI_TIMEOUT_MS).toBe(9000);
  });

  it("refuses a live PayPal environment", () => {
    expect(() => parseEnv(serverEnvSchema, { PAYPAL_ENV: "live" })).toThrow(/PAYPAL_ENV/);
  });

  it("refuses the live PayPal API host", () => {
    expect(() => parseEnv(serverEnvSchema, { PAYPAL_API_BASE: "https://api-m.paypal.com" })).toThrow(
      /PAYPAL_API_BASE/,
    );
  });

  it("treats blank optional values as unset but rejects malformed URLs", () => {
    expect(
      parseEnv(serverEnvSchema, { NEXT_PUBLIC_SUPABASE_URL: "" }).NEXT_PUBLIC_SUPABASE_URL,
    ).toBeUndefined();
    expect(() => parseEnv(serverEnvSchema, { NEXT_PUBLIC_SUPABASE_URL: "not a url" })).toThrow(
      /NEXT_PUBLIC_SUPABASE_URL/,
    );
  });

  it("never prints secret values in errors", () => {
    try {
      parseEnv(serverEnvSchema, { PAYPAL_ENV: "super-secret-value" });
    } catch (e) {
      expect(String(e)).not.toContain("super-secret-value");
    }
  });
});
