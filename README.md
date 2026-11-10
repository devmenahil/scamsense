# ScamSense

> Scammers don't give you a practice round. ScamSense does.

ScamSense is a desktop-first, fully responsive web app (PayPal AI Hackathon project) that teaches digital-payment
users to recognise, investigate, avoid, and respond to financial scams through immersive, fictional financial simulations.
It uses PayPal **Sandbox** only. No real money ever moves.

- Product rules: [`CLAUDE.md`](CLAUDE.md)
- Specification: [`docs/PRODUCT_SPEC.md`](docs/PRODUCT_SPEC.md) · Architecture: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
  · Data model: [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md) · Build plan: [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md)

## Current status: Step 11 (module rewards, certificates, reports, Zapier email)

What works today:

- **Accounts, onboarding, My Profile (Step 4):** Supabase Auth sign-up/sign-in/reset, three-step onboarding saved as
  you go, protected routes, Row Level Security on every table.
- **Module progression and Training Funds (Step 5):** three modules × two scenarios, sequential unlocks, fictional
  income-based Training Funds (US$3,000 default) in an append-only ledger, deterministic 40/30/20/10 scoring
  framework. **Currency: USD only** (the only currency verified with the Sandbox merchant).
- **Immersive scenario engine (Step 6):** all six scenarios are playable as realistic fictional apps (chat, mail,
  browser, invoice, marketplace, seller hub); environment-native decisions, a written explanation for every decision,
  a server-side state machine, refresh-safe resume, and practice replays.
