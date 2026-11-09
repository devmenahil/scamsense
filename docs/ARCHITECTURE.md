# ScamSense — Technical Architecture

Status: updated for Phase 4 (Step 6: immersive scenario engine). Read together with `CLAUDE.md` (rules), `PRODUCT_SPEC.md` (behavior), and `DATA_MODEL.md`.

## 1. System overview

```
┌──────────────────────────── Browser ────────────────────────────┐
│ Next.js React UI (App Router)                                   │
│  • ScamSense chrome (brand UI)   • Scenario environments (sim)  │
│  • PayPal JS SDK buttons (Sandbox)  • Sensei Kenshi chat panel  │
└───────────────┬─────────────────────────────────┬───────────────┘
                │ fetch (JSON, cookie session)    │ PayPal popup (Sandbox)
┌───────────────▼─────────── Next.js server ──────▼───────────────┐
│ Route handlers  app/api/**                                      │
│   ├─ auth/session check (Supabase SSR)                          │
│   ├─ domain layer  src/lib/domain/*  (pure, deterministic)      │
│   │     state machine · scoring · wallet · unlocks · money      │
│   ├─ content layer src/content/* (server-only answer keys)      │
│   ├─ integrations  src/lib/integrations/*                       │
│   │     gemini.ts · paypal.ts · zapier.ts · pdf/*               │
│   └─ data access   src/lib/db/*  (Supabase client)              │
└──────┬──────────────┬───────────────┬───────────────┬───────────┘
       │              │               │               │
  Supabase       Gemini API     PayPal Orders v2   Zapier Catch Hook
  Postgres+Auth  (@google/genai) (api-m.sandbox)   → email
```

**Guiding principle:** deterministic code owns *truth* (correctness, money, progress). Gemini owns only *words*
(personalized surface text, explanations of known facts, humor), always validated, and it always has a fallback.

## 2. Stack decisions

| Concern | Choice | Rationale |
|---|---|---|
| Framework | Next.js App Router, TypeScript strict | Required. One deployable unit for UI and API. |
| Styling | Tailwind CSS v4 with brand tokens in `src/app/globals.css` `@theme` (v4 CSS-first config; the default palette is removed) | Required. Tokens enforce the brand palette. |
| Fonts | `next/font/google` Nunito + Inter | Self-hosted, no layout shift. |
| DB + Auth | **Supabase** (Postgres + Supabase Auth email/password) | Managed Postgres with built-in auth and RLS. Simplest option for a hackathon. |
| Supabase client | `@supabase/ssr` (cookie sessions) | Official App Router integration. |
| Validation | Zod | Env, request bodies, content files, and AI output. |
| AI | `@google/genai`, JSON-mode structured output | Official SDK. Model set by `GEMINI_MODEL`. |
| Payments | `@paypal/react-paypal-js` (client) + server `fetch` to Orders v2 | Official SDK. No heavy server SDK needed. |
| PDF | `@react-pdf/renderer` (server, Node runtime) | Pure JS, works in route handlers, brand fonts embeddable. |
| Email | Zapier Catch Hook → Email by Zapier / Gmail | Required. No email provider code in the app. |
| Tests | Vitest (domain + content validation), Playwright (E2E) | Lightweight and standard. |
| Hosting | Vercel (assumed) | Native Next.js hosting. Route handlers that render PDFs use `runtime = "nodejs"`. |

Not used (to keep scope small): ORMs (we use SQL migrations + typed Supabase client), state-management libraries
(React state + server is enough), CMS, queues, PayPal webhooks (capture is synchronous), and a separate intent
classifier (R23).

## 3. Repository layout (target)

```
/
├─ CLAUDE.md
├─ .env.example
├─ docs/
├─ reference/                       # brand PDF + level info (read-only inputs)
├─ supabase/migrations/             # SQL schema + RLS
├─ public/brand/                    # logo SVGs, icons
├─ src/
│  ├─ app/                          # routes (see §4) + app/api (see §5)
│  ├─ components/
│  │  ├─ ui/                        # brand primitives: Button, Card, Pill, Tile, Logo, ProgressBar
│  │  ├─ scenario/                  # environment renderers: EmailClient, ChatWindow, FakeBrowser,
│  │  │                             #   InvoiceView, MarketplaceView, PaymentRequest; RevealOverlay
│  │  ├─ feedback/  certificate/  chat/  dashboard/
│  ├─ content/
│  │  ├─ modules.ts                 # module definitions (keys, order, starting funds)
│  │  ├─ scenarios/<key>/
│  │  │  ├─ render.ts               # client-safe environment data (no judgments)
│  │  │  └─ answer-key.server.ts    # server-only: decisions, evidence, explanations, payment %
│  │  ├─ playbook/                  # verified U.S. PayPal recovery content + source URLs
│  │  └─ schema.ts                  # Zod schemas for all content
│  ├─ lib/
│  │  ├─ domain/                    # pure logic + tests: stateMachine, scoring, wallet, money, unlocks
│  │  ├─ integrations/              # gemini/, paypal/, zapier/, pdf/
│  │  ├─ db/                        # Supabase clients + repository functions
│  │  ├─ auth/                      # session helpers, requireUser()
│  │  ├─ env.schema.ts              # pure Zod env schemas (tested)
│  │  ├─ env.ts                     # server-only getServerEnv()
│  │  ├─ public-env.ts              # browser-safe NEXT_PUBLIC_* values
│  │  ├─ navigation.ts              # primary/footer nav config (tested: every link has a page)
│  │  └─ demo/demoData.ts           # Phase 1 demonstration data for page shells (removed as pages go live)
│  └─ middleware.ts                 # Supabase session refresh + route protection
└─ tests/e2e/
```

