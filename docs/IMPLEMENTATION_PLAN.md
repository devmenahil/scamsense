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
- Badges are derived from completed module runs; the `badges`/`certificates` tables arrived in Step 11.
- The completion page (`/modules/[key]/complete`) is still the Phase 1 labelled preview.
- "Start module" does a full page reload after success: a soft `router.refresh()` received the new payload but did
  not re-render in testing (Next 15.5). Revisit if soft refresh is needed elsewhere.

## Phase 4 — Immersive scenario engine (Step 6) ✅ — verified 2026-11-10, awaiting owner review
Step 6 also authored all six scenarios (originally Phase 8 content), because the brief asked for six complete
templates. No Gemini and no PayPal API calls were added.
- [x] Zod content schemas: client-safe render (`src/content/scenarios/schema.ts`) and server-only template/answer key
      (`templateSchema.ts`, `*/answerKey.server.ts` with `import "server-only"`). Registries `renders.ts` (parsed at
      import) and `templates.server.ts` (cross-checks every answer key against its render)
- [x] 13-state machine as a pure reducer (`src/lib/domain/scenarioStateMachine.ts`) + tests; mirrored in SQL
      (transition trigger) with a drift test
- [x] Migration `20261110090000_scenario_engine.sql`: new states (old ones mapped), `pending_decision_id`,
      `finalized_at`, append-only `scenario_attempt_events`, `apply_attempt_event()` (the only state writer),
      `complete_scenario_attempt` now requires `RECOVERY_AVAILABLE`. Applied by the owner 2026-11-10
- [x] Six templates with neutral intros, decisions, controlled branches, fixed answer keys, weighted evidence
      (red flag / worth verifying / positive verification), rubric, payment configuration, Recovery Playbook section
      IDs, fallback content, activity/context tags and difficulty metadata (Step 8 routing)
- [x] Four reusable environments built from shared parts (`src/components/scenario/sim/`): chat/email (Messages,
      Mail), fictional browser (BrowserFrame + site blocks, inspectable address bar, history, bookmarks), invoice
      viewer, marketplace (buyer storefront + seller hub), plus a fictional payment-account app (TandemPay)
- [x] Decisions bound to environment-native controls + "final decision" confirmation; contextual explanation prompt
      per decision intent; write → review → submit-and-lock
- [x] Inert environments: no credential, code, or card fields anywhere; every domain is `.example`
- [x] Attempt APIs: create/resume/replay, client-safe view, events, justification
- [x] PayPal boundary (`src/lib/payments/checkout.ts`): checkout request (server amount), idempotency keys, capture
      verification, wallet effect (ledger vs practice), `PaymentGateway` interface with a pending gateway that never
      reports success; checkout panel shows "waiting for the PayPal Sandbox connection"
- [x] Replays: separate practice attempts with their own id, event log, explanation and (Step 7) checkout keys
- [x] Leak tests (view payloads, IDs, client bundle) and content tests (judgment words, `.example` domains, fictional
      phone numbers, tokens, anchors, category coverage, ≥1 legitimate)
- [x] Tests: 174 unit tests; 44 live integration tests (13 new: transitions, bypasses, write-once decision and
      explanation, append-only log, completion only via function, replay independence, API journey incl. locked
      module, foreign attempt, laptop to pending checkout, replay without touching progress); 34 real-browser checks
      in Chrome (M1-S1 end to end with refreshes, M2-S2 to the pending checkout and cancel/retry, all six scenarios
      and every app at 1280 and 360 px, no horizontal scroll, no judgment words, no console errors)

**Phase 4 notes / deferred**
- Attempts stop at FINALIZED until Step 8 adds evaluation (FINALIZED → FEEDBACK_AVAILABLE → REVIEW_AVAILABLE →
  RECOVERY_AVAILABLE → `complete_scenario_attempt`). Until then a real user can finish decisions but cannot complete a
  scenario, so Module 2 stays locked outside the tests.
- A pay decision waits in PAYMENT_PENDING; the player can cancel, return to checkout, or finish without paying.
  PAYMENT_CAPTURED is a server-only event for Step 7.
- Personalization uses authored slot defaults and the profile first name; Gemini slots arrive in Step 8.
- `/play/demo` was removed (the real player replaced it); `/play/demo/results` stays as the Phase 7 design shell.
- A foreign `/play/<id>` shows the not-found page with HTTP 200 (the `(app)` loading boundary streams); no attempt
  data is sent.

