/**
 * LIVE integration tests against the configured Supabase project (no mocks).
 *
 *   npm run test:integration
 *
 * Layer 1 talks to the Supabase Data/Auth APIs directly with the publishable key, exactly as a malicious browser
 * could, to prove the database itself enforces ownership (RLS + grants + constraints).
 * Layer 2 drives the ScamSense API routes of a running app (APP_URL, default http://localhost:3000), with a cookie
 * jar per user, to prove the end-to-end flows. Layer 2 is skipped when the app isn't reachable.
 *
 * Requirements: .env.local with NEXT_PUBLIC_SUPABASE_URL + publishable key; the profiles migration applied; and
 * "Confirm email" switched OFF in Supabase Auth (otherwise new test accounts cannot sign in without a mailbox).
 * Creates fictional accounts at INTEGRATION_EMAIL_DOMAIN (default example.com). They are left in Auth; delete them
 * from the dashboard afterwards if you wish.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { existsSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const APP = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
const DOMAIN = process.env.INTEGRATION_EMAIL_DOMAIN ?? "example.com";
const RUN = Date.now().toString(36);
const PASSWORD = `Practice-not-panic-${RUN}`;

const email = (who: string) => `scamsense.it.${who}.${RUN}@${DOMAIN}`;
const client = () => createClient(URL_, KEY, { auth: { persistSession: false, autoRefreshToken: false } });

async function signUpDirect(who: string, meta: Record<string, unknown>) {
  const c = client();
  const res = await c.auth.signUp({ email: email(who), password: PASSWORD, options: { data: meta } });
  return { c, res };
}

describe.skipIf(!URL_ || !KEY)("Supabase database security (Data API, publishable key)", () => {
  let alice: SupabaseClient;
  let bob: SupabaseClient;
  let aliceId = "";
  let bobId = "";

  beforeAll(async () => {
    const a = await signUpDirect("alice", {
      display_name: "Alice Tester",
      age_confirmed: true,
      age_bracket: "25_34",
    });
    const b = await signUpDirect("bob", { display_name: "Bob Tester", age_confirmed: true });
    for (const r of [a, b]) {
      if (r.res.error) throw new Error(`sign-up failed: ${r.res.error.code} ${r.res.error.message}`);
      if (!r.res.data.session) {
        throw new Error(
          'No session after sign-up: switch OFF "Confirm email" in Supabase Auth to run these tests.',
        );
      }
    }
    alice = a.c;
    bob = b.c;
    aliceId = a.res.data.user!.id;
    bobId = b.res.data.user!.id;
  });

  it("creates a profile row from sign-up metadata via the trigger", async () => {
    const { data, error } = await alice.from("profiles").select("*").eq("user_id", aliceId).single();
    expect(error).toBeNull();
    expect(data).toMatchObject({
      display_name: "Alice Tester",
      age_confirmed: true,
      age_bracket: "25_34",
      preferred_currency: "USD",
      onboarding_completed: false,
      financial_activities: [],
    });
    expect(data).not.toHaveProperty("email");
    expect(data).not.toHaveProperty("password");
  });

  it("rejects registration without the 18+ confirmation (database-enforced)", async () => {
    const { res } = await signUpDirect("noage", { display_name: "No Confirm" });
    expect(res.error).not.toBeNull();
    expect(res.data.session).toBeNull();
  });

  it("each user sees only their own profile", async () => {
    const all = await alice.from("profiles").select("user_id");
    expect(all.error).toBeNull();
    expect(all.data!.map((r) => r.user_id)).toEqual([aliceId]);
    const other = await alice.from("profiles").select("*").eq("user_id", bobId);
    expect(other.data).toEqual([]);
  });

  it("a user cannot update another user's profile", async () => {
    const { data } = await alice
      .from("profiles")
      .update({ display_name: "Hacked" })
      .eq("user_id", bobId)
      .select();
    expect(data ?? []).toEqual([]);
    const bobView = await bob.from("profiles").select("display_name").eq("user_id", bobId).single();
    expect(bobView.data!.display_name).toBe("Bob Tester");
  });

  it("a user cannot insert, delete, or change protected columns", async () => {
    const ins = await alice
      .from("profiles")
      .insert({ user_id: bobId, display_name: "X", age_confirmed: true });
    expect(ins.error?.code).toBe("42501");
    await alice.from("profiles").delete().eq("user_id", aliceId);
    expect((await alice.from("profiles").select("user_id").eq("user_id", aliceId)).data).toHaveLength(1);
    for (const patch of [
      { user_id: bobId },
      { age_confirmed: false },
      { created_at: "2000-01-01T00:00:00Z" },
    ]) {
      const r = await alice.from("profiles").update(patch).eq("user_id", aliceId);
      expect(r.error?.code, JSON.stringify(patch)).toBe("42501");
    }
  });

  it("the database rejects unsupported currencies and invalid ids", async () => {
    for (const patch of [
      { preferred_currency: "JPY" },
      { preferred_currency: "GBP" }, // USD only until PayPal merchant verification
      { preferred_currency: "BTC" },
      { occupation: "astronaut" },
      { country: "XX" },
      { financial_activities: ["gambling"] },
      { goal_amount_minor: -5 },
      { onboarding_completed: true }, // required fields still missing
    ]) {
      const r = await alice.from("profiles").update(patch).eq("user_id", aliceId);
      expect(r.error?.code, JSON.stringify(patch)).toBe("23514");
    }
  });

  it("signed-out (anon) requests cannot read profiles", async () => {
    const r = await client().from("profiles").select("*");
    expect(r.data ?? []).toEqual([]);
    expect(r.error?.code).toBe("42501");
  });
});

/* ------------------------------------------------------------------------------------------------------------- */