## 4. Application routes (App Router)

Route groups: `(marketing)` public, `(auth)` sign-in/up, `(app)` authenticated and onboarded.

| Route | Access | Purpose |
|---|---|---|
| `/` | Public | Landing: value proposition, how it works, CTA |
| `/sign-up` | Public (guest-only) | Display name, email/password, optional age bracket, required "at least 18" checkbox (R2) |
| `/forgot-password` | Public | Request a Supabase password-reset email |
| `/reset-password` | Auth (recovery session) | Choose a new password |
| `/auth/confirm` | Public (route handler) | Landing for Supabase email links (`code` or `token_hash`); sets the session |
| `/sign-in` | Public (guest-only) | Sign in; honours a same-site `?next=` |
| `/onboarding` | Auth, not onboarded | Three steps; steps 1–2 saved as you go; resumes at the first incomplete step (R3, R4) |
| `/dashboard` | App | Real progress (Phase 3): current module, overall progress, Training Funds, score, badges, modules, goal, certificate/report access, past results |
| `/modules/[moduleKey]` | App | Module overview: locked notice, or "Start module N" (opens the Training Funds period), scenario slot statuses, Training Funds card + ledger history |
| `/play/[attemptId]` | App, owner | **Immersive scenario** (`ScenarioPlayer`): intro → explore → decide → confirm → explain → (Sandbox checkout) → locked. Client-safe view only; a foreign attempt shows the not-found page |
| `/play/[attemptId]/results` | App, owner, attempt COMPLETED | Feedback, wallet impact, AI comment, **Reveal the Red Flags** |
| `/modules/[moduleKey]/complete` | App, module completed | Badge, certificate preview, email form, report download |
| `/playbook` (+ `/playbook/[section]`) | Public | Your Recovery Playbook (R21) |
| `/sensei` | App | Sensei Kenshi full-page chat (also a floating panel, Phase 11) |
| `/modules` | App | Index of the three modules with lock states (primary nav "Modules") |
| `/certificates` | App | Badges, certificate status, and report access per module (primary nav "Certificates") |
| `/profile` | App | "My Profile": view and edit every profile field in place (shared field components with onboarding), sign out. Currency changes apply from the next module start |

`middleware.ts` refreshes the Supabase session and redirects unauthenticated users to `/sign-in` and
non-onboarded users to `/onboarding`. Authorization for specific resources (ownership, unlocks, attempt state) is
re-checked in server components and API routes. Middleware is never the only guard.

Scenario starts go through `POST /api/scenarios/[scenarioKey]/attempts`, which returns an `attemptId` (new or
resumable). The UI then navigates to `/play/[attemptId]`. Results are a separate route so they can never render
before completion.

## 5. API endpoints

All routes return JSON (except the PDF), validate input with Zod, call `requireUser()`, and check ownership.
The error shape is `{ error: { code, message } }`.

### Auth (Supabase Auth via the user's cookie session; no service-role key)
| Method & path | Body | Effect |
|---|---|---|
| `POST /api/auth/sign-up` | `{displayName, email, password, ageBracket?, ageConfirmed: true}` | `supabase.auth.signUp` with metadata → trigger creates the profile. Returns `{status: "signed_in" \| "confirmation_required"}`. Duplicate email → 409 |
| `POST /api/auth/sign-in` | `{email, password}` | Sets session cookies. Returns `{onboarded}` |
| `POST /api/auth/sign-out` | — | Ends this browser's session (`scope: "local"`) |
| `POST /api/auth/forgot-password` | `{email}` | Sends a reset link; identical response whether or not the account exists |
| `POST /api/auth/update-password` | `{password, confirmPassword}` | Requires a session (the recovery session from the email link) |

### Profile and progress
| Method & path | Body / params | Returns |
|---|---|---|
| `GET /api/profile` | — | Own profile (selected by session user id; RLS also enforces it) |
| `PATCH /api/profile` | Onboarding step 1–2 fields only (`.strict()`) | Profile. Partial save while onboarding |
| `PUT /api/profile` | Complete profile (`.strict()`); goal amount as a major-unit string, converted server-side to minor units | Profile, `onboarding_completed = true`. Unknown keys (e.g. `user_id`) → 400 |
| `GET /api/config/currencies` | — | Supported currency list (from the server allowlist) |
| `GET /api/progress` | — | `{progress}`: the `ProgressSnapshot` (module lock states, scenario statuses with start/resume/replay actions, current Training Funds or next-module preview, per-module ledger + summary, scores, badge dates). Read through RLS. 403 until onboarded |
| `POST /api/modules/[moduleKey]/start` | — (no body) | Opens the module's Training Funds period: server computes currency + amount from the saved profile, checks the unlock, calls `start_module_run`. 201 new, 200 already started (idempotent), 409 locked, 404 unknown |