- **Genuine PayPal Sandbox checkout (Step 7):** pay decisions open the official PayPal JavaScript SDK v6 (Sandbox) for
  the server-computed amount; the server creates the Orders v2 order, captures it, verifies the capture, and only
  then records it. See [PayPal Sandbox checkout](#paypal-sandbox-checkout).
- **Hybrid intelligence (Step 8):** "Other" options with short descriptions for occupation, financial activities, and
  goal; deterministic scenario routing (0.50·A + 0.20·C + 0.15·E + 0.15·D) with Gemini interpreting only meaningful
  custom descriptions (validated, cached); Gemini personalization of every newly played scenario (all six), stored
  and reused; ONE Gemini evaluation per finished attempt (evidence recognition, feedback, advice, and a separate witty
  comment) with backend scoring; results page. See [Gemini (Step 8)](#gemini-step-8).

- **Post-scenario debrief (Step 9):** _Reveal the Red Flags_ replays the completed scenario read-only with numbered,
  accessible evidence markers (red flag / worth verifying / positive verification); _Your Recovery Playbook_ gives
  scenario-specific steps grounded in a versioned U.S. PayPal knowledge base (`src/content/playbook/`): reporting
  phishing and unauthorized activity, the User Agreement's unauthorized-transaction rules, Purchase and Seller
  Protection (eligibility, process, exclusions), and dispute timeframes. All nine official pages were verified on
  2026-11-10. See [docs/PRODUCT_SPEC.md §6](docs/PRODUCT_SPEC.md).
- **Sensei Kenshi (Step 10):** a Gemini-powered learning companion, opened from the dashboard card, the `/sensei`
  page, or "Ask Sensei Kenshi" on a completed attempt's Results, Reveal the Red Flags, and Recovery Playbook pages. He
  is never available on the scenario player. The server only lets him see the learner's own COMPLETED attempts
  (unfinished scenarios are known by title only), grounds PayPal answers in the Step 9 knowledge base with official
  links, and costs one Gemini request per question. Conversations aren't stored. See
  [docs/PRODUCT_SPEC.md §7](docs/PRODUCT_SPEC.md).

- **Module rewards (Step 11):** finishing both original scenarios of a module awards its badge (Scam Spotter, Fraud
  Detective, ScamSense Guardian) and ONE Certificate of Completion, created by the database at the moment the module
  completes (idempotent: refreshes, replays, and retries never award twice). The certificate is shown on screen only
  (no download button); learners can email themselves a PDF copy through the existing Zapier Catch Hook → Gmail Zap.
  Each module has a downloadable **analysis report** PDF built from stored results only (no Gemini call). See
  [Certificates, reports, and Zapier email](#certificates-reports-and-zapier-email).

Not built yet (by design): final end-to-end test pass, deployment.

| Page                                                          | Route                                                 |
| ------------------------------------------------------------- | ----------------------------------------------------- |
| Landing                                                       | `/`                                                   |
| Sign up / Sign in / Forgot password                           | `/sign-up`, `/sign-in`, `/forgot-password`            |
| Onboarding                                                    | `/onboarding`                                         |
| Dashboard · Modules · Certificates · My Profile               | `/dashboard`, `/modules`, `/certificates`, `/profile` |
| Scenario player (incl. PayPal Sandbox checkout)               | `/play/[attemptId]`                                   |
| Scenario results (completed attempts)                         | `/play/[attemptId]/results`                           |
| Reveal the Red Flags (completed attempts)                     | `/play/[attemptId]/review`                            |
| Recovery Playbook for an attempt                              | `/play/[attemptId]/playbook`                          |
| Sensei Kenshi (also a panel on the dashboard + debrief pages) | `/sensei`                                             |
| Your Recovery Playbook                                        | `/playbook`                                           |

## Getting started

Requires Node.js 20+ (developed on Node 24).

```bash
npm install
cp .env.example .env.local   # then fill in the Supabase values (below)
npm run dev                  # http://localhost:3000
```

The app refuses to start if `PAYPAL_ENV` is set to anything other than `sandbox`, or if `PAYPAL_API_BASE` is not
the Sandbox host.

## Supabase setup

ScamSense needs the project URL, the **publishable** key, and (from Phase 3) a server-only **secret** key for
gameplay writes.

1. **Environment.** In `.env.local` set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (Project
   Settings → API Keys). A publishable key in `NEXT_PUBLIC_SUPABASE_ANON_KEY` also works.
   Also set `SUPABASE_SERVICE_ROLE_KEY` to a **secret** key (`sb_secret_…`, or the legacy `service_role` key). It is
   read only on the server (never `NEXT_PUBLIC_`) and used only to call the gameplay functions that start modules,
   move Training Funds, and record scores; users' own reads still go through RLS. Without it the app still works,
   but "Start module" answers with a calm "try again later".
2. **Project settings this repo expects:** Data API **on**, "Automatically expose new tables" **off**, automatic RLS
   **on**. The migration grants exactly the access it needs; do not turn on automatic exposure or disable RLS.
3. **Run the migrations, in filename order.** Dashboard → SQL Editor → New query → paste the whole file → Run (or
   `supabase db push` with the CLI). Never edit an applied migration: add a new file instead.
   - `20261109000000_profiles.sql`: `public.profiles`, its check constraints, RLS policies, column-level grants, and
     the trigger that creates a profile when someone signs up.
   - `20261109120000_progression_wallet.sql`: module runs, scenario attempts (with replays), the append-only
     Training Funds ledger, scenario scores, RLS read-own policies, and the `service_role`-only gameplay functions.
   - `20261109140000_usd_only_currency.sql`: narrows the preferred-currency allowlist to USD (moves any other saved
     preference to USD; started modules keep their currency).
   - `20261110090000_scenario_engine.sql`: the 13-state scenario machine, the append-only attempt event log, and
     `apply_attempt_event`.
   - `20261111090000_paypal_checkout.sql` (Step 7): `payment_transactions` (PayPal Sandbox orders and captures), the
     `service_role`-only functions `record_payment_order`, `record_payment_capture`, `update_payment_order`, and the
     updated `complete_scenario_attempt` (classifies a captured payment at completion).
   - `20261113090000_personalization_intro.sql` (Step 8 follow-up): `scenario_personalizations.intro_line` for
     Gemini-personalized neutral intros, and `complete_scenario_personalization` with `p_intro_line`. Until it is
     applied, scenarios keep their personalized details but show the authored intro.
   - `20261112090000_hybrid_intelligence.sql` (Step 8): profile "Other" descriptions, `profile_interpretations`
     (validated classification cache), `module_scenario_orders` (write-once routed order),
     `scenario_personalizations` + `attempt_personalizations`, `attempt_evaluations`, and the `service_role`-only
     functions `claim_scenario_personalization`, `complete_scenario_personalization`, `link_attempt_personalization`,
     `claim_attempt_evaluation`, `fail_attempt_evaluation`, `record_attempt_evaluation`. Until it is applied the app
     keeps working with authored defaults, but custom descriptions can't be saved and scenarios can't be evaluated.
   - `20261114090000_recovery_playbooks.sql` (Step 9): `attempt_recovery_playbooks` (one stored personal Playbook
     note per completed attempt) and the `service_role`-only `claim_recovery_playbook` / `complete_recovery_playbook`.
     Until it is applied, the Playbook works fully but shows no AI note (and never calls Gemini for it).
   - `20261115090000_module_rewards.sql` (Step 11): `badges`, `certificates`, `certificate_email_requests`, the
     award trigger on module completion (plus a backfill for modules completed earlier), the `service_role`-only
     `ensure_module_rewards`, `begin_certificate_email_request`, `finish_certificate_email_request`, and the
     **private** storage bucket `certificate-pdfs`. Until it is applied, badges still show (from completed modules)
     and the report downloads, but certificates and certificate email are unavailable.
4. **Auth URLs.** Authentication → URL Configuration: Site URL `http://localhost:3000` (your deployed URL in
   production) and add `http://localhost:3000/auth/confirm` to Redirect URLs, so confirmation and reset links work.
5. **Email confirmation.** Authentication → Sign In / Providers → Email → "Confirm email".
   - **On** (recommended for production): new users must click the emailed link before signing in. Supabase's
     built-in mailer only delivers to your project's team members and a few emails per hour, so configure custom SMTP
     before real users sign up.
   - **Off**: users are signed in immediately. Required for `npm run test:integration`.
6. **Test accounts.** Create them through `/sign-up`, not the dashboard's "Add user" button: the sign-up trigger
   rejects accounts without the "at least 18" confirmation metadata.

## PayPal Sandbox checkout

ScamSense only ever talks to the PayPal **Sandbox**. The server refuses to start if `PAYPAL_ENV` is not `sandbox` or
`PAYPAL_API_BASE` is not `https://api-m.sandbox.paypal.com`, and the browser SDK URL is hard-coded to
`https://www.sandbox.paypal.com/web-sdk/v6/core`. No real money moves.

### Which scenarios pay

| Scenario                           | Payment decision                              | Checkout           | Amount (US$3,000 funds) | Fictional wallet meaning (revealed only after completion) |
| ---------------------------------- | --------------------------------------------- | ------------------ | ----------------------- | --------------------------------------------------------- |
| M1-S1 The Security Check           | none (sharing a code is the risky choice)     | none               | —                       | —                                                         |
| M1-S2 Your Account Needs Attention | none (phishing page, no payment in the story) | none               | —                       | —                                                         |
| M2-S1 An Invoice Has Arrived       | "Pay invoice"                                 | **PayPal Sandbox** | 10% → $300.00           | scam loss                                                 |
| M2-S2 The Laptop Purchase          | "Place order"                                 | **PayPal Sandbox** | 12% → $360.00           | ordinary spending                                         |
| M3-S1 The Job Opportunity          | "Pay request" (equipment deposit)             | **PayPal Sandbox** | 15% → $450.00           | scam loss                                                 |
| M3-S2 The Seller's Dilemma         | none (you are the seller: ship or not)        | none, by design    | —                       | —                                                         |

### Setup (Sandbox Business merchant + Sandbox Personal buyer)

1. Sign in at <https://developer.paypal.com> → **Apps & Credentials** → **Sandbox** → create (or open) a REST app. Its
   Sandbox **Business** account is the merchant that receives every ScamSense payment.
2. Copy the app's **Client ID** into `NEXT_PUBLIC_PAYPAL_CLIENT_ID` (public by design: the browser SDK needs it) and
   its **Secret** into `PAYPAL_CLIENT_SECRET` (server only; never prefix it with `NEXT_PUBLIC_`). Keep
   `PAYPAL_ENV=sandbox` and `PAYPAL_API_BASE=https://api-m.sandbox.paypal.com`.
3. **Testing tools → Sandbox accounts:** use the default **Personal** account (or create one, country US). Its email
   and system-generated password (⋯ → View/edit account) are what you type into the PayPal window during checkout.
4. Apply `20261111090000_paypal_checkout.sql` in the Supabase SQL Editor and restart the server.

If the client ID or secret is missing, the checkout step says "Sandbox checkout is unavailable right now" and the
player can cancel and finish without paying. Nothing is faked.

### How a payment works

1. The player decides to pay inside the scenario, confirms, and writes their reasoning. Decision and explanation lock.
2. The checkout step shows the server-computed amount and the official **Pay with PayPal** button.
3. Clicking it calls `POST /api/attempts/[id]/checkout/order`: the server computes the amount from the module run,
   creates an Orders v2 order (`PayPal-Request-Id` = `scamsense-<attempt>-checkout-<n>`), and stores it.
4. The buyer approves in PayPal's own Sandbox window.
5. `POST …/checkout/capture` reads the order, captures it once, and verifies that it is COMPLETED for exactly the
   stored amount and currency, on this attempt's order. Then, in one database transaction: payment row CAPTURED, the
   official Training Funds debit (scored attempt only, exactly once), attempt finalized.
6. Closing PayPal or "Cancel checkout" calls `…/checkout/cancel`, which checks PayPal first. No payment is made; the
   player can return to checkout (a new order) or finish without paying.
7. After a refresh or a lost response, the page calls `…/checkout/sync`, which records whatever PayPal says actually
   happened. It never captures a second time.

**Replays** are full practice attempts: they get their own Sandbox orders and captures, recorded in
`payment_transactions` with `is_practice = true`, and never touch the official Training Funds, score, progression,
badges, or certificates.

### Manual Sandbox checkout test

Automated tests create and verify real Sandbox orders, but approving one needs a person signed in as the Sandbox
buyer:

1. `npm run build && npm start`, then sign in with a ScamSense account whose Module 2 is started (until Step 8 ships,
   use a prepared test account: the integration helpers complete Module 1 through the trusted writer).
2. Modules → Trust Under Pressure → **The Laptop Purchase** → look at the product, seller, reviews, and checkout →
   **Place order** → confirm → write your reasoning → submit.
3. Click **Pay with PayPal**, log in with the Sandbox **Personal** account, and approve.
4. Expect "PayPal Sandbox payment completed: $360.00" with a capture ID, and Training Funds of $2,640.00 on the
   dashboard (awaiting results). The payment also appears in the Sandbox Business account's activity at
   <https://www.sandbox.paypal.com>.
5. Optional checks: refresh while the PayPal window is open (the same order is reused); close the window (cancelled,
   no deduction); replay the scenario once it is completed (a new Sandbox payment; official funds unchanged).

## Gemini (Step 8)

Set `GEMINI_API_KEY` and `GEMINI_MODEL` in `.env.local` (server only; never `NEXT_PUBLIC_`). Verified on 2026-11-12
with `gemini-3.5-flash-lite` (free tier, structured JSON output). Optional: `GEMINI_TIMEOUT_MS` (per request,
1000–30000) and `GEMINI_MAX_RPM` (global requests per minute, default 12; set it to your project's limit shown in
AI Studio → Rate limits).

When Gemini is called — and when it isn't:

| Moment                                                                     | Gemini requests                                                               |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Routing a predefined-only profile                                          | 0                                                                             |
| Routing a profile with a meaningful custom "Other" description             | 1 per new description version (cached by fingerprint; reused by every module) |
| Vague descriptions ("something else"), exact label matches, custom goals   | 0                                                                             |
| First play of each scenario (all six)                                      | 1 personalization                                                             |
| Refresh, resume, opening apps/emails/invoices, replays                     | 0 (stored narrative reused)                                                   |
| Finishing an attempt (original or replay)                                  | 1 evaluation (feedback + witty comment together)                              |
| Viewing results again                                                      | 0                                                                             |
| Reveal the Red Flags (any number of visits)                                | 0                                                                             |
| First visit to an attempt's Recovery Playbook (after the Step 9 migration) | 1 (short note; stored and reused)                                             |
| Each question to Sensei Kenshi (Step 10)                                   | 1 (opening/closing the chat, suggestions, and switching context: 0)           |

So a predefined profile uses about **12 requests** for the six scenarios. Usage counters (requests, retries, cache
hits, tokens, errors, rate-limit and fallback events) are at `GET /api/dev/gemini-usage` in development only.

If Gemini is unavailable: routing uses predefined tags (neutral context for custom text), scenarios use the authored
story details (stored as a tracked fallback), and evaluation offers "Try again" or clearly labelled basic feedback.
No points or AI text are ever invented, and evaluation can never trigger a PayPal capture. Sensei Kenshi shows a
friendly "try again" message with links to the Recovery Playbook (and the attempt's results); he never shows a
made-up reply. Chat uses its own per-user budget (`chat:<user>`), so chatting can't use up the budget for scenario
feedback; the global `GEMINI_MAX_RPM` is shared.

## Certificates, reports, and Zapier email

**Rewards.** When the second original scenario of a module completes, `complete_scenario_attempt` sets the module
run's completion (once). A database trigger then inserts one badge (with the frozen module score, out of 200) and one
certificate (random ID such as `SS1-7F3A-91C2-0B4E`, the learner's display name and the module title as snapshots).
Unique constraints and immutability triggers make duplicates impossible; practice replays never complete a run.

**Certificate.** `/modules/[moduleKey]/complete` and `/certificates` show it on screen. There is no download route.
The PDF exists only as the email attachment: the server renders it once (`@react-pdf/renderer`, embedded Nunito +
Inter), stores it in the private `certificate-pdfs` bucket, and gives Zapier a signed URL valid for 24 hours.

**Analysis report.** "Download Analysis Report" calls `GET /api/modules/[moduleKey]/report`: session user only, own
completed module only (409 otherwise), generated on demand from stored results, `Cache-Control: private, no-store`.

**Email via the existing Zap.** `POST /api/certificates/[moduleKey]/email` sends one JSON request to
`ZAPIER_CERTIFICATE_WEBHOOK_URL` (server-only):

```json
{
  "recipientEmail": "learner@example.com",
  "displayName": "Test Learner",
  "moduleTitle": "Spot the Trap",
  "certificateId": "SS1-7F3A-91C2-0B4E",
  "completionDate": "November 10, 2026",
  "certificatePdfUrl": "https://<project>.supabase.co/storage/v1/object/sign/certificate-pdfs/…pdf?token=…&download=…"
}
```

The first three names are the ones the Zap already maps; keep them. The only Zap change needed is mapping
`certificatePdfUrl` into Gmail's **Attachments** field (step-by-step instructions: docs/ARCHITECTURE.md §11.3). A
"submitted" status means Zapier accepted the request, not that Gmail delivered it. `ZAPIER_WEBHOOK_SECRET` is not
used (a Catch Hook can't verify it without an extra filter step).

## Scripts

| Command                       | Purpose                                                                                                                                                                                                                                                                                                                                                                                                           |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`                 | Development server                                                                                                                                                                                                                                                                                                                                                                                                |
| `npm run build` / `npm start` | Production build and server                                                                                                                                                                                                                                                                                                                                                                                       |
| `npm run lint`                | ESLint                                                                                                                                                                                                                                                                                                                                                                                                            |
| `npm run typecheck`           | TypeScript (`strict`)                                                                                                                                                                                                                                                                                                                                                                                             |
| `npm test`                    | Vitest unit tests (env guard, currency + money, training budget, wallet ledger, progression/unlocks/replays, scoring, profile/auth validation, route rules, migration ↔ code consistency, navigation)                                                                                                                                                                                                             |
| `npm run test:integration`    | **Live** tests against your Supabase project and a running app (`APP_URL`, default `http://localhost:3000`). Creates fictional `@example.com` accounts. Needs "Confirm email" off, every migration, and `SUPABASE_SERVICE_ROLE_KEY`; the PayPal suite also creates real (unapproved) Sandbox orders and needs the Sandbox credentials; the Kenshi suite makes 4 Gemini chat requests (`KENSHI_LIVE=0` skips them) |
| `npm run test:gemini`         | **Live** Gemini check (~20 requests, spaced for free-tier limits): real classification, personalization of all six scenarios for two profiles, and evaluation of sample explanations, through the same validators the server uses. Set `GEMINI_LIVE_REPORT=<path>` to save examples and measured usage as JSON                                                                                                    |
| `npm run format`              | Prettier (with Tailwind class sorting)                                                                                                                                                                                                                                                                                                                                                                            |

## Project layout

```
src/app/(marketing)   public pages: landing, Recovery Playbook
src/app/(auth)        sign-in / sign-up
src/app/(app)         app shell + dashboard, modules, play, profile, certificates, sensei
src/components/ui     brand primitives
src/components/…      brand, icons, layout, dashboard, scenario, feedback, certificate, review, playbook, kenshi,
                      rewards (badges), report (download button)
src/content           module definitions, onboarding option lists
src/lib               env validation, navigation, formatting, demo data (shells only)
src/lib/supabase      Supabase SSR server client
src/lib/auth          session helpers, route rules, auth schemas + error mapping
src/lib/profile       profile schemas and DB mapping
src/lib/domain        pure rules: money, currency, Training Funds, wallet, progression, scoring, state machine
src/lib/scenario      attempt service + client-safe view (no answer key)
src/lib/payments      PayPal Sandbox: pure checkout rules, Orders v2 client, payment service
src/lib/kenshi        Sensei Kenshi: context gating, policy retrieval, prompt, reply guards, service
src/lib/rewards       badges, certificates, email status, Zapier client, private PDF storage
src/lib/report        analysis-report model (pure) + loader
src/lib/pdf           server-side PDFs (certificate attachment, analysis report) + brand fonts (src/assets/fonts)
src/middleware.ts     session refresh + route protection
supabase/migrations   SQL migrations (run in the Supabase SQL Editor)
tests/integration     live Supabase tests
```

## Brand

Teal `#0B5F66`, yellow `#FFC93C`, and white, plus their tints and shades. Headings and buttons use Nunito, and body
text uses Inter. Shapes are rounded, and buttons have a pressable bottom edge. There are no red or green status
colours, and meaning is never carried by colour alone. All tokens live in `src/app/globals.css`. Do not hardcode
hex values in components.
