# ScamSense — Staged Implementation Plan

Work one phase at a time. Each phase ends with type-check, lint, and tests passing, docs updated, and a short report.
Every phase must preserve the **Non-Negotiable Rules** in `CLAUDE.md`.

## Phase 0 — Foundations and documentation ✅
- [x] Inspect the brand guide and level-info reference documents
- [x] `CLAUDE.md` with the Non-Negotiable Rules (core principles + R1–R38) and development rules
- [x] `docs/PRODUCT_SPEC.md`, `docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md`, `docs/IMPLEMENTATION_PLAN.md`
- [x] `.env.example` (placeholder names only)

## Phase 1 — Project scaffold and brand design system ✅
- [x] Next.js 15 (App Router, TS strict, `src/` dir), Tailwind v4, ESLint, Prettier, Vitest
- [x] `src/lib/env.ts` (server-only) + `env.schema.ts`: Zod-validated server/public env, including the Sandbox-only
      PayPal guard (tested). Service credentials stay optional until their phase makes them required
- [x] Brand tokens (colours, radii, 3D bottom-edge shadows, type scale) in `src/app/globals.css` `@theme`
      (Tailwind v4 CSS config; default palette removed). Nunito + Inter via `next/font`
- [x] Logo (symbol + wordmark component, light/dark variants, `public/brand/*.svg`, `app/icon.svg`) and the icon-tile
      component + brand icon set
- [x] UI primitives: Button/ButtonLink (primary/secondary/yellow/ghost/inverse, 3D edge, hover/active/focus/disabled/
      loading), Card, Badge (pill), IconTile, Input/Textarea/Select/Checkbox/ChoiceChip, Modal + Dialog (native
      `<dialog>`), ProgressBar, PageHeader, FeedbackBanner ("Nice catch" teal + tick, "Look again" yellow tint + flag),
      EmptyState, LoadingState/Spinner, DemoNotice
- [x] App shell: desktop header nav (≥1024px), mobile/tablet bottom nav, footer, "Training simulation" indicator,
      skip link, 360px → desktop layouts
- [x] Landing page (functional, real content, no mock data)
- [x] Page shells with clearly labelled demonstration data (`src/lib/demo/demoData.ts`): sign-in/sign-up,
      onboarding, dashboard, modules index, module overview, scenario player, results + Reveal layout, Recovery
      Playbook (topics only), profile, certificates, module completion, Sensei Kenshi
- [x] Accessibility baseline (visible focus rings, AA brand pairings, icon + words for every status, keyboard-operable
      dialog/forms, reduced-motion support)
- [x] QA: no horizontal scroll at 1440/768/390/360 on every route; key journeys clicked through on desktop + mobile

**Phase 1 notes / limitations**
- No authentication or persistence: forms validate and navigate but store nothing. `(app)` routes are not protected
  until Phase 2 middleware.
- Only the demo attempt `/play/demo` exists. The demo email environment is a placeholder for the Phase 4 renderers.
- The report download button is intentionally disabled; certificate email and Sensei Kenshi reply with a local
  "not connected yet" message.
- `cn()` does not merge conflicting Tailwind classes. Components must not receive overrides of their own base
  utilities (wrap them for visibility instead). Revisit with `tailwind-merge` only if this becomes limiting.

## Phase 2 — Supabase, auth, onboarding (Step 4) ✅ — verified 2026-11-09, awaiting owner review
- [x] SQL migration for `profiles` (`supabase/migrations/20261109000000_profiles.sql`): table, check constraints,
      sign-up trigger (`handle_new_user`, DB-enforced 18+ confirmation), row trigger, RLS, minimum Data API grants.
      Applied to the project via the SQL Editor
- [x] Supabase SSR server client, `middleware.ts` session refresh + route protection, `requireUser()` /
      `requireOnboardedProfile()`; `(app)` layout re-checks the session and is `force-dynamic`
- [x] Sign-up (display name, email/password, optional age bracket, required "at least 18" checkbox), sign-in,
      sign-out, forgot/reset password, `/auth/confirm` email-link handler (PKCE + token_hash)
- [x] Currency module (`src/lib/domain/currency.ts`): all 24 PayPal REST currencies transcribed from the official
      page; conservative enabled allowlist USD (default), AUD, CAD, EUR, GBP; validated in browser, API, and DB
- [x] Three-step onboarding with per-step saves (`PATCH /api/profile`) and completion (`PUT /api/profile`); resume
      after refresh/sign-in; My Profile view + edit
- [x] Stable identifiers for occupation, activities, experience, goals, income brackets, countries
- [x] Removed "18+ / adults" messaging from the landing page and footer
- [x] Tests: 55 unit tests (`npm test`); 16 live Supabase tests (`npm run test:integration`: DB-level RLS/grant/
      constraint isolation between two accounts + full API journey); 39 real-browser checks (desktop + 360/390/768/
      1024/1440 px) against the production build

**Phase 2 notes / deferred**
- Only `profiles` is migrated. The other DATA_MODEL §3 tables and §4 functions are gameplay/payment/certificate
  tables and are created in the phases that use them (per the Step 4 brief: no gameplay tables yet).