### Scenario attempts (Step 6, implemented)
| Method & path | Body | Returns / effect |
|---|---|---|
| `POST /api/scenarios/[scenarioKey]/attempts` | — | `planScenarioStart` + `create_scenario_attempt`: 201 `{attemptId, kind: "new" \| "replay"}`, 200 `{kind: "resume"}`. 409 `module_locked` / `module_not_started`, 404 unknown |
| `GET /api/attempts/[id]` | — | `{attempt: ClientAttemptView}` (`src/lib/scenario/view.ts`): state, intro line, token-filled render, recorded action IDs, pending/locked decision, own locked explanation, checkout details while a pay decision is in a payment state, `isPractice`. **Never the answer key.** Foreign/unknown → 404 |
| `POST /api/attempts/[id]/events` | `{type}`: START · RECORD_ACTION{actionId} · SELECT_DECISION{decisionId} · CLEAR_DECISION · CONFIRM_DECISION · PAYMENT_CANCELLED · RETRY_PAYMENT · FINALIZE (strict) | Pure `transition()` decides, `apply_attempt_event` re-checks and records. Server-only events are rejected (400). Illegal → 409, unknown IDs → 400. Returns the new view |
| `POST /api/attempts/[id]/justification` | `{text}` (20–1000 after trimming) | Locks the explanation → `PAYMENT_PENDING` (pay) or `FINALIZED`. Returns the new view |
| `GET /api/attempts/[id]/results` | — | *(Step 8–9)* Only when `COMPLETED` |

### PayPal Sandbox
| Method & path | Body | Effect |
|---|---|---|
| `POST /api/paypal/orders` | `{attemptId}` | Validates that the attempt is `PAYMENT_PENDING` with a payable locked decision (`buildCheckoutRequest`). **Server computes the amount and currency.** Creates an Orders v2 order (`intent: CAPTURE`) and stores a `payment_transactions` row → returns `{orderId}` |
| `POST /api/paypal/orders/[orderId]/capture` | — | Captures the order. On a verified `COMPLETED` capture, atomically records it, debits the wallet (scored attempt only) and sends `PAYMENT_CAPTURED` → `PAYMENT_COMPLETED` → `FINALIZE` |
| `POST /api/paypal/orders/[orderId]/cancel` | — | Marks the order cancelled → `PAYMENT_CANCELLED` (retry or finish without paying; the decision stays locked) |

### Completion, certificates, reports
| Method & path | Effect |
|---|---|
| `GET /api/modules/[moduleKey]/report` | Streams the analysis-report PDF (`Content-Disposition: attachment`). Module must be completed. Node runtime |
| `GET /api/certificates/[moduleKey]` | Certificate data for the on-screen preview (no file download) |
| `POST /api/certificates/[moduleKey]/email` | `{email}`: records a request and posts to the Zapier webhook (5s timeout). Returns `sent` or `failed` (retryable). Rate-limited |

### Sensei Kenshi
| Method & path | Body | Effect |
|---|---|---|
| `POST /api/chat` | `{message, contextAttemptId?}` | Builds a grounded prompt (§8.3) and calls Gemini (streamed text response). Stores messages. Falls back on failure. Rate-limited per user |
| `GET /api/chat/history` | — | Recent messages |

## 6. Scenario content model (Step 6, implemented)

Content is typed TypeScript validated by Zod at import time and in tests. Each scenario is split so the answer key
cannot leak by accident:

**`src/content/scenarios/<key>/render.ts` (client-safe, schema `schema.ts`)**
- `scenarioKey`, `contentVersion`, `interfaceType` (`chat_email` · `web_browser` · `invoice` · `marketplace`),
  neutral `introLine` (R9), `startAppId`.
- `apps`: the simulated device's apps, each a typed environment: `messages` (threads with controlled `branches`),
  `mail` (messages, links with a status line, document attachments → invoice viewer), `browser` (pages of typed
  site blocks, bookmarks, inspectable address), `wallet` (fictional TandemPay), `marketplace` (products, sellers,
  seller chat, checkout), `seller_hub` (listings, orders, buyer chat).
- `anchor` / `*Anchor`: stable, **neutral** element IDs rendered as `data-sim-anchor` with no styling difference.
  Evidence targets them; far more elements carry anchors than are evidence. Tests forbid judging words in any ID
  sent to the browser.
- `actions` (`investigate` | `interact`, optional `requires` for controlled branching) and `decisions` (`pay` |
  `other`, an `intent` that picks the explanation prompt, `requires`). Every action and decision is placed on a
  control in the environment (validated).
- Text tokens filled on the server: `{{amount}}`, `{{amount.<part>}}`, `{{amount.minus.<part>}}`, `{{playerName}}`,
  personalization `slots` (authored defaults; Gemini in Step 8).

