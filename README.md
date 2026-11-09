# ScamSense

> Scammers don't give you a practice round. ScamSense does.

ScamSense is a desktop-first, fully responsive web app (PayPal AI Hackathon project) that teaches digital-payment
users to recognise, investigate, avoid, and respond to financial scams through immersive, fictional financial simulations.
It uses PayPal **Sandbox** only. No real money ever moves.

- Product rules: [`CLAUDE.md`](CLAUDE.md)
- Specification: [`docs/PRODUCT_SPEC.md`](docs/PRODUCT_SPEC.md) · Architecture: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
  · Data model: [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md) · Build plan: [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md)

## Current status: Phase 2 / Step 4 (accounts, profiles, onboarding)

What works today:

- **Accounts (Supabase Auth):** sign up (display name, email, password, optional age bracket, "I confirm that I am at
  least 18 years old"), sign in, sign out, persistent sessions across refreshes and tabs, forgot/reset password, and
  email-confirmation links.
- **Three-step onboarding** saved to Supabase as you go. Refresh or sign out mid-way and you resume at the same step.
- **My Profile:** view and edit every profile field. Changes persist.
- **Protected routes:** signed-out visitors are sent to sign-in; new users are sent to onboarding. Each user can only
  ever read or change their own profile, enforced by Row Level Security in the database.
- **Currency: USD only** until each other currency is verified end to end with the configured PayPal Sandbox
  merchant (`src/lib/domain/currency.ts`). Conversion from the USD baseline at fixed, documented ECB reference rates is
  ready for when more are enabled (`src/content/exchangeRates.ts`).
- **Module progression (Step 5):** three modules with two scenarios each (official titles and badges), unlocked in
  order once both scenarios of the previous module are completed (no minimum score). Replays are full practice
  attempts that never change official progress, scores, or Training Funds.
- **Training Funds:** fictional, income-based USD baseline (US$3,000 default), reset at each module start, kept in an
  append-only ledger (no duplicate deductions, no overdraft), spending kept separate from scam losses.
- **Scoring framework:** deterministic 40/30/20/10 per scenario, stored immutably; no AI assessment is fabricated.
- **Real dashboard, modules, and certificates pages.** The scenario player and results pages still show **clearly
  labelled demonstration data**.

Not built yet (by design): playable scenarios, Gemini, PayPal Sandbox checkout, Zapier email, PDF reports, and
verified Recovery Playbook content.

| Page                                                                         | Route                                                |
| ---------------------------------------------------------------------------- | ---------------------------------------------------- |
| Landing                                                                      | `/`                                                  |
| Sign up / Sign in / Forgot password                                          | `/sign-up`, `/sign-in`, `/forgot-password`           |
| Onboarding                                                                   | `/onboarding`                                        |
| Dashboard                                                                    | `/dashboard`                                         |
| My Profile                                                                   | `/profile`                                           |
| Modules, scenario player, results, certificates, Sensei Kenshi (demo shells) | `/modules`, `/play/demo`, `/certificates`, `/sensei` |
| Your Recovery Playbook                                                       | `/playbook`                                          |

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
4. **Auth URLs.** Authentication → URL Configuration: Site URL `http://localhost:3000` (your deployed URL in
   production) and add `http://localhost:3000/auth/confirm` to Redirect URLs, so confirmation and reset links work.
5. **Email confirmation.** Authentication → Sign In / Providers → Email → "Confirm email".
   - **On** (recommended for production): new users must click the emailed link before signing in. Supabase's
     built-in mailer only delivers to your project's team members and a few emails per hour, so configure custom SMTP
     before real users sign up.
   - **Off**: users are signed in immediately. Required for `npm run test:integration`.
6. **Test accounts.** Create them through `/sign-up`, not the dashboard's "Add user" button: the sign-up trigger
   rejects accounts without the "at least 18" confirmation metadata.

## Scripts

| Command                       | Purpose                                                                                                                                                                                                                                                             |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`                 | Development server                                                                                                                                                                                                                                                  |
| `npm run build` / `npm start` | Production build and server                                                                                                                                                                                                                                         |
| `npm run lint`                | ESLint                                                                                                                                                                                                                                                              |
| `npm run typecheck`           | TypeScript (`strict`)                                                                                                                                                                                                                                               |
| `npm test`                    | Vitest unit tests (env guard, currency + money, training budget, wallet ledger, progression/unlocks/replays, scoring, profile/auth validation, route rules, migration ↔ code consistency, navigation)                                                               |
| `npm run test:integration`    | **Live** tests against your Supabase project and a running app (`APP_URL`, default `http://localhost:3000`). Creates fictional `@example.com` accounts. Needs "Confirm email" off; the progression suite also needs both migrations and `SUPABASE_SERVICE_ROLE_KEY` |
| `npm run format`              | Prettier (with Tailwind class sorting)                                                                                                                                                                                                                              |

## Project layout

```
src/app/(marketing)   public pages: landing, Recovery Playbook
src/app/(auth)        sign-in / sign-up
src/app/(app)         app shell + dashboard, modules, play, profile, certificates, sensei
src/components/ui     brand primitives
src/components/…      brand, icons, layout, dashboard, scenario, feedback, certificate, chat
src/content           module definitions, onboarding option lists
src/lib               env validation, navigation, formatting, demo data (shells only)
src/lib/supabase      Supabase SSR server client
src/lib/auth          session helpers, route rules, auth schemas + error mapping
src/lib/profile       profile schemas and DB mapping
src/lib/domain        currency allowlist + money parsing (pure)
src/middleware.ts     session refresh + route protection
supabase/migrations   SQL migrations (run in the Supabase SQL Editor)
tests/integration     live Supabase tests
```

## Brand

Teal `#0B5F66`, yellow `#FFC93C`, and white, plus their tints and shades. Headings and buttons use Nunito, and body
text uses Inter. Shapes are rounded, and buttons have a pressable bottom edge. There are no red or green status
colours, and meaning is never carried by colour alone. All tokens live in `src/app/globals.css`. Do not hardcode
hex values in components.