## Phase 5 — PayPal Sandbox checkout + fictional wallet (Step 7) ✅ — automated checks pass; manual buyer approval: see notes
- [x] Reviewed PayPal's current docs (developer.paypal.com/checkout/integrate, /sdk/js/set-up, Orders v2): JS SDK v6
      with client-ID auth, server-side order creation and capture. No npm dependency added
- [x] `src/lib/payments/checkout.ts` (pure rules + tests), `paypal.ts` (Orders v2 client: OAuth token cache, create,
      capture, get, Sandbox guard, timeouts, idempotent request ids), `config.ts`, `server.ts` (payment service);
      startup env validation in `src/instrumentation.ts`
- [x] Migration `20261111090000_paypal_checkout.sql`: `payment_transactions`, `record_payment_order`,
      `record_payment_capture` (CAPTURED + ledger + FINALIZED atomically), `update_payment_order`, classification at
      completion; RLS read-own, service_role-only writes. Applied by the owner during Step 7
- [x] Routes `POST /api/attempts/[id]/checkout/{order,capture,sync,cancel}`; PAYMENT_CANCELLED moved to the server
- [x] Reusable `CheckoutPanel` with the official PayPal button (v6, Sandbox) inside the scenario flow; refresh-safe
      reconciliation; cancel / failed / pending / unavailable states; payment confirmation on the locked card
- [x] Connected M2-S2 (reference), M2-S1, M3-S1; M1-S1, M1-S2, M3-S2 intentionally have no checkout
- [x] Debit Training Funds only on a verified capture via `record_training_payment` (idempotency key =
      PayPal-Request-Id), scored attempt only; replays get their own Sandbox orders/captures (`is_practice`), no ledger
- [x] Currency: USD verified with the Sandbox merchant; others stay disabled and are refused at checkout
- [x] Tests: 190 unit tests (mocked PayPal responses for every settlement branch, client errors/timeouts/401 refresh,
      no secrets in logs, migration drift); 59 live integration tests (15 new: DB money invariants, real Sandbox orders
      read back from PayPal for M2-S2/M2-S1/M3-S1 and a replay, double-click reuse, cancel/retry, ownership, order
      mismatch, non-payment scenarios); 15 real-browser checks in Chrome (PayPal v6 button renders, opens
      www.sandbox.paypal.com, closing it cancels with no deduction, retry, 1280/768/360 px without horizontal scroll,
      no judgment words, no console errors); production build; no secret in the client bundle
- [ ] **Manual:** a Sandbox Personal buyer approves a real checkout (M2-S2 original + a replay) — see the Step 7 report

**Phase 5 notes / limitations**
- A successful capture can't be automated: approving needs a person logged into the Sandbox buyer account (a test card
  could not approve orders on this Sandbox app). The capture → ledger → finalize path is covered at the database level
  with synthetic capture ids and by mocked PayPal responses; the real end-to-end approval is the manual step above.
- Captured Sandbox payments are not refunded (no refund feature). Abandoned unapproved orders simply expire at PayPal.
- Until Step 8, a scored attempt that paid stops at FINALIZED; its payment stays classified `pending` (shown as
  "awaiting results") until completion classifies it as spending or a scam loss.
- PayPal may briefly return two different Sandbox orders for one request id under truly simultaneous requests; the
  database keeps one and every caller gets that one. The other is never approvable through ScamSense.
- No webhooks: capture is synchronous and `sync` reconciles. A capture left PENDING at PayPal is re-checked when the
  player presses "Check again" or reloads.

## Phase 6 — Hybrid routing, Gemini personalization and evaluation (Step 8) ✅ — verified 2026-11-12, awaiting owner review
- [x] Inspected the "Other" options: occupation Other ✓ and goal Other ✓ existed; custom goal text existed but was
      optional; no occupation description, no "Other" activity, no activity description. Added all three (onboarding
      steps 1–2, My Profile), required only when "Other" is chosen, sanitized, length-limited
- [x] Migration `20261112090000_hybrid_intelligence.sql` (profile columns + trigger, 5 new tables, 6 `service_role`
      functions, RLS read-own) — applied by the owner on 2026-11-12