**`src/content/scenarios/<key>/answerKey.server.ts` (`import "server-only"`, schema `templateSchema.ts`)**
- `fixedScamStatus`, `fixedCorrectDecisionRules`, `evidenceDefinitions` (evidenceId, targetElementId, evidenceType
  red_flag | worth_verifying | positive_verification_evidence, title, explanation, educationalImportance,
  associatedCorrectDecisionRules, weight, keywords), verification action weights, `unsafeActionIds`,
  `payableDecisionIds`, `paymentOutcome`, `recoveryPolicyIds`, `fallbackContent`.
- Routing metadata for Step 8: `primaryCategory`, `secondaryCategoryTags`, `activityTags`, `contextTags` (shared
  vocabularies, with profile mappings `PROFILE_ACTIVITY_TAGS` / `PROFILE_CONTEXT_TAG`), difficulty
  (recommendedExperienceLevel, interactionComplexity, numberOfDecisionPoints), `evidenceReferences` (empty: no
  invented sources or statistics). Age is never a routing input.

`templates.server.ts` assembles the full `ScenarioTemplate` (every field in the Step 6 brief §5, derived lists
included) and cross-checks the answer key against the render. Routing may only consider the scenarios of an
unlocked, started module (`planScenarioStart` refuses locked modules).

## 7. Scenario state machine (Step 6)

Pure reducer `src/lib/domain/scenarioStateMachine.ts`; the database repeats the legal (from → to) list in a trigger
(`scenario_state_transition_allowed`) and `apply_attempt_event` is the only writer (row lock + expected-state check
→ 409 on a stale or double request).

```
INTRO ─START→ ACTIVE ⇄ INVESTIGATING (first investigate action; stays)
ACTIVE/INVESTIGATING ─SELECT_DECISION→ DECISION_SELECTED ─CLEAR_DECISION→ back
DECISION_SELECTED ─CONFIRM_DECISION (decision locked)→ EXPLANATION_REQUIRED
EXPLANATION_REQUIRED ─SUBMIT_EXPLANATION (locked)→ PAYMENT_PENDING (pay) | FINALIZED (other)
PAYMENT_PENDING ─PAYMENT_CAPTURED*→ PAYMENT_COMPLETED ─FINALIZE*→ FINALIZED
PAYMENT_PENDING ─PAYMENT_CANCELLED / PAYMENT_FAILED*→ PAYMENT_CANCELLED ─RETRY_PAYMENT→ PAYMENT_PENDING
PAYMENT_CANCELLED ─FINALIZE (finish without paying)→ FINALIZED
FINALIZED ─FEEDBACK_READY*→ FEEDBACK_AVAILABLE ─REVIEW_READY*→ REVIEW_AVAILABLE ─RECOVERY_READY*→ RECOVERY_AVAILABLE
RECOVERY_AVAILABLE ─COMPLETE* (complete_scenario_attempt only)→ COMPLETED            (* server-only events)
```

Invariants: decision write-once from CONFIRM, explanation write-once from SUBMIT (trigger); nothing from the answer
key is serialized before COMPLETED; a payment counts only after a verified capture; every accepted event is logged
in `scenario_attempt_events` (each action once), which also restores the environment (chosen branches, revealed
threads) after a refresh. Progression counts COMPLETED only. Replays (`attempt_number > 1`) run the same machine on
their own row and log.

## 8. Deterministic rules vs. Gemini-generated content

### 8.1 Ownership table
| Aspect | Owner | Notes |
|---|---|---|
| Which decision is correct | **Deterministic** (answer key) | R13 |
| Evidence list, classification, explanations (canonical) | **Deterministic** (authored) | R15–R16 |
| Payment amount / currency | **Deterministic** (% × module funds) | R19 |
| Wallet balances, ledger, resets | **Deterministic** | R18–R20 |
| Unlocks, badges, completion | **Deterministic** | R7, R24 |
| Score composition | **Deterministic** formula | See 8.4 |
| Recovery Playbook facts | **Authored + verified** (never AI) | R21, R30 |
| Scenario surface personalization | Gemini → validated slots, fallback = authored defaults | Never changes evidence or answers |
| Which evidence the user's reasoning addressed | Gemini proposes, validated against known IDs; fallback = keyword match | AI judges *reasoning coverage*, not truth |
| Personalized factual feedback paragraph | Gemini, grounded on the answer key; fallback = authored text | R14 |
| Short humorous comment (separate field) | Gemini; fallback = neutral encouraging line from a fixed pool | R14 |
| Chat answers | Gemini, scope-limited and grounded | R22 |

### 8.2 Gemini call contracts (all JSON-validated with Zod; 8–10s timeout; 1 retry where noted)

1. **Personalize scenario** (once at attempt creation, cached on the attempt)
   - In: profile (no free-text PII beyond display name), slot definitions + defaults.
   - Out: `{slots: {[name]: string}}`. Each value is length-checked and must not contain URLs, digits beyond an
     allowed pattern, or deny-listed judgment words. Invalid slots → defaults.