class Jar {
  private cookies = new Map<string, string>();
  store(res: Response) {
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(";");
      const i = pair!.indexOf("=");
      const name = pair!.slice(0, i);
      const value = pair!.slice(i + 1);
      if (value === "" || /max-age=0/i.test(c)) this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
  }
  header() {
    return [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; ");
  }
  clear() {
    this.cookies.clear();
  }
}

async function call(jar: Jar, method: string, path: string, body?: unknown) {
  const res = await fetch(`${APP}${path}`, {
    method,
    redirect: "manual",
    headers: { cookie: jar.header(), ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  jar.store(res);
  const text = await res.text();
  // Response shapes vary per route; assertions below check them explicitly.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* html */
  }
  return { status: res.status, json, location: res.headers.get("location") };
}

const appUp = await fetch(`${APP}/api/config/currencies`)
  .then((r) => r.ok)
  .catch(() => false);

describe.skipIf(!URL_ || !KEY || !appUp)(`ScamSense app flows (${APP})`, () => {
  const carol = new Jar();
  const dave = new Jar();

  const carolProfile = {
    displayName: "Carol Freelancer",
    occupation: "freelancer",
    country: "GB",
    financialActivities: ["freelance_payments", "receiving_invoices", "sending_invoices"],
    paymentExperience: "frequent",
    incomeBracket: "2500_4999",
    financialGoal: "buying_laptop",
    customGoal: "A lighter laptop for client work",
    goalAmount: "1,250.50",
    preferredCurrency: "USD",
  };

  it("protects private pages and APIs when signed out", async () => {
    const page = await call(new Jar(), "GET", "/profile");
    expect(page.status).toBe(307);
    expect(page.location).toContain("/sign-in?next=%2Fprofile");
    const api = await call(new Jar(), "GET", "/api/profile");
    expect(api.status).toBe(401);
    expect(api.json.error.code).toBe("unauthenticated");
  });

  it("validates registration and requires the age confirmation", async () => {
    const r = await call(new Jar(), "POST", "/api/auth/sign-up", {
      displayName: "Carol",
      email: email("carol"),
      password: PASSWORD,
      ageConfirmed: false,
    });
    expect(r.status).toBe(400);
    expect(r.json.error.fields.ageConfirmed).toMatch(/at least 18/);
  });

  it("registers two users and starts them in onboarding", async () => {
    const a = await call(carol, "POST", "/api/auth/sign-up", {
      displayName: "Carol",
      email: email("carol"),
      password: PASSWORD,
      ageBracket: "35_44",
      ageConfirmed: true,
    });
    expect(a.status).toBe(201);
    expect(a.json.status).toBe("signed_in");
    const b = await call(dave, "POST", "/api/auth/sign-up", {
      displayName: "Dave Student",
      email: email("dave"),
      password: PASSWORD,
      ageConfirmed: true,
    });
    expect(b.status).toBe(201);
    const dash = await call(carol, "GET", "/dashboard");
    expect(dash.status).toBe(307);
    expect(dash.location).toContain("/onboarding");
  });

  it("rejects a duplicate registration", async () => {
    const r = await call(new Jar(), "POST", "/api/auth/sign-up", {
      displayName: "Carol Again",
      email: email("carol"),
      password: PASSWORD,
      ageConfirmed: true,
    });
    expect(r.status).toBe(409);
    expect(r.json.error.code).toBe("duplicate_email");
  });

  it("saves onboarding step by step (survives a refresh) and completes it", async () => {
    let r = await call(carol, "PATCH", "/api/profile", {
      displayName: carolProfile.displayName,
      occupation: carolProfile.occupation,
      country: carolProfile.country,
    });
    expect(r.status).toBe(200);
    // "Refresh": read back what was stored.
    r = await call(carol, "GET", "/api/profile");
    expect(r.json.profile).toMatchObject({
      occupation: "freelancer",
      country: "GB",
      onboardingCompleted: false,
    });

    r = await call(carol, "PATCH", "/api/profile", {
      financialActivities: carolProfile.financialActivities,
      paymentExperience: carolProfile.paymentExperience,
    });
    expect(r.status).toBe(200);

    // USD is the only selectable currency until PayPal merchant verification; GBP and JPY are refused server-side.
    for (const preferredCurrency of ["JPY", "GBP"]) {
      r = await call(carol, "PUT", "/api/profile", { ...carolProfile, preferredCurrency });
      expect(r.status).toBe(400);
      expect(r.json.error.fields.preferredCurrency).toBeDefined();
    }

    r = await call(carol, "PUT", "/api/profile", { ...carolProfile, occupation: "" });
    expect(r.status).toBe(400);
    expect(r.json.error.fields.occupation).toBeDefined();

    r = await call(carol, "PUT", "/api/profile", carolProfile);
    expect(r.status).toBe(200);
    expect(r.json.profile).toMatchObject({
      onboardingCompleted: true,
      goalAmountMinor: 125_050,
      preferredCurrency: "USD",
      incomeBracket: "2500_4999",
      incomeBracketLabel: "US$2,500–4,999 a month",
      ageBracket: "35_44",
    });
    expect((await call(carol, "GET", "/onboarding")).location).toContain("/dashboard");
    expect((await call(carol, "GET", "/dashboard")).status).toBe(200);
  });

  it("completes onboarding with every optional field skipped", async () => {
    const r = await call(dave, "PUT", "/api/profile", {
      displayName: "Dave Student",
      occupation: "student",
      country: "US",
      financialActivities: ["online_shopping", "subscription_payments"],
      paymentExperience: "new",
      incomeBracket: "",
      financialGoal: "education",
      customGoal: "",
      goalAmount: "",
      preferredCurrency: "USD",
    });
    expect(r.status).toBe(200);
    expect(r.json.profile).toMatchObject({ incomeBracket: null, goalAmountMinor: null, ageBracket: null });
  });

  it("rejects tampered requests that try to target another user", async () => {
    const r = await call(dave, "PATCH", "/api/profile", { user_id: "00000000-0000-0000-0000-000000000000" });
    expect(r.status).toBe(400);
    const own = await call(dave, "GET", "/api/profile");
    expect(own.json.profile.displayName).toBe("Dave Student");
    const carolOwn = await call(carol, "GET", "/api/profile");
    expect(carolOwn.json.profile.displayName).toBe("Carol Freelancer");
  });

  it("signs out, rejects wrong credentials, signs back in and restores the profile", async () => {
    expect((await call(carol, "POST", "/api/auth/sign-out")).status).toBe(200);
    expect((await call(carol, "GET", "/api/profile")).status).toBe(401);
    expect((await call(carol, "GET", "/dashboard")).location).toContain("/sign-in");

    const bad = await call(carol, "POST", "/api/auth/sign-in", {
      email: email("carol"),
      password: "wrong-password",
    });
    expect(bad.status).toBe(401);
    expect(bad.json.error.code).toBe("invalid_credentials");

    const ok = await call(carol, "POST", "/api/auth/sign-in", { email: email("carol"), password: PASSWORD });
    expect(ok.status).toBe(200);
    expect(ok.json.onboarded).toBe(true);
    const p = await call(carol, "GET", "/api/profile");
    expect(p.json.profile).toMatchObject({
      displayName: "Carol Freelancer",
      financialActivities: ["freelance_payments", "receiving_invoices", "sending_invoices"].sort(),
      financialGoal: "buying_laptop",
      customGoal: "A lighter laptop for client work",
      goalAmountMinor: 125_050,
      preferredCurrency: "USD",
    });
  });

  it("edits the profile and persists the change", async () => {
    const r = await call(carol, "PUT", "/api/profile", {
      ...carolProfile,
      financialActivities: ["online_selling"],
      financialGoal: "business_growth",
      goalAmount: "",
    });
    expect(r.status).toBe(200);
    const p = await call(carol, "GET", "/api/profile");
    expect(p.json.profile).toMatchObject({
      financialActivities: ["online_selling"],
      financialGoal: "business_growth",
      goalAmountMinor: null,
      preferredCurrency: "USD",
      onboardingCompleted: true,
    });
  });
});
