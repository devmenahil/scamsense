# ScamSense — Technical Architecture

Status: Phase 0 baseline. Read together with `CLAUDE.md` (rules), `PRODUCT_SPEC.md` (behavior), and `DATA_MODEL.md`.

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
| `/sign-up` | Public | Email/password + 18+ age bracket + confirmation (R2) |
| `/sign-in` | Public | Sign in |
| `/onboarding` | Auth, not onboarded | Profile + preferred currency (R3, R4) |
| `/dashboard` | App | Modules, progress, training funds, history, badges |
| `/modules/[moduleKey]` | App, unlocked | Module overview + its two scenarios |
| `/play/[attemptId]` | App, owner | **Immersive scenario**: intro → explore → decide → (pay) → justify |
| `/play/[attemptId]/results` | App, owner, attempt COMPLETED | Feedback, wallet impact, AI comment, **Reveal the Red Flags** |
| `/modules/[moduleKey]/complete` | App, module completed | Badge, certificate preview, email form, report download |
| `/playbook` (+ `/playbook/[section]`) | Public | Your Recovery Playbook (R21) |
| `/sensei` | App | Sensei Kenshi full-page chat (also a floating panel, Phase 11) |
| `/modules` | App | Index of the three modules with lock states (primary nav "Modules") |
| `/certificates` | App | Badges, certificate status, and report access per module (primary nav "Certificates") |
| `/profile` | App | "My Profile": view profile + preferred currency; edit via the onboarding form (replaces the earlier `/settings` name). Currency changes apply from the next module start |

`middleware.ts` refreshes the Supabase session and redirects unauthenticated users to `/sign-in` and
non-onboarded users to `/onboarding`. Authorization for specific resources (ownership, unlocks, attempt state) is
re-checked in server components and API routes. Middleware is never the only guard.

Scenario starts go through `POST /api/scenarios/[scenarioKey]/attempts`, which returns an `attemptId` (new or
resumable). The UI then navigates to `/play/[attemptId]`. Results are a separate route so they can never render
before completion.

## 5. API endpoints

All routes return JSON (except the PDF), validate input with Zod, call `requireUser()`, and check ownership.
The error shape is `{ error: { code, message } }`.

### Profile and progress
| Method & path | Body / params | Returns |
|---|---|---|
| `GET /api/profile` | — | Profile |
| `PUT /api/profile` | Profile fields (onboarding + edits) | Profile. Age bracket must be adult and the currency must be in the allowlist |
| `GET /api/config/currencies` | — | Supported currency list (from the server allowlist) |
| `GET /api/progress` | — | Modules with lock state, scenario statuses, current wallet, history, badges |

### Scenario attempts
| Method & path | Body | Returns / effect |
|---|---|---|
| `POST /api/scenarios/[scenarioKey]/attempts` | — | Creates an attempt (or returns the open one). Enforces module unlock and opens a module run (wallet reset) on the first scenario of a module. Runs personalization (Gemini or fallback) and returns `{attemptId}` |
| `GET /api/attempts/[id]` | — | Client-safe view: state, intro line, personalized **render** data, decision options, payable amount (if any). **Never the answer key** |
| `POST /api/attempts/[id]/events` | `{type: "START" \| "DECISION_SELECTED" \| "DECISION_CLEARED"}` | Applies a state-machine transition (§7) |
| `POST /api/attempts/[id]/decision` | `{decisionId}` | Commits a non-payment decision → `AWAITING_JUSTIFICATION`. Pay decisions are rejected here: they commit only via capture |
| `POST /api/attempts/[id]/justification` | `{text}` (20–1000 chars) | Locks justification → `EVALUATING`, runs evaluation synchronously (timeout → fallback), then `COMPLETED`. Returns `{status}` |
| `GET /api/attempts/[id]/results` | — | Only when `COMPLETED`: decision outcome, wallet impact, evaluation, safest next step, full evidence list with classifications for Reveal mode |

### PayPal Sandbox
| Method & path | Body | Effect |
|---|---|---|
| `POST /api/paypal/orders` | `{attemptId, decisionId}` | Validates that the attempt state allows payment and that the decision is payable. **Server computes the amount and currency.** Creates an Orders v2 order (`intent: CAPTURE`) and stores a `payment_transactions` row → returns `{orderId}` |
| `POST /api/paypal/orders/[orderId]/capture` | — | Captures the order. On `COMPLETED`, atomically records the capture, debits the wallet, and commits the pay decision → `AWAITING_JUSTIFICATION` |
| `POST /api/paypal/orders/[orderId]/cancel` | — | Marks the order as cancelled (user closed the popup) → attempt returns to `EXPLORING` |

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