- Dashboard module progress, wallet, and badges remain labelled demonstration data; `GET /api/progress` moves to
  Phase 3/4 with the attempt tables. The dashboard greeting and module-completion name use the real profile.
- Currency allowlist must be re-verified against the Sandbox merchant in Phase 5 (Step 7) before enabling more.
- Email verification and password reset were exercised up to the email-link handler (invalid/expired links,
  open-redirect protection). The live email round-trip needs a real inbox: see README "Supabase setup".
- "Confirm email" was switched OFF for automated testing. Either setting works; re-enable it for production and
  configure custom SMTP (Supabase's built-in mailer only sends to project team members).

## Phase 3 — Module progression, training funds, dashboard (Step 5) ✅ — verified 2026-11-09, awaiting owner review
- [x] Module + scenario-slot configuration (`src/content/modules.ts`): exactly 3 modules × 2 slots (`m1-s1` … `m3-s2`),
      payment percentages in basis points (5/8, 10/12, 15/20 %), tested (structure, ≤100 % per module, neutral labels)
- [x] Training-budget configuration (`src/content/trainingFunds.ts`): income bracket → illustrative budget, US$3,000
      default when income is skipped
- [x] Pure domain modules + unit tests (`src/lib/domain/`): `money` (integer basis-point maths, half-up rounding to
      the PayPal minor unit), `trainingFunds` (starting funds, scenario amounts), `wallet` (append-only ledger,
      idempotent payments, no overdraft, spending vs fraud loss), `progression` (unlocks, resume, replays),
      `scoring` (40/30/20/10 framework, no AI assessment invented), `progress` (dashboard snapshot)
- [x] Migration `20261109120000_progression_wallet.sql`: `module_runs`, `scenario_attempts` (replay numbering, one
      open attempt), `wallet_ledger_entries` (append-only, one start per run, one payment per attempt/idempotency
      key, balance ≥ 0), `scenario_scores` (immutable, generated total); RLS read-own; writes only through
      `service_role` functions `start_module_run`, `create_scenario_attempt`, `record_training_payment`,
      `complete_scenario_attempt`. Drift test against the TypeScript config
- [x] Server-only trusted writer (`src/lib/supabase/admin.ts`, `SUPABASE_SERVICE_ROLE_KEY`)
- [x] `GET /api/progress`, `POST /api/modules/[moduleKey]/start`
- [x] Real dashboard (welcome, current module, overall progress, Training Funds + breakdown, module completion,
      total score, badges, available/locked modules, financial goal, certificate/report access, past results),
      compact Training Funds strip on mobile; modules index, module overview (start module, ledger history), and
      certificates pages on real data. Demo data now only backs `/play/demo`
- [x] Migration applied by the owner; `SUPABASE_SERVICE_ROLE_KEY` set
- [x] Tests: 117 unit tests (`npm test`); 30 live tests (`npm run test:integration`, 14 new: lock order, idempotent
      start, resume vs replay, no duplicate deductions, no overdraft, append-only ledger, completion-only-by-function,
      fraud loss vs spending, fresh Module 2 funds, cross-user isolation, API + dashboard render); 41 real-browser
      checks in Chrome (journey incl. keyboard "Start module 1", no horizontal scroll at 1440/1024/768/390/360 on
      dashboard, module, modules, certificates; no console errors)

**Step 5 review (2026-11-09) — corrections and confirmed decisions**
- [x] Training Funds baseline approved (USD 3,000 default; 500 / 1,750 / 3,750 / 7,500 / 10,000), now explicitly a
      USD baseline; every bracket mapping tested
- [x] Multi-currency correction: fixed, documented ECB reference rates (`src/content/exchangeRates.ts`), BigInt
      conversion with half-up rounding (`src/lib/domain/exchange.ts`); the same number is never reused across
      currencies. Allowlist narrowed to **USD only** until PayPal merchant verification (code, API, and migration
      `20261109140000_usd_only_currency.sql`)
- [x] Official scenario titles and badge names (Scam Spotter, Fraud Detective, ScamSense Guardian) in the module
      config and UI
- [x] Replay decision documented (full practice attempt incl. a new Sandbox checkout, separate records, never
      official); live tests prove a replay can run the full flow without touching the official attempt, score,
      run, or ledger
- [x] Security review: anon/authenticated denied all gameplay functions and writes (live), scores immutable and not
      re-awardable, secret key absent from the client bundle, progress persists across sign-out/in
- [x] `.env.example` uses placeholders only; `.env.local` ignored by Git

**Phase 3 notes / deferred**
- No scenario can be played for real yet, so attempts, payments, and scores are only produced by the integration
  tests. Phase 4 creates attempts through `create_scenario_attempt`; Phase 5 debits through
  `record_training_payment`; Phase 6 completes through `complete_scenario_attempt` with the evaluator's IDs.
- Badges are derived from completed module runs; the `badges`/`certificates` tables arrive with Phase 9.
- The completion page (`/modules/[key]/complete`) is still the Phase 1 labelled preview.
- "Start module" does a full page reload after success: a soft `router.refresh()` received the new payload but did
  not re-render in testing (Next 15.5). Revisit if soft refresh is needed elsewhere.

## Phase 4 — Content model + immersive scenario engine (no AI, no payments yet)
- [ ] Zod content schemas (`src/content/schema.ts`) and the render/answer-key file split with `server-only`
      (answer key includes the scoring rubric: correct decisions, weighted evidence, verification actions, unsafe
      actions)
- [ ] Attempt state machine (pure reducer + tests), driving the trusted-writer updates of `scenario_attempts`
- [ ] Content validation tests (anchors exist, deny-listed judgment words, reserved TLDs, ≥1 legitimate scenario)
- [ ] Author the **first** scenario end to end (render + answer key) as the reference implementation
- [ ] Environment renderers: EmailClient, ChatWindow, FakeBrowser (inert address bar), InvoiceView,
      MarketplaceView, PaymentRequest. All are responsive and keyboard operable
- [ ] Decisions bound to environment-native actions + final-decision confirmation (not a multiple-choice list)
- [ ] Inert credential/OTP inputs (never transmitted)
- [ ] Attempt APIs: create/resume/replay (`planScenarioStart` + `create_scenario_attempt`), get (client-safe),
      events (recording verification/unsafe action IDs for scoring), decision, justification
- [ ] Justification step (20–1000 chars), locking
- [ ] Leak test: API payload snapshots contain no answer-key fields before COMPLETED

## Phase 5 — PayPal Sandbox checkout + fictional wallet
- [ ] `paypal.ts` (OAuth token cache, create order, capture, Sandbox guard, idempotency keys)
- [ ] `/api/paypal/orders`, `/capture`, `/cancel` and the `record_capture` transaction
- [ ] PayPal Buttons inside payable scenario environments (currency = module run currency)
- [ ] Debit Training Funds on capture via `record_training_payment` (idempotency key = PayPal-Request-Id) for the
      scored attempt only
- [ ] Replays run a genuine Sandbox checkout too: own order + fresh request id per practice attempt,
      `payment_transactions.is_practice`, no ledger entry, practice outcome classified at completion
      (DATA_MODEL §3.5); test double-click/retry protection for both kinds
- [ ] Before enabling any currency beyond USD: test it end to end with the Sandbox merchant, then flip `enabled` +
      constraint migration (reference rates are already in place)
- [ ] Failure, cancel, and retry paths. E2E with Sandbox test accounts

## Phase 6 — Gemini integration with fallbacks
- [ ] `gemini.ts` client with timeout/retry, Zod output parsing, versioned prompts
- [ ] Scenario personalization (slots) with authored defaults
- [ ] Reasoning evaluation (evidence IDs, feedback, separate humor) + correctness guard + fallback evaluator
- [ ] Tests that simulate Gemini down or returning invalid output → app fully usable

## Phase 7 — Results and Reveal the Red Flags
- [ ] `/play/[attemptId]/results` gated on COMPLETED
- [ ] Feedback view (praise first, outcome, wallet impact, AI feedback, separate humor, safest next step)
- [ ] Reveal mode: re-render the environment with evidence highlights labeled red flag / worth verifying / positive,
      with explanations and "you mentioned this" markers. Labels use icon + text, never color alone
- [ ] Relevant Recovery Playbook sections at the end of results

## Phase 8 — Remaining scenario content
- [ ] Author scenarios 2–6 per PRODUCT_SPEC §3.3 (after the product owner confirms the storylines)
- [ ] Payment percentages, evidence, keywords, fallback texts, Playbook links
- [ ] Content review against the core principles + R8–R17, R28–R30

## Phase 9 — Module completion: badge, certificate, report, Zapier
- [ ] `complete_attempt` module-completion logic (badge + certificate rows, next module unlock)
- [ ] Completion page: badge, on-screen certificate (no download)
- [ ] Zapier webhook integration + email form + retry + rate limit; Zap configured with a shared secret
- [ ] `@react-pdf/renderer` analysis report via `GET /api/modules/[moduleKey]/report`

## Phase 10 — Your Recovery Playbook
- [ ] Research and transcribe verified U.S. PayPal policy content from official sources (URL + last-verified date per
      section)
- [ ] `/playbook` pages; links from results and the report
- [ ] Review: no invented policies, timelines, statistics, or guarantees

## Phase 11 — Sensei Kenshi
- [ ] `/api/chat` (streaming) with grounding rules (completed attempts only, Playbook excerpts)
- [ ] Floating panel + `/sensei` page; history; rate limit; fallback message
- [ ] Tests: refuses hints for in-progress scenarios; no policy invention prompts pass through

## Phase 12 — Hardening and launch
- [ ] Playwright E2E: full journey through 3 modules (with Sandbox), plus degraded modes (Gemini/Zapier off)
- [ ] Responsive QA (360, 768, 1024, 1440), accessibility audit, CSP headers
- [ ] Security review (RLS, ownership checks, secret exposure, payload leaks)
- [ ] Deployment (Vercel + Supabase), production env vars (still Sandbox), demo accounts
