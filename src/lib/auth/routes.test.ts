import { describe, expect, it } from "vitest";
import { classifyRoute, redirectFor, type AccessState } from "./routes";
import { safeNextPath } from "./schema";

const signedOut: AccessState = { signedIn: false, onboarded: null };
const newUser: AccessState = { signedIn: true, onboarded: false };
const onboarded: AccessState = { signedIn: true, onboarded: true };
const unknown: AccessState = { signedIn: true, onboarded: null };

describe("classifyRoute", () => {
  it("classifies pages", () => {
    expect(classifyRoute("/dashboard")).toBe("app");
    expect(classifyRoute("/play/abc/results")).toBe("app");
    expect(classifyRoute("/profile")).toBe("app");
    expect(classifyRoute("/onboarding")).toBe("onboarding");
    expect(classifyRoute("/reset-password")).toBe("reset-password");
    expect(classifyRoute("/sign-in")).toBe("guest-only");
    expect(classifyRoute("/")).toBe("public");
    expect(classifyRoute("/playbook")).toBe("public");
    expect(classifyRoute("/forgot-password")).toBe("public");
    expect(classifyRoute("/profiles-public")).toBe("public");
  });
});

describe("redirectFor", () => {
  it("sends signed-out visitors of private pages to sign-in with a return path", () => {
    expect(redirectFor("/profile", "?tab=1", signedOut)).toBe("/sign-in?next=%2Fprofile%3Ftab%3D1");
    expect(redirectFor("/onboarding", "", signedOut)).toBe("/sign-in?next=%2Fonboarding");
    expect(redirectFor("/dashboard", "", { ...signedOut, sessionExpired: true })).toContain("notice=expired");
    expect(redirectFor("/", "", signedOut)).toBeNull();
    expect(redirectFor("/sign-up", "", signedOut)).toBeNull();
  });

  it("routes new users to onboarding and onboarded users away from it", () => {
    expect(redirectFor("/dashboard", "", newUser)).toBe("/onboarding");
    expect(redirectFor("/onboarding", "", newUser)).toBeNull();
    expect(redirectFor("/onboarding", "", onboarded)).toBe("/dashboard");
    expect(redirectFor("/dashboard", "", onboarded)).toBeNull();
    expect(redirectFor("/sign-in", "", onboarded)).toBe("/dashboard");
    expect(redirectFor("/sign-in", "", newUser)).toBe("/onboarding");
  });

  it("never redirects when onboarding state is unknown (the page shows an error instead)", () => {
    expect(redirectFor("/dashboard", "", unknown)).toBeNull();
    expect(redirectFor("/onboarding", "", unknown)).toBeNull();
  });

  it("is loop-free: following redirects always settles within one hop", () => {
    const paths = [
      "/",
      "/sign-in",
      "/sign-up",
      "/dashboard",
      "/profile",
      "/onboarding",
      "/reset-password",
      "/modules/x",
    ];
    for (const state of [signedOut, newUser, onboarded, unknown]) {
      for (const p of paths) {
        const first = redirectFor(p, "", state);
        if (first === null) continue;
        const target = first.split("?")[0]!;
        expect(redirectFor(target, "", state), `${p} → ${target}`).toBeNull();
      }
    }
  });
});

describe("safeNextPath", () => {
  it("only allows same-site relative paths", () => {
    expect(safeNextPath("/profile")).toBe("/profile");
    expect(safeNextPath("https://evil.example")).toBe("/dashboard");
    expect(safeNextPath("//evil.example")).toBe("/dashboard");
    expect(safeNextPath("/\\evil.example")).toBe("/dashboard");
    expect(safeNextPath("/api/profile")).toBe("/dashboard");
    expect(safeNextPath(undefined, "/onboarding")).toBe("/onboarding");
  });
});