2. **Evaluate reasoning** (once at justification submit, 1 retry)
   - In: decision + whether it is correct (already computed), justification, the evidence list (ids, classification,
     explanation), legitimacy, profile summary.
   - Out: `{addressedEvidenceIds: string[], misconceptions: string[] (≤3, short), feedback: string (≤900 chars),
     humor: string (≤200 chars)}`.
   - Post-validation: drop unknown IDs. Feedback must not contradict the deterministic correctness (a guard checks
     that the correctness phrase matches). On failure → fallback.
3. **Chat** (Sensei Kenshi). Free text output, streamed. Scope enforced by the system prompt (§8.3).

Prompts live in `src/lib/integrations/gemini/prompts/` as versioned functions. The prompt version is stored with each
evaluation.

### 8.3 Sensei Kenshi grounding
System prompt: identity (friendly sensei, brand tone), scope (scenarios, scam awareness, PayPal), hard rules (no
policy invention, no guarantees, no statistics, no hints about in-progress scenarios, never request credentials). The
context includes:
- Profile summary.
- **Only completed** attempts: their evidence and feedback. In-progress attempts are referenced by title only, with
  the instruction "do not give hints."
- Recovery Playbook excerpts (authored), with URLs to cite.

Off-topic or unsafe requests get a polite redirect. No classifier is used (R23).

### 8.4 Scoring (deterministic, `src/lib/domain/scoring.ts`, Phase 3)
100 points per scenario, integer maths with half-up rounding, stored once per completed attempt in `scenario_scores`
with `scoring_version`:
- **Decision 40**: `decisionId ∈ correctDecisionIds` → 40, else 0.
- **Reasoning 30**: 30 × Σ weight(addressed evidence) / Σ weight(all evidence). Addressed IDs come from Gemini
  (Phase 6) or the keyword fallback; unknown IDs are dropped before scoring. This is the "fixed rubric" (R13).
- **Verification 20**: 20 × Σ weight(verification actions performed) / Σ weight(all verification actions), from
  engine-recorded in-environment events (Phase 4).
- **Payment safety 10**: 10 unless any `unsafeActionIds` (paying the fraudulent party, entering card details on a
  look-alike page, …) appears in the decision or recorded actions.
The rubric (`ScoringRubric`) is part of each server-only answer key. `scoreScenario` requires a real
`ReasoningAssessment`; nothing fabricates one. The results screen still leads with qualitative feedback (praise
first, R37); points are shown alongside.

### 8.5 Fallback evaluation
Case-insensitive keyword/phrase matching of the justification against each evidence item's `keywords`, followed by
authored `fallbackFeedback[correct|incorrect]` and a fixed encouraging line instead of humor. The UI shows a subtle
"Detailed AI feedback is unavailable right now" note.

## 9. PayPal Sandbox transaction lifecycle

Safety guard: `paypal.ts` asserts `PAYPAL_ENV === "sandbox"` and `PAYPAL_API_BASE === "https://api-m.sandbox.paypal.com"`
at module load. Otherwise it throws (R28). The JS SDK is loaded with the Sandbox client ID only.

```
User clicks in-simulation "Pay" → confirms → writes and locks the explanation → PAYMENT_PENDING
  │
  ▼ PayPal Buttons createOrder()                              (contract: src/lib/payments/checkout.ts)
POST /api/paypal/orders {attemptId}
  • buildCheckoutRequest: attempt PAYMENT_PENDING & locked decision payable
  • amount = round(module_run.starting_funds_minor × bp / 10000)  (currency = module_run.currency)
  • OAuth client-credentials token (cached in memory until expiry)
  • POST /v2/checkout/orders {intent: CAPTURE, purchase_units:[{amount, description:"ScamSense training (Sandbox)",
    custom_id: attemptId}]}  with PayPal-Request-Id = checkoutIdempotencyKey(attemptId, checkoutSequence)
  • insert payment_transactions(status=CREATED)
  ▼
User approves in PayPal Sandbox popup (Sandbox personal test account)
  ▼ onApprove()
POST /api/paypal/orders/{orderId}/capture
  • verify ownership + attempt PAYMENT_PENDING + order belongs to attempt
  • POST /v2/checkout/orders/{id}/capture (idempotent request id)
  • on capture status COMPLETED, verify amount & currency equal the stored values, then in ONE DB transaction:
      payment_transactions → CAPTURED (capture_id, paypal_status)
      scored attempt (attempt_number 1): wallet_ledger += PAYMENT debit (record_training_payment)
      practice replay (attempt_number > 1): NO ledger entry; the capture stays on the practice
        payment_transactions row only (official Training Funds untouched)
      PAYMENT_CAPTURED → PAYMENT_COMPLETED, then FINALIZE → FINALIZED
  • verifyCapture fails / DECLINED → FAILED; PAYMENT_FAILED → PAYMENT_CANCELLED (retry or finish without paying)
onCancel() → POST .../cancel → CANCELLED; PAYMENT_CANCELLED
onError()  → FAILED; friendly message; PAYMENT_CANCELLED
```

`payment_transactions.status`: `CREATED → CAPTURED | CANCELLED | FAILED`. Captured Sandbox payments are never refunded
by the app (no refund feature, R30). Scenario outcome text describes consequences only within the fiction.

