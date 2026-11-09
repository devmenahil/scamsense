import { describe, expect, it } from "vitest";
import { friendlyAuthError } from "./errors";

describe("friendlyAuthError", () => {
  it("maps known Supabase codes to calm messages", () => {
    expect(friendlyAuthError({ code: "user_already_exists", status: 422 }, "sign-up")).toMatchObject({
      status: 409,
      code: "duplicate_email",
      field: "email",
    });
    expect(friendlyAuthError({ code: "invalid_credentials", status: 400 }, "sign-in").status).toBe(401);
    expect(friendlyAuthError({ code: "email_not_confirmed", status: 400 }, "sign-in").code).toBe(
      "email_not_confirmed",
    );
    expect(friendlyAuthError({ code: "over_email_send_rate_limit", status: 429 }, "reset").status).toBe(429);
    expect(friendlyAuthError({ code: "weak_password", status: 422 }, "sign-up").field).toBe("password");
  });

  it("treats fetch failures as network errors", () => {
    expect(friendlyAuthError({ name: "AuthRetryableFetchError", status: 0 }, "sign-in").code).toBe("network");
  });

  it("never echoes raw internal messages", () => {
    const f = friendlyAuthError(
      { code: "unexpected_failure", status: 500, message: "Database error saving new user: relation x" },
      "sign-up",
    );
    expect(f.message).not.toMatch(/Database|relation/);
    expect(f.status).toBe(500);
  });
});