- [x] Gemini client `src/lib/ai/gemini.ts` (official `@google/genai` 3.0.0): structured JSON, Zod re-validation,
      deadlines, ≤2 jittered retries honouring retryDelay, invalid-output retry, rate limiter, usage monitor
      (`src/lib/ai/usage.ts`, `GET /api/dev/gemini-usage` in development). Model verified: `gemini-3.5-flash-lite`
      (free tier, structured outputs)
- [x] Deterministic routing `src/lib/domain/routing.ts` (0.50·A + 0.20·C + 0.15·E + 0.15·D, E = 0.5, D = 1, ties by
      key), predefined/exact/vague resolution, Gemini custom-input classifier with validation and fingerprint cache,
      write-once order per (user, module) at module start; legacy started modules initialized without Gemini
- [x] Narrative slots for all six scenarios; personalization per new scenario, persisted, linked before play, reused by
      refresh/resume/replays, tracked fallback
- [x] (Owner decision 13, 2026-11-13) Gemini-personalized neutral intros restored in the same request, with
      scenario-specific facts, hints, and accuracy/spoiler validation (`src/lib/personalization/intro.ts`), stored in
      `intro_line` (migration `20261113090000_personalization_intro.sql`, **to be applied by the owner**); focused live
      check `tests/gemini/intro.live.test.ts`: 6/6 accurate, personalized intros accepted on the final configuration
- [x] ONE evaluation request per finalized attempt (evidence, assumptions, missed evidence, feedback, advice, takeaway,
      separate humor); ID whitelisting, correctness guard, policy/statistics/points/link/mocking guards; backend
      scoring; atomic completion via `record_attempt_evaluation`; retry or labelled basic feedback after a failure
- [x] Player "Reviewing your reasoning…" panel; real results page (`/play/[id]/results`); module page "Ordered for you"
- [x] Tests: 282 unit tests (routing formula + profiles A–F, tag planning, classifier validation, Gemini client
      retries/backoff/limits, personalization of all six scenarios for two profiles with ground-truth invariants,
      evaluation validation/scoring/fallback, measured request counts with an in-memory DB, profile "Other" rules,
      migration drift/RLS); live Gemini suite `npm run test:gemini` passed twice (20 + 23 requests, 0 invalid outputs);
      existing live integration suites 59/59 pass against the Step 8 build; new Step 8 integration suite (5 tests)
      skips until the migration is applied; pre-migration API journey 27/27; production build; client-bundle leak scan
- [x] After the migration: Step 8 integration suite 5/5 (one test's expected total corrected from 75 to 70 =
      40+15+5+10); live end-to-end check 21/21 against the production build with real Gemini: custom "Other" profile →
      1 classification (cached; a repeat start made none) → routed order saved (`custom_gemini`) → M1-S1 personalized by
      Gemini (one instance; refresh reused it) → actions, decision, explanation → one evaluation
      (`correct_strong_reasoning`) → official score 84/100 (40/17/17/10) → COMPLETED; repeat POST returned the stored
      result; results page and progress updated. No PayPal payment was involved

**Phase 6 notes / limitations**
- Free-tier RPM/RPD values are only visible in AI Studio (not on the public docs pages); `GEMINI_MAX_RPM` defaults to 12.
- The rate limiter and usage monitor are in-process (per server instance), which is enough for the hackathon MVP.
- Live checks show the model's evidence recognition is reasonable but not deterministic; scoring stays reproducible
  because points are computed from the stored, validated IDs.
- No browser-automation tool was available in this session: the UI was verified through the production build, page
  responses, and the API journey, not by clicking through in a real browser.
- Reveal the Red Flags and the Recovery Playbook screens remain Step 9 (results show links/"coming soon").

## Step 9 — Reveal the Red Flags + Your Recovery Playbook ✅ — automated checks pass, awaiting owner review
Covers the Reveal items of Phase 7 and the Recovery Playbook of Phase 10 (the Step 9 brief combined them).
- [x] Inspected Step 8 completion/results, answer keys, anchors (50 evidence targets), sim apps
- [x] Pure anchor locator + client-safe `ReviewView` (COMPLETED only, stored data only, exact played narrative)
- [x] Read-only environment (`readOnly`, `reveal`, `useCanNavigate`, `useReveal` in all six apps; inline invoice)
- [x] Accessible numbered markers (overlay with clipping, `display: contents` support, collision nudging), one
      explanation at a time, Previous/Next, Escape, focus return; legend + evidence guide; reasoning status kept separate