**Replays (Step 5 review decision):** a replay is a full new attempt and may run a genuine Sandbox checkout again. The
same flow applies with these differences: the order is created for the replay's own attempt ID and a fresh
`request_id` (PayPal-Request-Id), so it can never collide with the original attempt's order; the amount is the same
slot percentage of the original module run's starting funds (practice amount, same currency); on capture the
`payment_transactions` row (`is_practice = true`) records the verified outcome but `record_training_payment` is not
called (the database rejects replays with `replay_not_charged` as a backstop). Duplicate captures are prevented by
the idempotent request id, the unique `paypal_order_id`/`paypal_capture_id`, at most one CAPTURED row per attempt, and
the attempt state check (`PAYMENT_PENDING` only). `checkoutSequence` = 1 + the attempt's RETRY_PAYMENT events, so a
new order (and key) exists only after the previous checkout was cancelled or failed. Cancelled or failed orders
never count as payments. Step 6 ships `pendingIntegrationGateway`, which answers `integration_pending` to every call:
nothing can fake a capture.

**Currency:** The JS SDK `currency` parameter must equal the module run's currency. `src/lib/domain/currency.ts` is
the single currency module for onboarding, dashboard, scenarios, wallet, checkout, impact calculations and reports.
It lists all 24 REST currencies from PayPal's official currency-codes page (transcribed 2026-11-09; page updated
2026-08-17) with `minorUnitDigits` (HUF/JPY/TWD are zero-decimal) and the in-country-only flag (BRL/CNY/MYR).
Merchant-specific Sandbox support has not been verified (no PayPal credentials yet), and PayPal support must not be
assumed, so **USD is the only enabled currency** (Step 5 review; migration `20261109140000_usd_only_currency.sql`).
To enable another after an end-to-end Sandbox test: it needs a reference rate in `src/content/exchangeRates.ts`, then
flip `enabled` and add a migration updating `profiles_preferred_currency_check` (tests fail if they diverge).
Validation happens in the browser, the API (Zod), and the database (check constraint); the server also falls back to
USD for any non-allowlisted value when computing funds. Validation uses `getCurrency` (allowlist only); display and
arithmetic of stored amounts use `getPayPalCurrency` (any documented currency), so records made in a later-disabled
currency still render. Formatting is locale-aware (`formatMoney`).

**Conversion:** the Training Funds baseline is in USD (`src/content/trainingFunds.ts`). `src/lib/domain/exchange.ts`
converts it with fixed ECB euro reference rates (`src/content/exchangeRates.ts`: source URL, reference date
2026-11-06) using the cross rate X/EUR ÷ USD/EUR in BigInt arithmetic, half-up: starting funds to whole units of the
target currency, other amounts to its PayPal minor unit. No live FX API; nothing is presented as a market rate.

## 10. Fictional wallet lifecycle

```
Module unlocked → user presses "Start module N" (POST /api/modules/[key]/start)
   └─ start_module_run(currency = profile.preferred_currency,
                       starting_funds_minor = calculateStartingFunds(income bracket) in minor units)
      wallet_ledger: MODULE_START  +starting_funds        (balance = starting funds)  ← R20 reset
Scenario pay decision captured (Phase 5)
      record_training_payment(amount = scenarioAmountMinor(slot %, starting funds), idempotency key)
      wallet_ledger: PAYMENT −amount, classification 'pending' (balance_after recorded)
Attempt completed (Phase 6, complete_scenario_attempt)
      the attempt's PAYMENT is classified once: 'spending' (legitimate purchase) or 'fraud_loss' (scam)
Module completed (both scenarios' first attempts completed, same transaction)
      module_run.completed_at + closing_balance_minor frozen; historical ledger kept forever
Next module
      new module_run with its own MODULE_START (fresh balance). Previous runs untouched
Replay (practice attempt)
      may run a real Sandbox checkout (Phase 5) recorded on payment_transactions (is_practice) only;
      never charged to the ledger; the run (open or closed) is never touched
```

- Balance is the sum of the run's ledger entries. `balance_after` is stored for reporting and checked in tests.
- A payment can never push the balance below zero (domain check + `record_training_payment` + `balance_after ≥ 0`
  constraint). Percentages per module sum to ≤100% (tested).
- Duplicate deductions are impossible: unique idempotency key, one PAYMENT per attempt (partial unique index), and
  the run row is locked (`for update`) while a payment is written.
- Nothing about legitimacy exists in the database during play: payments stay `pending` until completion (R10).
- Changing preferred currency mid-module does not affect the open run. It applies to the next module run.

## 11. Certificates, reports, email

- **Certificate:** a DB row created at module completion (`certificate_code` is a random, non-guessable string). It is
  rendered on screen as an HTML component, with no PDF/download route (R25).
- **Zapier:** `POST ZAPIER_CERTIFICATE_WEBHOOK_URL` with
  `{secret, recipientEmail, displayName, moduleTitle, completedAt, certificateCode}`. The Zap verifies the shared
  secret and sends an HTML email built from those fields. It uses a 5s timeout with no automatic retry loop, and the user
  can press retry. Status is stored in `certificate_email_requests`. The email address is stored only for that request.