## 6. Scenario content model

Content is typed TypeScript data validated by Zod schemas in tests. Each scenario is split into two files so the
answer key cannot leak by accident:

**`render.ts` (client-safe)**
- `key`, `moduleKey`, `contentVersion`, `introLine` (neutral, R9)
- `environment`: a tree of typed screens (email list/message, chat thread, fake browser page with address bar,
  invoice, marketplace listing, payment request). Elements that may be evidence carry a stable `anchorId`. Anchors are
  neutral identifiers (e.g., `email.sender`, `page.url`) and are rendered as `data-anchor` attributes with **no
  styling difference**.
- `personalizationSlots`: named text slots with authored defaults and constraints (max length, purpose), e.g.,
  `buyerName`, `itemName`, `employerName`, `amountContext`.
- `decisions`: `[{id, kind: "pay" | "other", trigger}]`, where `trigger` binds each decision to an **environment-native
  action** (a button or control inside the simulated tool, such as an invoice "Pay now", a seller dashboard "Ship
  item", or a chat "Block & report"). Decisions are never shown as a multiple-choice list. Labels are neutral.

**`answer-key.server.ts` (server-only)**
- `correctDecisionIds` (one or more acceptable), plus per-decision outcome text
- `legitimacy`: `"scam" | "legitimate"`
- `evidence`: `[{id, anchorId, classification: "red_flag" | "verify" | "positive", title, explanation, keywords[],
  weight}]`
- `payable`: `{decisionId → percentOfModuleFunds}` (basis points, integer)
- `safestNextStep`, `keyLessons[]`, `playbookLinks[]`, `fallbackFeedback` texts

Content tests assert: every `anchorId` exists in render; render text contains no judgment words from a deny-list (e.g.,
"scam", "suspicious", "red flag", "fake", "warning"), except where those words are part of the fiction itself and
are explicitly allowed; all fraudulent domains use reserved TLDs (`.example`, `.test`, `.invalid`); and ≥1 scenario
across the catalogue is `legitimate` (R17).

## 7. Scenario state machine

Implemented as a pure reducer in `src/lib/domain/stateMachine.ts`, persisted in `scenario_attempts.state`, and
re-validated on every API call. Illegal transitions return `409`.

```
              START                     DECISION_SELECTED(non-pay)
 INTRO ───────────────▶ EXPLORING ───────────────────────────▶ AWAITING_JUSTIFICATION
                          ▲   │                                         │
       PAYMENT_CANCELLED/ │   │ DECISION_SELECTED(pay)                   │ JUSTIFICATION_SUBMITTED
       PAYMENT_FAILED     │   ▼                                         ▼
                        PAYMENT_PENDING ── PAYMENT_CAPTURED ──▶ (AWAITING_JUSTIFICATION)
                                                                        │
                                                                   EVALUATING
                                                                        │ EVALUATION_DONE (AI or fallback)
                                                                        ▼
                                                                    COMPLETED ──▶ (results + Reveal unlocked)
```

| State | Meaning | Client may see | Allowed events |
|---|---|---|---|
| `INTRO` | Attempt created, neutral intro shown | intro line | `START` |
| `EXPLORING` | User interacting with the environment | render data, decision options | `DECISION_SELECTED` |
| `PAYMENT_PENDING` | Pay decision chosen, Sandbox order created | + amount/currency | `PAYMENT_CAPTURED`, `PAYMENT_CANCELLED`, `PAYMENT_FAILED` |
| `AWAITING_JUSTIFICATION` | Decision committed and locked | + chosen decision | `JUSTIFICATION_SUBMITTED` |
| `EVALUATING` | Justification locked, evaluation running | "Reviewing your reasoning…" | `EVALUATION_DONE` |
| `COMPLETED` | Final | results + evidence (Reveal) | — |

Invariants:
- Decision and justification are immutable once committed (R11).
- A pay decision is committed **only** by a successful Sandbox capture (R12). Cancelling or failing returns the user to
  `EXPLORING`, and the wallet is untouched.
- `EVALUATING` always reaches `COMPLETED`. Evaluation retries Gemini once and then uses the deterministic fallback.
  A stuck `EVALUATING` attempt is re-evaluated idempotently on the next `GET`.
- Nothing from the answer key is serialized for any state except `COMPLETED` (R10, R15).
- Module progression is recomputed from `COMPLETED` attempts. It is never stored as a counter that could drift.

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

### 8.4 Scoring (deterministic)
- `decisionCorrect`: boolean from the answer key.
- `reasoningCoverage` = Σ weight(addressed evidence) / Σ weight(all evidence), 0–100.
- The displayed outcome is qualitative ("Nice catch!" / "Look again"), driven by `decisionCorrect`, with coverage
  shown as "You spotted N of M key clues." No numeric grade beyond this unless requested later.

### 8.5 Fallback evaluation
Case-insensitive keyword/phrase matching of the justification against each evidence item's `keywords`, followed by
authored `fallbackFeedback[correct|incorrect]` and a fixed encouraging line instead of humor. The UI shows a subtle
"Detailed AI feedback is unavailable right now" note.

## 9. PayPal Sandbox transaction lifecycle

Safety guard: `paypal.ts` asserts `PAYPAL_ENV === "sandbox"` and `PAYPAL_API_BASE === "https://api-m.sandbox.paypal.com"`
at module load. Otherwise it throws (R28). The JS SDK is loaded with the Sandbox client ID only.

```
User clicks in-simulation "Pay" → selects pay decision
  │
  ▼ PayPal Buttons createOrder()
POST /api/paypal/orders {attemptId, decisionId}
  • verify attempt EXPLORING & decision payable
  • amount = round(module_run.starting_funds_minor × bp / 10000)  (currency = module_run.currency)
  • OAuth client-credentials token (cached in memory until expiry)
  • POST /v2/checkout/orders {intent: CAPTURE, purchase_units:[{amount, description:"ScamSense training (Sandbox)",
    custom_id: attemptId}]}  with PayPal-Request-Id = idempotency key
  • insert payment_transactions(status=CREATED); attempt → PAYMENT_PENDING
  ▼
User approves in PayPal Sandbox popup (Sandbox personal test account)
  ▼ onApprove()
POST /api/paypal/orders/{orderId}/capture
  • verify ownership + attempt PAYMENT_PENDING + order belongs to attempt
  • POST /v2/checkout/orders/{id}/capture (idempotent request id)
  • on capture status COMPLETED, verify amount & currency equal the stored values, then in ONE DB transaction:
      payment_transactions → CAPTURED (capture_id, paypal_status)
      wallet_ledger += PAYMENT debit
      attempt.decision = pay decision; state → AWAITING_JUSTIFICATION
  • on DECLINED/other → FAILED; attempt → EXPLORING (user may retry or decide otherwise)
onCancel() → POST .../cancel → CANCELLED; attempt → EXPLORING
onError()  → FAILED; friendly message; attempt → EXPLORING
```

`payment_transactions.status`: `CREATED → CAPTURED | CANCELLED | FAILED`. Captured Sandbox payments are never refunded
by the app (no refund feature, R30). Scenario outcome text describes consequences only within the fiction.

**Currency:** The JS SDK `currency` parameter must equal the module run's currency. The allowlist
(`src/lib/domain/currency.ts`) holds `{code, minorUnitDigits}` and is transcribed from PayPal's official currency-codes
documentation. It is limited to currencies verified to work in Sandbox Checkout for our account setup, with USD
always present and default. Currencies with zero decimals are handled by `minorUnitDigits`.

## 10. Fictional wallet lifecycle

```
Module unlocked → user starts first scenario of the module
   └─ create module_run(currency = profile.preferred_currency, starting_funds_minor = config × 10^digits)
      wallet_ledger: MODULE_START  +starting_funds        (balance = starting funds)  ← R20 reset
Scenario pay decision captured
      wallet_ledger: PAYMENT       −amount                (balance_after recorded)
Legitimate purchase completed (the item is received in the story)
      no balance change beyond the payment. The debrief marks it as a successful purchase (authored)
Module completed
      module_run.closing_balance_minor frozen; historical ledger kept forever
Next module
      new module_run with its own MODULE_START (fresh balance). Previous runs untouched
```

- Balance is the sum of the run's ledger entries. `balance_after` is stored for reporting and checked in tests.
- A payment can never push the balance below zero. Percentages are authored so the sum in a module is ≤100%, and the
  server re-checks.
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

- Supabase RLS on every table: users can `select` only their own rows. All writes go through route handlers using
  the user's session (RLS-enforced) or, for multi-table transactions, a Postgres function (`security definer`) that
  re-checks `auth.uid()`.
- `SUPABASE_SERVICE_ROLE_KEY` is used only in server code and only where documented.
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