- [x] Legitimate-scenario framing (M2-S2: positive + worth verifying, no red flags)
- [x] Official sources checked 2026-11-09: 2 verified (report-suspicious-messages, report-fraud); 5 returned HTTP 403
      and are linked only, pending human verification (PRODUCT_SPEC §6.3)
- [x] Versioned policy knowledge base, deterministic scenario → policy mapping, authored steps and limitations
- [x] Gemini personal note (one per attempt, claimed + stored, policy vocabulary rejected) with authored fallback
- [x] Migration `20261114090000_recovery_playbooks.sql` — **to be applied by the owner**
- [x] `/play/[id]/review`, `/play/[id]/playbook`, public `/playbook`, debrief navigation, results links
- [x] Tests: 361 unit tests (79 new: locator for all six scenarios, review view, completion gate, KB invariants,
      mapping, no invented deadlines/guarantees, note validation, measured Gemini calls, migration guards); live suite
      `review-playbook.integration.test.ts` 6/6 against the production build (unfinished/foreign attempts hidden, 401/404/409,
      review + Playbook content, DB snapshot unchanged after visiting both pages, replay separation); Step 6/8/5
      live suites 33/33; production build; client bundle scan (no answer key, guidance, or prompt)
- [ ] **Manual:** apply the migration; then verify one live personal note (1 Gemini request)
- [x] ~~Manual: human verification of the five unverified PayPal pages~~ Done 2026-11-10 by a second automated pass
      (all nine pages HTTP 200, 75 quotes checked verbatim); see "Policy re-verification" below
- [ ] **Manual:** visual check of marker positions in a real browser (desktop, tablet, 360 px)

**Step 9 notes / limitations**
- No browser-automation tool was available: marker placement, scrolling, focus handling and mobile layout were verified
  by code review, build, and HTML responses only, not by clicking in a real browser.
- The PayPal checkout live suite was not re-run (payment code unchanged; it creates real Sandbox orders).

## Step 10 — Sensei Kenshi learning companion ✅ — automated + live checks pass, awaiting owner review
Covers Phase 11 below (the Step 10 brief replaces its streaming/history plan; see ARCHITECTURE §5 decision).
- [x] Inspected the placeholder chat/page, nav, layouts, Step 8 Gemini client, Step 9 knowledge base and debrief pages
- [x] Backend answer protection: session user, RLS ownership (404), COMPLETED-only attempt context (409), overview of
      COMPLETED attempts only, unfinished scenarios by title only (`src/lib/kenshi/context.ts`, `server.ts`)
- [x] Policy retrieval from the Step 9 knowledge base only (topic match + scenario mapping, max 4; unverified = link only)
- [x] `POST /api/chat`: one structured Gemini call (`chat` category, 20 s, own per-user budget), Zod + reply guards
      (invented policy, links, credentials, unfinished-scenario verdicts), server-attached official sources
- [x] Chat UI (`src/components/kenshi/`): avatar, greeting, distinct bubbles, typing indicator, suggestions/follow-ups,
      auto-scroll, keyboard, retry without duplicates, context chip + switching, sources with verification labels
- [x] Entry points: dashboard card, `/sensei`, "Ask Sensei Kenshi" in the debrief nav (Results / Reveal / Playbook)
- [x] Absent from gameplay: nav item hidden on `/play/[attemptId]`; test forbids Kenshi in the player and sim apps
- [x] Removed the Phase 1 offline placeholder (`src/components/chat/SenseiChat.tsx`)
- [x] Tests: 398 unit tests (37 new: answer protection for every unfinished state, foreign attempts, Module 2/3 keys
      absent from the prompt under prompt injection, original vs replay records, legit scenario framing, policy
      retrieval, reply guards, one request per question, bounded history, gameplay exclusion); live suite
      `kenshi.integration.test.ts` 8/8 against the production build (401/400/404/409, entry points present on
      dashboard and debrief pages and absent from the player, 4 live answers, no DB writes); Step 9 + progression +
      scenario-engine live suites 34/34; production build; client bundle scan (no system prompt or answer key)