- **Report PDF:** `@react-pdf/renderer` in a Node-runtime route. Data is gathered from the DB only (attempts,
  evaluations, ledger, answer-key evidence titles). Brand fonts are embedded. The report is generated on demand and
  not stored.

## 12. Security and privacy

- Supabase RLS on every table: users can `select` only their own rows. Profile edits go through route handlers using
  the user's session (RLS + column grants).
- **Gameplay writes use a trusted writer (Phase 3 decision).** Module runs, attempts, ledger entries, scores, and
  completions are written only by `security definer` functions that are executable by `service_role` alone, called
  from server code via `src/lib/supabase/admin.ts` with the user id from the verified session. A browser holding the
  publishable key therefore cannot award itself points, complete scenarios, or move Training Funds (R32). Functions
  re-check ownership, unlock order, attempt state, and balances; triggers keep the ledger and scores append-only,
  decisions/justifications write-once, and COMPLETED reachable only through `complete_scenario_attempt`.
- `SUPABASE_SERVICE_ROLE_KEY` (legacy service-role JWT or new `sb_secret_…` key) is used only in server code and only
  for those gameplay writes. Without it, reads keep working and gameplay writes return a calm 503.
- Rate limits (simple DB-backed counters): chat, certificate email, attempt creation.
- No real credentials are ever requested. Simulation inputs are inert (R33). CSP restricts `frame-src` and
  `script-src` to self + PayPal SDK domains.
- Justification text is personal data. It is stored and shown only to its owner and is not logged.

## 13. Error handling and observability
- Typed `AppError` codes mapped to HTTP statuses.
- `console` structured logs server-side with no PII. Integration failures log `{integration, code, latency}`.
- The UI always offers a calm next action when a dependency fails (PRODUCT_SPEC §10).

## 14. Key risks
| Risk | Mitigation |
|---|---|
| Answer key leaks to client during play (R10) | Server-only files, results route gated on `COMPLETED`, payload snapshot tests |
| Gemini output contradicts the answer key or invents policy | Structured output, Zod, ID whitelisting, correctness guard, policy only from Playbook |
| Gemini latency during evaluation | 8–10s timeout + fallback; "Reviewing your reasoning…" state |
| PayPal Sandbox flakiness or popup blockers | Clear retry path; decision not committed until capture; E2E tests with Sandbox accounts |
| Sandbox currency support differs by account | Allowlist verified against Sandbox before release; USD default |
| Fake sites mistaken for real ones / misuse | Fictional brands, reserved TLDs, persistent "Training simulation" frame in chrome, inert inputs |
| Recovery policy changes | Source URL + "last verified" date per item, verification task before demo |
| Double-capture / race conditions | PayPal-Request-Id idempotency, DB unique constraints, single-transaction capture write |
| Scope creep from brand mockups (XP, streaks) | Explicitly out of scope (PRODUCT_SPEC §11) |

## 15. UI system (Phase 1)

- **Tokens:** `src/app/globals.css` `@theme` defines only teal / teal-shade / mist / yellow / yellow-shade / yellow-tint /
  white, the Nunito/Inter families, the brand type scale (`text-heading` 32/38, `text-subheading` 22/28, `text-body`
  16/24, `text-caption` 13/18, `text-button` 15), radii (`rounded-tile` 12, `rounded-button` 14, `rounded-card` 16,
  `rounded-panel` 24, `rounded-pill`), and 3D edges (`shadow-edge*`). Utilities `container-page`, `label-button`,
  `label-eyebrow`.
- **Primitives:** `src/components/ui/*` (Button, Card, Badge, IconTile, Input family, Modal/Dialog, ProgressBar,
  PageHeader, FeedbackBanner, EmptyState, Spinner/LoadingState, DemoNotice); brand: `components/brand/Logo`;
  icons: `components/icons/Icon` (2px outline, one optional yellow part).
- **Navigation:** `≥1024px` header nav; `<1024px` fixed bottom nav (5 items) + compact header. Footer links reach the
  Playbook from every page. `src/lib/navigation.test.ts` fails if a nav link has no page.
- **Focus:** global 3px teal `:focus-visible` outline; white inside `.on-dark` surfaces.
- **Class overrides:** `cn()` is `clsx` only. Do not pass a component a class that conflicts with its own base
  utilities; control visibility with a wrapper element.

## 16. Authentication and sessions (Phase 2 / Step 4)

- **Clients:** `@supabase/ssr` server client (`src/lib/supabase/server.ts`) bound to the request cookies, using the
  publishable key (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, falling back to `NEXT_PUBLIC_SUPABASE_ANON_KEY`). Every query
  runs as the signed-in user, so RLS applies. No browser Supabase client and no service-role key are used.
- **Middleware** (`src/middleware.ts`): refreshes the session cookie on every request (`getClaims`), then applies the
  pure rules in `src/lib/auth/routes.ts`: signed-out → `/sign-in?next=…` (with `notice=expired` when a stale auth
  cookie is present); signed-in but not onboarded → `/onboarding`; onboarded users leave `/onboarding` and the auth
  pages. If onboarding state can't be read, it does not redirect (the page shows a calm error) — rules are unit-tested
  to settle within one hop (no loops). API routes are never redirected; they return 401 JSON.
- **Second guard:** the `(app)` layout calls `requireUser()` (Supabase `getUser`, verified with the Auth server) and is
  `force-dynamic`; app pages call `requireOnboardedProfile()`. Private HTML is never rendered without a session; the
  existing `loading.tsx` covers the wait.
- **Email links:** sign-up confirmation and password reset land on `/auth/confirm`, which supports PKCE `code` and
  `token_hash` flows and only redirects to same-site paths (`safeNextPath`).
- **Errors:** `src/lib/auth/errors.ts` maps Supabase Auth codes to calm messages; `src/lib/api/server.ts` maps
  Postgres/PostgREST codes. Responses never include stack traces, SQL, or keys; logs carry error codes only (no
  emails, passwords, or bodies).

## 17. Progression, Training Funds, and scoring (Phase 3 / Step 5)

- **Config:** `src/content/modules.ts` (3 modules × 2 slots with official titles, badge names, payment basis
  points), `src/content/trainingFunds.ts` (income bracket → USD baseline, 3,000 default), and
  `src/content/exchangeRates.ts` (fixed reference rates). Change values there only; tests guard the
  structure and `progressionMigration.test.ts` guards the SQL copies of keys, states, and score ranges.
- **Domain (pure, tested):** `money.ts` → `trainingFunds.ts` → `wallet.ts`, `progression.ts`, `scoring.ts`, and
  `progress.ts`, which assembles the `ProgressSnapshot` used by `/api/progress` and every progress page.
- **Data access:** `src/lib/progress/server.ts` (reads via the session client, writes via the trusted writer),
  `src/lib/progress/current.ts` (cached per request for pages, with a calm `progress_unavailable` state).
- **Connection to the next phases:**
  - Phase 4 attempt creation: `planScenarioStart(snapshot.progression, key)` decides start/resume/replay, then
    `create_scenario_attempt`. The engine records verification and unsafe action IDs for scoring.
  - Phase 5 capture: amount = `scenarioAmountMinor(key, run.starting_funds_minor)` (also the PayPal order amount);
    for the scored attempt, `record_training_payment` with the PayPal-Request-Id as idempotency key inside the
    capture flow; for a replay, only the practice `payment_transactions` row (see §9).
  - Phase 6 completion: evaluator → `ReasoningAssessment` → `scoreScenario(rubric, behavior, assessment)` →
    `complete_scenario_attempt` (score + payment classification from the answer key + module completion, one
    transaction). Phase 9 hangs badge/certificate rows off the module completion.

### 17.1 Security and idempotency guarantees (verified in the Step 5 review)
- Browser roles (`anon`, `authenticated`) can only SELECT their own rows in the four gameplay tables. They cannot
  INSERT/UPDATE/DELETE them or EXECUTE any gameplay function (live-tested for both roles and all four functions).
- The secret key lives only in `src/lib/supabase/admin.ts` (`import "server-only"`), is never `NEXT_PUBLIC_`, is never
  logged, and is absent from the client bundle (checked after `next build`).
- Route handlers authenticate with `supabase.auth.getUser()` (verified by the Auth server), take the user id only from
  that session, require completed onboarding, and accept no amounts, currencies, scores, or user ids from the body.
- Unlock order is enforced three times: domain (`assertModuleUnlocked`), API (409), and `start_module_run` (database).
  A URL to a locked module renders the locked state; no data or action is exposed.
- Retries are safe: `start_module_run` and `complete_scenario_attempt` are idempotent; ledger payments are unique per
  idempotency key and per attempt; scores are unique per attempt and immutable (no UPDATE grant for anyone), so a
  repeat call can never add or overwrite points.
- Replays (practice attempts) cannot change official scores, progression, badges, the module run, or the ledger.

## 18. Immersive scenario engine (Phase 4 / Step 6)

- **Layers:** content (`src/content/scenarios/`) → pure domain (`scenarioStateMachine.ts`) → view/tokens
  (`src/lib/scenario/view.ts`, `tokens.ts`, pure) → service (`src/lib/scenario/server.ts`, server-only: RLS reads,
  trusted-writer RPCs) → routes → `ScenarioPlayer` + `src/components/scenario/sim/*`.
- **Environments:** `Workspace` hosts the apps (left dock at ≥1024px, an equal-width tab strip below; apps stay
  mounted so each keeps its place). Apps call `record(actionId)` (optimistic, queued in order, server-confirmed) and
  `decide(decisionId)`; they never call the API and never know what is correct.
- **No hints (R10):** identical styling for every element; neutral anchors; the explanation prompt depends only on
  the chosen intent; content tests deny judgment words in player-facing text and IDs; view tests check the
  serialized payload; the client bundle contains no scenario content (it arrives through the attempt view).
- **Safety (R28–R34):** `.example` domains only, fictional 555-01xx numbers, no input fields inside simulations,
  fictional TandemPay instead of any PayPal look-alike.
- **Performance:** an event request is three sequential round trips (auth, [profile ‖ attempt+run+events], RPC); the
  RPC returns the updated row, so the view is rebuilt without a second read.