- [ ] **Manual:** click through the panel in a real browser (desktop, tablet, 360 px), incl. screen reader check
- [ ] **Owner review:** open questions 19–20 (PRODUCT_SPEC §12)

**Step 10 notes / limitations**
- No migration and no new environment variables.
- Gemini output is non-deterministic; the guards catch the defined patterns (invented deadlines, statistics, refund
  promises, links, verdicts that name an unfinished scenario) but can't judge every possible wording. The protection
  that matters is structural: unfinished answer keys never reach the model.
- One live replay check failed once in three runs without any server-side Gemini error and passed on its own re-run,
  most likely the 30 s per-test timeout during a retry; the live block now has a 60 s timeout.
- The rate limiter is in-process (as in Step 8); chat has its own per-user budget but shares the global RPM.
- (Superseded 2026-11-10) Originally only two PayPal pages were verified; since the re-verification Kenshi can explain
  Purchase/Seller Protection, dispute timeframes, and the unauthorized-transaction definition from verified facts.
- The PayPal checkout and Step 8 intelligence live suites were not re-run (payment and evaluation code unchanged;
  they create Sandbox orders / Gemini evaluations).

## Policy re-verification (Recovery Playbook fix, 2026-11-10) ✅ — automated checks pass, awaiting owner review
- [x] Re-requested every official source (plus the owner's alternative URLs); all nine loaded (HTTP 200); none 403
- [x] Knowledge base `2026-11-10.1`: 9 verified records (2 new Help Center records), new fields `pageUpdated`,
      `procedures`, `exclusionsNote`; 75 verbatim quotes checked automatically against the page text, 15 summaries
      labelled and checked by hand; corrected the incomplete text-message steps of report-suspicious-messages
- [x] Playbook: cards show key points / eligibility / how it works / exclusions; "read the terms on PayPal" practice
      steps replaced by verified PayPal steps (M1 reporting steps, M2-S1/M3-S1 scope + Friends and Family + the
      unauthorized definition, M2-S2 contact seller + timeframes, M3-S2 shipping address/redirect/proof); captions and
      distinctions updated; scenario → policy mapping unchanged
- [x] Sensei Kenshi: retrieves the new items; the reply guard now allows a timeframe only when a retrieved verified
      fact states it (all others still rejected); prompt updated
- [x] Tests: 143 focused unit tests (Playbook, Kenshi, report, content) incl. new distinction/timeframe tests;
      type-check, lint, production build; public `/playbook` HTML checked (no "Not yet verified"/"HTTP 403")
- [ ] **Not run:** Step 9 and Step 10 live suites (Gemini calls); the Step 9 suite's expectations were updated
- [ ] **Owner review:** the 15 summary items and the curated exclusion selections (PRODUCT_SPEC §6.3)

## Step 11 — Module rewards, certificates, analysis reports, Zapier email ✅ — automated checks pass, awaiting owner review
Covers Phase 9 below.
- [x] Inspected completion (`complete_scenario_attempt`), scores, snapshot-derived badges, placeholder completion page
      and email form, ledger, originals vs replays, Step 8 stored evaluations
- [x] Migration `20261115090000_module_rewards.sql`: `badges`, `certificates`, `certificate_email_requests`, award
      trigger on module completion + backfill, `ensure_module_rewards`, `begin/finish_certificate_email_request`,
      private bucket `certificate-pdfs`; RLS read-own, no browser writes — **to be applied by the owner**
- [x] Badges (rosette SVG) on dashboard, My Profile, Certificates, completion page
- [x] Certificate preview (HTML) + identical server PDF (`@react-pdf/renderer`, embedded Nunito/Inter); no download
- [x] Analysis report PDF via `GET /api/modules/[moduleKey]/report` (stored data only, owner only, no-store)
- [x] Certificate email via the existing Zap: allowlisted payload + `certificateId`, `completionDate`,
      `certificatePdfUrl` (24 h signed URL); dedupe, rate limit, honest statuses, retry
- [x] Tests: 440 unit tests (42 new: migration drift/uniqueness/grants, certificate view + UTC dates, file names,
      email statuses, body validation, Zapier payload allowlist + success/HTTP error/timeout/network/not configured,
      email service (send once, failure, PDF failure skips Zapier, existing/in-flight/duplicate, 429, unfinished and
      foreign modules), repair path, report model (scores, funds, evidence, excerpt, references, missing data), PDF
      rendering (certificate 1 page, report multi-page, Latin Extended name), no certificate download in browser
      code); production build; client bundle scan; live smoke test against the production build (report 200 PDF x2,
      401, 409; pages render; pre-migration fallbacks)
- [x] Live suite `tests/integration/rewards.integration.test.ts` written (one badge/certificate, idempotency incl.
      replay, immutability, unlock, owner-only APIs, repeatable report download with unchanged DB, email dedupe and
      rate limit in the DB, private storage + signed-URL expiry; optional real email with `ZAPIER_LIVE_TEST_EMAIL`).
      **Not run yet: it skips until the migration is applied**
- [x] Migration applied by the owner (2026-11-10): 3 tables + private bucket present; backfill awarded 86 badges and
      86 certificates for the 86 previously completed modules. Step 11 live suite: 9 passed, 1 skipped (opt-in real
      email). Two test-only fixes: valid score split in the helper; 10 s signed-URL TTL (2 s raced clock skew)
- [ ] **Manual:** map `certificatePdfUrl` to Gmail Attachments in the existing Zap (ARCHITECTURE section 11.3), send one
      real certificate email, confirm the PDF attachment opens, then publish the Zap
- [ ] **Manual:** visual check of certificate preview, badges, and report button at 1440 / 768 / 360 px

**Step 11 notes / limitations**
- `ZAPIER_WEBHOOK_SECRET` is not used (no verification step exists in the Zap); the webhook URL stays server-only.
- Email delivery can't be confirmed; "submitted" means Zapier accepted the request.
- Report and file-name dates use UTC (a completion late in the evening in the Americas shows the next day).
- PDF fonts: Latin + Latin Extended only (PRODUCT_SPEC open question 23).
- No browser-automation tool was available: responsive layouts were checked by code review and HTML responses only.

## Phase 7 — Results and Reveal the Red Flags (superseded by Step 9 above)
- [ ] `/play/[attemptId]/results` gated on COMPLETED
- [ ] Feedback view (praise first, outcome, wallet impact, AI feedback, separate humor, safest next step)
- [ ] Reveal mode: re-render the environment with evidence highlights labeled red flag / worth verifying / positive,
      with explanations and "you mentioned this" markers. Labels use icon + text, never color alone
- [ ] Relevant Recovery Playbook sections at the end of results

## Phase 8 — Remaining scenario content
- [ ] Author scenarios 2–6 per PRODUCT_SPEC §3.3 (after the product owner confirms the storylines)
- [x] Payment percentages, evidence, keywords, fallback texts, Playbook links (initial versions, Step 6)
- [ ] Content review against the core principles + R8–R17, R28–R30

## Phase 9 — Module completion: badge, certificate, report, Zapier (implemented in Step 11 above)
- [x] Module-completion rewards (badge + certificate rows via trigger, next module unlock unchanged)
- [x] Completion page: badge, on-screen certificate (no download)
- [x] Zapier webhook integration + email form + retry + rate limit (shared secret dropped: the Zap can't verify it)
- [x] `@react-pdf/renderer` analysis report via `GET /api/modules/[moduleKey]/report`

## Phase 10 — Your Recovery Playbook (implemented in Step 9; remaining: human source verification)
- [ ] Research and transcribe verified U.S. PayPal policy content from official sources (URL + last-verified date per
      section)
- [ ] `/playbook` pages; links from results and the report
- [ ] Review: no invented policies, timelines, statistics, or guarantees

## Phase 11 — Sensei Kenshi (implemented in Step 10 above)
- [x] `/api/chat` with grounding rules (completed attempts only, knowledge-base records); JSON, not streaming
- [x] Panel + `/sensei` page; rate limit; friendly failure with retry (no stored history, by decision)
- [x] Tests: refuses hints for in-progress scenarios; no policy invention passes the guards

## Phase 12 — Hardening and launch
- [ ] Playwright E2E: full journey through 3 modules (with Sandbox), plus degraded modes (Gemini/Zapier off)
- [ ] Responsive QA (360, 768, 1024, 1440), accessibility audit, CSP headers
- [ ] Security review (RLS, ownership checks, secret exposure, payload leaks)
- [ ] Deployment (Vercel + Supabase), production env vars (still Sandbox), demo accounts
