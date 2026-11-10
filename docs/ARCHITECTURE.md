# ScamSense — Technical Architecture

Status: updated for Step 9 (Reveal the Red Flags + Your Recovery Playbook; §20). Earlier: Step 8 hybrid intelligence (§19). Read together with `CLAUDE.md` (rules), `PRODUCT_SPEC.md` (behavior), and `DATA_MODEL.md`.

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
| Payments | Official PayPal JavaScript SDK **v6** (`https://www.sandbox.paypal.com/web-sdk/v6/core`, loaded on the checkout step; client-ID auth) + server `fetch` to Orders v2 | PayPal's current recommended web integration (Step 7 review of developer.paypal.com). No npm dependency, no server SDK. |
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
| `/play/[attemptId]/results` | App, owner, attempt COMPLETED | Feedback, wallet impact, AI comment, debrief navigation |
| `/play/[attemptId]/review` | App, owner, attempt COMPLETED | *(Step 9)* **Reveal the Red Flags**: read-only environment + numbered evidence markers (§20.1) |
| `/play/[attemptId]/playbook` | App, owner, attempt COMPLETED | *(Step 9)* **Your Recovery Playbook** for this attempt (§20.2) |
| `/modules/[moduleKey]/complete` | App, module completed | Badge, certificate preview, email form, report download |
| `/playbook` | Public | Your Recovery Playbook: the verified U.S. PayPal knowledge base by topic (R21, Step 9) |
| `/sensei` | App | *(Step 10)* Sensei Kenshi full-page chat. The same chat opens as a side panel from the dashboard and from the debrief pages of a COMPLETED attempt; never on `/play/[attemptId]` (§21) |
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
| `POST /api/modules/[moduleKey]/start` | — (no body) | Opens the module's Training Funds period: server computes currency + amount from the saved profile, checks the unlock, calls `start_module_run`. **Step 8:** then fixes the routed scenario order once (`ensureModuleOrder`; the only place routing may call Gemini). 201 new, 200 already started (idempotent), 409 locked, 404 unknown |

### Scenario attempts (Step 6, implemented)
| Method & path | Body | Returns / effect |
|---|---|---|
| `POST /api/scenarios/[scenarioKey]/attempts` | — | `planScenarioStart` + `create_scenario_attempt`: 201 `{attemptId, kind: "new" \| "replay"}`, 200 `{kind: "resume"}`. 409 `module_locked` / `module_not_started`, 404 unknown |
| `GET /api/attempts/[id]` | — | `{attempt: ClientAttemptView}` (`src/lib/scenario/view.ts`): state, intro line, token-filled render, recorded action IDs, pending/locked decision, own locked explanation, `checkout` while a pay decision is in a payment state (amount text, currency, fictional payee, sequence, `available`, `openOrder`, `lastClosed`), `payment` once a Sandbox capture is verified (amount, order id, capture id; never its spending/scam meaning), `isPractice`. **Never the answer key.** Foreign/unknown → 404 |
| `POST /api/attempts/[id]/events` | `{type}`: START · RECORD_ACTION{actionId} · SELECT_DECISION{decisionId} · CLEAR_DECISION · CONFIRM_DECISION · RETRY_PAYMENT · FINALIZE (strict; PAYMENT_CANCELLED moved to `/checkout/cancel` in Step 7) | Pure `transition()` decides, `apply_attempt_event` re-checks and records. Server-only events are rejected (400). Illegal → 409, unknown IDs → 400. Returns the new view |
| `POST /api/attempts/[id]/justification` | `{text}` (20–1000 after trimming) | Locks the explanation → `PAYMENT_PENDING` (pay) or `FINALIZED`. Returns the new view |
| `GET /api/attempts/[id]/evaluation` | — | *(Step 8)* Stored evaluation status: `not_ready` · `pending` · `failed {basicAvailable, geminiAvailable}` · `complete {results}` (results only once COMPLETED). Never calls Gemini |
| `POST /api/attempts/[id]/evaluation` | `{mode?: "ai" \| "basic"}` (strict) | *(Step 8)* Evaluates a FINALIZED attempt once (claim → one Gemini call → backend score → `record_attempt_evaluation`). Duplicate-safe (`pending` for a concurrent call, stored result once complete). `basic` only after a real failure (409 otherwise). 409 `not_finalized` |
| `GET /api/dev/gemini-usage` | — | *(Step 8)* Development-only usage counters (404 in production) |
| `POST /api/attempts/[id]/playbook` | — (no body) | *(Step 9)* The attempt's personal Recovery Playbook note: `ready` (gemini note or fallback) · `pending` · `unavailable`. Owner + COMPLETED only (409 `not_completed`, 404 foreign). At most ONE Gemini call per attempt (DB claim); never returns policy content |

### PayPal Sandbox checkout (Step 7, implemented; attempt-scoped so ownership is checked like every attempt route)
| Method & path | Body | Effect |
|---|---|---|
| `POST /api/attempts/[id]/checkout/order` | — | Requires `PAYMENT_PENDING` with a payable locked decision. **Server computes amount and currency.** Reuses the open order of this checkout or creates an Orders v2 order (`intent: CAPTURE`, `custom_id` = attempt id, idempotent `PayPal-Request-Id`) and stores it → `{orderId}`. 409 when not payable/already paid/cancelled, 422 unsupported currency, 503 PayPal unavailable |
| `POST /api/attempts/[id]/checkout/capture` | `{orderId}` (strict, `^[A-Z0-9]{1,64}$`) | The order must be this attempt's own (else 404). Reads the order, captures an approved one once, verifies, and records: `{attempt, outcome: "captured" \| "pending" \| "failed"}`. 409 `not_approved` / `checkout_closed` |
| `POST /api/attempts/[id]/checkout/sync` | — | Reconciliation after refresh/interruption/pending: same as capture for the open order; `awaiting_approval` when the buyer hasn't approved |
| `POST /api/attempts/[id]/checkout/cancel` | — | Checks PayPal, then closes the open order (`CANCELLED`) → `PAYMENT_CANCELLED`; with no order, records the cancellation. Refuses to cancel an approved or processing payment |

`PAYMENT_CANCELLED` is no longer accepted by `/events` (400): cancellations must go through the payment service.

### Completion, certificates, reports (Step 11, implemented)
| Method & path | Effect |
|---|---|
| `GET /api/modules/[moduleKey]/report` | Session user; own module must be COMPLETED (409 `module_not_completed`), unknown module 404. Streams the analysis-report PDF (`Content-Disposition: attachment; filename="ScamSense-Analysis-Report-Module-N-<Title>-<YYYY-MM-DD>.pdf"`, `Cache-Control: private, no-store`). Stored data only: no Gemini, no writes, independent of Zapier. Node runtime |
| `GET /api/certificates/[moduleKey]` | Session user; own certificate data for the on-screen preview + badge + latest email status. No file and no URL (R25). 409 until the module is complete |
| `POST /api/certificates/[moduleKey]/email` | `{email, requestId (uuid)}` strict. Deduplicates (idempotency key, in-flight, same address < 30 s), rate-limits (5/certificate/hour, 15/user/hour, 429), renders/stores the PDF privately, posts ONE request to the Zapier Catch Hook (8 s timeout, no retry loop). Returns `{outcome, email: {status, maskedEmail, requestedAt, errorCode}}`; `status` is `submitted` (Zapier accepted), `processing`, or `failed` (retryable). Never returns the signed URL |

### Sensei Kenshi
| Method & path | Body | Effect |
|---|---|---|
| `POST /api/chat` | `{message (1–500), history? (≤12 turns, untrusted), attemptId?}` | *(Step 10, implemented)* Session user only; `attemptId` must be the caller's own (404) COMPLETED (409 `attempt_not_completed`) attempt. Builds the grounded prompt (§8.3, §21) and makes ONE structured-JSON Gemini call. Returns `{reply, sources[], followUps[], context}`; 503 `kenshi_unavailable` / 429 `kenshi_busy` are friendly and retryable (no fabricated reply). Nothing is stored |

Decision (Step 10): no streaming and no `GET /api/chat/history`. Replies are short, structured JSON is validated
before display (streaming would show unvalidated text), and conversations are not persisted (the brief asks for no
chat memory system), so the `chat_messages` table is not created.

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
PAYMENT_PENDING ─PAYMENT_CAPTURED*→ PAYMENT_COMPLETED ─FINALIZE*→ FINALIZED   (one DB transaction, Step 7)
PAYMENT_PENDING ─PAYMENT_CANCELLED* / PAYMENT_FAILED*→ PAYMENT_CANCELLED ─RETRY_PAYMENT→ PAYMENT_PENDING
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
| Recovery Playbook facts | **Authored + verified** (never AI): `src/content/playbook/policies.ts` | R21, R30 |
| Scenario → policy selection, Playbook steps, limitations | **Deterministic** (`src/lib/recovery/playbook.ts`) | Step 9 |
| Recovery Playbook personal note + step emphasis | Gemini, no policy vocabulary allowed; fallback = authored Playbook only | Step 9 |
| Evidence shown in Reveal the Red Flags | **Deterministic** (answer key + anchors) | Gemini never adds evidence |
| Scenario order within a module | **Deterministic** formula (§19.2); Gemini may only map custom text to approved tags | Write-once per (user, module) |
| Scenario surface personalization | Gemini → validated narrative slots + neutral intro, fallback = authored defaults | Never changes evidence, answers, setting, or amounts |
| Which evidence the user's reasoning addressed | Gemini proposes, validated against known IDs; fallback (after a failure, learner's choice) = keyword match | AI judges *reasoning coverage*, not truth |
| Personalized factual feedback paragraph | Gemini, grounded on the answer key; fallback = authored text | R14 |
| Short humorous comment (separate field) | Gemini; fallback = neutral encouraging line from a fixed pool | R14 |
| Chat answers | Gemini, scope-limited and grounded | R22 |

### 8.2 Gemini call contracts (implemented in Step 8; see §19 for details)
All calls go through `src/lib/ai/gemini.ts` (official `@google/genai` SDK, `responseJsonSchema` structured output,
Zod re-validation, deadline + bounded retries, rate limiting, usage counters). Model = `GEMINI_MODEL` only.
1. **Classify custom profile text** (`src/lib/routing/classifier.ts`, routing only, at module start, cached by
   fingerprint). In: custom occupation/activity text (fenced), predefined labels, tag vocabulary. Out:
   `{mappedActivityTags, mappedContextTags, contextSummary, unmappedDescriptions, interpretationStatus,
   shortExplanation}`; unknown tags, vulnerability claims, echoed instructions → rejected.
2. **Personalize scenario** (`src/lib/personalization/`, once per scenario per learner at first play). In: the scenario's
   neutral setting, its authoritative intro facts and personalization hint, its declared slots, sanitized profile.
   Out: `{scenarioId, introLine, slots}`; intro checked by `src/lib/personalization/intro.ts`; per-slot validation, fallback
   per slot / whole instance.
3. **Evaluate reasoning + humor** (`src/lib/evaluation/`, ONE call per finalized attempt). In: answer-key concepts and
   evidence, deterministic correctness, actions, explanation (fenced), verified payment outcome, story details, minimal
   profile. Out: `{scenarioId, decisionAssessment, recognizedEvidenceIds, missedEvidenceIds, unsupportedAssumptions,
   reasoningExplanation, verificationFeedback, paymentBehaviorFeedback, improvementAdvice, educationalTakeaway,
   humorousComment, evaluationConfidence}`; IDs whitelisted, correctness guard, policy/statistics/points/link/mocking
   guards. No points field exists.
4. **Recovery Playbook note** (`src/lib/recovery/`, Step 9, ONE call per completed attempt, category `recovery`, 15 s
   deadline). In: outcome, decision correctness, Sandbox paid yes/no, lesson, Playbook step ids+texts, verified facts as
   read-only context; no profile, explanation, or amounts. Out: `{scenarioId, note, emphasisStepIds}`; rejected if the
   note mentions PayPal, protection, dispute, refund, eligibility, coverage, timeframes, digits, links, statistics.
5. **Chat** (`src/lib/kenshi/`, Step 10, ONE call per learner question, category `chat`, 20 s deadline, rate key
   `chat:<userId>` so chat has its own per-user budget). In: the authorized context (§21), retrieved policy records,
   ≤6 earlier turns and the question (fenced). Out: `{reply, citedPolicyIds, followUps}`; reply guards in §21.

Prompt versions are stored with each personalization and evaluation row.

### 8.3 Sensei Kenshi grounding (implemented in Step 10; details in §21)
System prompt (`KENSHI_SYSTEM`): identity (calm mentor, subtle samurai flavour, "practice, not panic"), scope (scams,
safe payments, completed scenarios, U.S. PayPal reporting/disputes/protection), not PayPal or an adviser, never
requests credentials, answer protection, grounding order (truth / actions / explanation / stored feedback / score),
PayPal facts only from the given verified records, no deadlines/statistics/guarantees/links. The context includes:
- No profile data (not needed; privacy).
- **Only completed** attempts. Unfinished scenarios: title only, with "you know nothing else about them".
- Policy records from the Step 9 knowledge base retrieved for this question; links are attached by the server.

Off-topic requests get a polite redirect. No classifier is used (R23).

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

### 8.5 Fallback evaluation (implemented, `src/lib/evaluation/fallback.ts`)
Offered only after a real Gemini failure (or when Gemini isn't configured) and only when the learner chooses "Continue
with basic feedback". Whole-word keyword/phrase matching of the justification against each evidence item's `keywords`,
authored `feedbackCorrect|feedbackIncorrect`, `safestNextStep`, `keyLessons`, and a fixed encouragement line instead of
humor. Stored with `source = 'fallback'` and labelled "Basic feedback" on the results page.

## 9. PayPal Sandbox transaction lifecycle (Step 7, implemented)

**Sandbox guards (R28, R31):** the env schema rejects `PAYPAL_ENV ≠ sandbox` and any `PAYPAL_API_BASE` other than
`https://api-m.sandbox.paypal.com`; `src/instrumentation.ts` validates it when the server starts; `paypal.ts`
re-asserts the Sandbox host when the client is built; the browser SDK URL is the constant
`https://www.sandbox.paypal.com/web-sdk/v6/core`; and `payment_transactions.environment` is checked `= 'sandbox'`.

**Layers:** `src/lib/payments/checkout.ts` (pure, unit-tested: checkout request, idempotency keys, PayPal amount
strings, order parsing, `decideSettlement`, `verifyCapture`, wallet effect) → `paypal.ts` (server-only Orders v2
client: OAuth client-credentials token cached until a minute before expiry, refreshed once on 401, 15s timeouts,
`Prefer: return=representation`, operational logs without tokens or payer data) → `server.ts` (payment service) →
routes `app/api/attempts/[attemptId]/checkout/*` → `CheckoutPanel` (official JS SDK v6 via `paypalSdk.ts`, no npm
package). **Payable** = the render's authored `kind: "pay"` decisions (M2-S1 `pay_invoice`, M2-S2 `place_order`,
M3-S1 `pay_fee`); M1-S1, M1-S2, and M3-S2 have none, so they never show a checkout.

```
Pay decision confirmed → explanation locked → PAYMENT_PENDING (checkout panel; PayPal button)
  │ click: session.start({presentationMode:"auto"}, createOrderPromise)   ← popup opens inside the click
  ▼
POST /api/attempts/{id}/checkout/order                (no body; amount never comes from the browser)
  • auth + owner (RLS) · buildCheckoutRequest: PAYMENT_PENDING, payable decision, enabled currency, amount > 0
  • an open CREATED order for this checkout is reused (GET order: still awaiting approval) → same orderId
  • else Orders v2 create {intent CAPTURE, custom_id = attemptId, amount = server value}
    with PayPal-Request-Id = scamsense-{attemptId}-checkout-{sequence}
  • record_payment_order(): re-derives sequence, amount (bp × run funds, half-up) and currency in SQL; checks
    remaining Training Funds (scored), no open/captured order → payment_transactions CREATED
  ▼
Buyer approves in PayPal's own Sandbox window (Sandbox Personal account)
  ▼ onApprove({orderId})  — not proof of payment
POST /api/attempts/{id}/checkout/capture {orderId}     (the order must be this attempt's own row, else 404)
  • GET order → decideSettlement:
      APPROVED                → capture once (PayPal-Request-Id = {key}-capture); ORDER_ALREADY_CAPTURED → GET again
      capture COMPLETED + exact amount/currency/order/custom_id → record_payment_capture() in ONE transaction:
          row CAPTURED (capture id unique) · scored attempt: record_training_payment (idempotency key = request id)
          · attempt PAYMENT_CAPTURED → PAYMENT_COMPLETED, FINALIZE → FINALIZED
      capture PENDING         → row PENDING; attempt stays PAYMENT_PENDING; no wallet change ("Check again")
      DECLINED/FAILED/VOIDED/422 decline/unverifiable → row FAILED → PAYMENT_FAILED → PAYMENT_CANCELLED
      CREATED (not approved)  → 409 not_approved
onCancel / "Cancel checkout" → POST …/checkout/cancel: GET order first; awaiting approval → row CANCELLED →
  PAYMENT_CANCELLED; approved → refused (sync instead); captured → recorded as captured (a cancel never hides a payment)
Page load with an open order / lost response → POST …/checkout/sync: same as capture, but "not approved" is a quiet
  `awaiting_approval`. Network errors, timeouts, 5xx and 409 in-progress mean "unknown" → 503 "check again"; the next
  sync reads the order again, so a verified capture that failed to save is recorded later, never charged twice.
PAYMENT_CANCELLED → RETRY_PAYMENT (new sequence → new key → new order) or FINALIZE (finish without paying)
```

`payment_transactions.status`: `CREATED → CAPTURED | PENDING | CANCELLED | FAILED`, `PENDING → CAPTURED | CANCELLED |
FAILED`; CANCELLED/FAILED are final, CAPTURED only gains its outcome classification once (trigger). Captured Sandbox
payments are never refunded by the app (no refund feature, R30).

**Training Funds vs Sandbox money.** The PayPal capture is a Sandbox transaction (test money) and its status is
stored separately (`paypal_order_status`, `paypal_capture_status`, `status`). The fictional wallet effect is separate:
a scored attempt's verified capture debits the official ledger once; a replay's never does. Whether that money was
**ordinary spending** (M2-S2) or a **fictional scam loss** (M2-S1, M3-S1) is fixed by the answer key
(`paymentOutcome`) but written only at completion (`complete_scenario_attempt` classifies the ledger entry and the
payment row), because every table is readable by its owner and nothing may reveal legitimacy during play (R10). A
completed Sandbox capture says nothing about PayPal judging fraud or Purchase Protection eligibility.

**Idempotency and integrity (defence in depth):** PayPal-Request-Id per (attempt, checkout sequence) for create and a
derived one for capture; GET-before-capture reconciliation; DB uniques on `request_id`, `paypal_order_id`,
`paypal_capture_id`, (`attempt_id`, `checkout_sequence`), one CAPTURED and one open row per attempt; ledger unique per
idempotency key and per attempt; row locks on attempt + run; `apply_attempt_event`'s expected-state check. A
concurrent duplicate create that loses the race is answered with the stored order (PayPal may briefly return two
Sandbox orders for one request id; only the stored one can ever be approved through ScamSense, the other expires).
The UI also blocks repeated clicks, but nothing depends on that.

**Replays:** the same flow on the replay's own attempt id, so the key, the order, and the capture are always new;
`is_practice = true`; no ledger entry (`record_payment_capture` skips it and `record_training_payment` rejects
replays as a backstop); classified at the replay's completion for its own debrief.

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
Scenario pay decision captured (Step 7: verified Sandbox capture, inside record_payment_capture)
      record_training_payment(amount = scenarioAmountMinor(slot %, starting funds), idempotency key = PayPal-Request-Id)
      wallet_ledger: PAYMENT −amount, classification 'pending' (balance_after recorded)
Attempt completed (Phase 6, complete_scenario_attempt)
      the attempt's PAYMENT is classified once: 'spending' (legitimate purchase) or 'fraud_loss' (scam)
Module completed (both scenarios' first attempts completed, same transaction)
      module_run.completed_at + closing_balance_minor frozen; historical ledger kept forever
Next module
      new module_run with its own MODULE_START (fresh balance). Previous runs untouched
Replay (practice attempt)
      may run a real Sandbox checkout (Step 7) recorded on payment_transactions (is_practice) only;
      never charged to the ledger; the run (open or closed) is never touched
```

- Balance is the sum of the run's ledger entries. `balance_after` is stored for reporting and checked in tests.
- A payment can never push the balance below zero (domain check + `record_training_payment` + `balance_after ≥ 0`
  constraint). Percentages per module sum to ≤100% (tested).
- Duplicate deductions are impossible: unique idempotency key, one PAYMENT per attempt (partial unique index), and
  the run row is locked (`for update`) while a payment is written.
- Nothing about legitimacy exists in the database during play: payments stay `pending` until completion (R10).
- Changing preferred currency mid-module does not affect the open run. It applies to the next module run.

## 11. Certificates, reports, email (Step 11)

### 11.1 Module completion and rewards
- `complete_scenario_attempt` (unchanged) sets `module_runs.completed_at` + closing balance exactly once, when both
  ORIGINAL attempts of the run are COMPLETED (a replay never completes a run).
- `20261115090000_module_rewards.sql` adds an AFTER UPDATE trigger on that null to not-null transition that calls
  `award_module_rewards(run)`: one `badges` row (badge key per module, `module_score` = sum of the two original
  attempts' immutable `scenario_scores`, max 200, `awarded_at` = run completion) and one `certificates` row (random
  48-bit code `SS<n>-XXXX-XXXX-XXXX`, `recipient_name` = display-name snapshot, `module_title` snapshot,
  `completed_at` = run completion). Inserts use `on conflict do nothing`; both tables are unique per run and per
  user+module, the code is unique, and update triggers make both rows final. Runs completed earlier are backfilled by
  the migration. `ensure_module_rewards(user, module)` (service_role) is a no-op repair path used only if a completed
  run has no certificate.
- Next-module unlock stays derived from `module_runs.completed_at` (unchanged). Dashboard, profile, and certificates
  read `badges` through RLS and fall back to completed runs if the table is unavailable (same moment by construction).

### 11.2 Certificate and report PDFs
- `@react-pdf/renderer` (Node runtime; `serverExternalPackages`), brand tokens in `src/lib/pdf/theme.ts`, embedded
  Nunito + Inter (latin + latin-ext fallback, OFL) from `src/assets/fonts`, included in deployments via
  `outputFileTracingIncludes`.
- **Certificate:** `CertificatePreview` (HTML) and `CertificateDocument` (PDF, US Letter landscape) render the same
  `CertificateView` (dates formatted in UTC so both always agree). There is no certificate download route (R25). The
  PDF is rendered once per certificate and design version, stored at
  `certificate-pdfs/<certificate uuid>/v1/ScamSense-Certificate-<Title>-<ID>.pdf` in a PRIVATE bucket (no storage
  policies for browser roles), and shared only with Zapier as a signed URL (24 h, `download=` file name,
  `application/pdf`). The signed URL is never sent to the browser.
- **Report:** `src/lib/report/build.ts` (pure) + `server.ts` (session-client reads, explicit user filter). Original
  attempts only: scores, decision, justification excerpt (up to 320 characters), stored feedback summary,
  recognized and missed (core first) evidence, unsupported assumptions, verification actions done / not done
  (authored labels), payment meaning, improvement advice and takeaway (stored evaluation; the humorous comment is
  excluded), Training Funds start/end/spending/scam losses with a "fictional, Sandbox only" notice, key lessons
  (answer key), and official references (Step 9 policy mapping + answer-key references). Missing data is stated,
  never guessed.

### 11.3 Certificate email through the existing Zap
The Zap already exists and is not rebuilt: **Webhooks by Zapier, Catch Hook**, then **Gmail, Send Email** (sender
`scamsense.certificates@gmail.com`), mapping `recipientEmail`, `displayName`, `moduleTitle`.

Payload (explicit allowlist, `src/lib/rewards/zapier.ts`): `recipientEmail`, `displayName`, `moduleTitle`,
`certificateId`, `completionDate`, `certificatePdfUrl`. Nothing else (no income, profile details, justifications,
Training Funds, PayPal data, credentials, or keys). `ZAPIER_WEBHOOK_SECRET` is not sent or required: a Catch Hook
cannot verify it without an added Filter step, and sending it would copy it into Zapier's task history. The
server-only webhook URL is the access control.

Flow: session user, then certificate ownership (RLS + user filter), then `begin_certificate_email_request` (row
PROCESSING; `existing` / `in_flight` / `duplicate` / `rate_limited` short-circuit without sending), then the signed PDF
URL, then one POST, then `finish_certificate_email_request` (SUBMITTED on 2xx, else FAILED with `http_error` /
`timeout` / `network` / `not_configured`; `pdf_unavailable` skips Zapier so an email is never sent without its
attachment). A PROCESSING row older than 2 minutes counts as failed (`abandoned`). Statuses shown: not submitted,
processing, "Your certificate email request has been submitted." (accepted by Zapier, **not** a delivery
confirmation; none exists), failed (calm message + retry). Badges, certificates, and reports never depend on Zapier
(R27).

**One-time Gmail attachment mapping** (the only Zap change):
1. zapier.com, **Zaps**, open the existing certificate Zap, **Edit**.
2. After sending one certificate email from ScamSense (Step 11 migration applied), open trigger step 1 (Catch Hook),
   **Test**, **Find new records**, and select the newest record, so the sample includes `certificateId`,
   `completionDate`, and `certificatePdfUrl`.
3. Open step 2, **Gmail: Send Email**, **Configure**. Leave the To / Subject / Body mappings as they are (optionally
   add *Certificate Id* and *Completion Date* to the body).
4. Scroll to **Attachments**, click the field, choose **1. Catch Hook** in the data picker, and select
   **Certificate Pdf Url**. Zapier downloads the file from that URL and attaches it as `ScamSense-Certificate-...pdf`.
5. **Continue**, **Test step**. Open the received email and check that the PDF opens and shows the right name, module,
   date, and ID. Signed links last 24 hours: if the sample is older, send a new request and repeat steps 2-5.
6. **Publish** (or turn the Zap **On**), then send one more from the completion page to confirm end to end.

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
- Rate limits: chat (in-process, Step 10); certificate email (DB-counted in `begin_certificate_email_request`).
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
    transaction). Step 11: a trigger on that completion awards the badge + certificate (section 11.1).

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

## 19. Hybrid intelligence (Phase 6 / Step 8)

### 19.1 Components and when Gemini is used
| Component | Code | Gemini? |
| --- | --- | --- |
| A. Deterministic routing | `src/lib/domain/routing.ts` (pure), `src/lib/routing/profileTags.ts` | Never |
| B. Custom-input interpretation | `src/lib/routing/classifier.ts`, `src/lib/routing/server.ts` | Only for a meaningful "Other" occupation/activity description without a cached interpretation, at module start |
| C. Scenario personalization | `src/lib/personalization/{prompt,validate,server}.ts` | Once per scenario per learner, when first played (all six) |
| D. Reasoning evaluation + humor | `src/lib/evaluation/{facts,prompt,schema,fallback,results,server}.ts` | Once per finalized attempt (original or replay) |

### 19.2 Deterministic routing
`ScenarioRelevanceScore = 0.50·A + 0.20·C + 0.15·E + 0.15·D`, integer basis points, ties by scenario key:
- **A** = |user activity tags ∩ scenario activity tags| / |scenario activity tags|.
- **C** = |user context tags ∩ scenario context tags| / |user context tags| (neutral `general_consumer` when unknown).
- **E** = 0.5 for every scenario (no verified evidence knowledge base; no invented fraud rates or demographic risk).
- **D** = 1 (both scenarios share their module's difficulty; never adjusted for age, occupation, or experience).
Only the two scenarios of the module being started are ranked (`rankModuleScenarios` refuses anything else); both stay
mandatory and playable in either order; the first is shown as recommended. The order is written once to
`module_scenario_orders` (insert-only + update trigger), so refresh, sign-in, profile edits, and replays never reorder.
Modules started before Step 8 are initialized once, on the next progress read, without calling Gemini
(`routing_source = 'legacy_initialization'`). If the table is unavailable, the authored order is used.

**Tag vocabulary** (`templateSchema.ts`): activities `online_shopping, online_selling, freelancing, sending_invoices,
receiving_invoices, paying_invoices, job_seeking, subscriptions, business_purchasing, digital_wallet_usage,
account_security, investments`; contexts `student, employed_professional, freelancer, business_owner, self_employed,
job_seeker, retired, general_consumer`. Predefined options map through `PROFILE_ACTIVITY_TAGS` / `PROFILE_CONTEXT_TAG`.

**Resolution order** (`planInterpretation`): predefined selections → an "Other" description that exactly matches an
option label/id (case/punctuation-insensitive) → vague text ("something else", "n/a", …) = neutral → otherwise Gemini.
A custom goal never adds routing tags (documented rule); it only informs personalization and humor.

### 19.3 Classification cache and invalidation
Key = SHA-256 of `{classifier version, normalized occupation text, normalized activity text}` (only the descriptions
whose "Other" option is selected). `profile_interpretations` stores only the validated tags and a short neutral
summary (never the raw text). Unchanged text → cache hit (0 calls) in every module; changed text → new fingerprint →
one new classification at the next module start; a classifier-version bump invalidates all entries. Failures are not
cached: routing then uses predefined tags plus deterministic matches (`custom_fallback`).

### 19.4 Personalization
Every scenario declares narrative-only slots (`render.slots`, kinds `text | name | domainLabel`): M1-S1 friend chat +
recent merchant; M1-S2, M2-S1, M3-S1 an "everyday email" from the learner's life (+ bank income label, cloud workspace
name, job title); M2-S2 laptop use; M3-S2 item name + earlier buyer. Evidence, amounts, decisions, actions, anchors,
domains of evidence-bearing sites, checkout, and the neutral intro stay authored, so ground truth is preserved by
construction. Gemini values are validated per slot (length; no digits/currency so amounts only come from server tokens;
no links/emails/markup; no judgment, hint, credential, urgency, or payment vocabulary; no real brands; names look like
names; a domain label may not imitate any domain or organization already in the scenario). Rejected slots fall back
individually; nothing valid → retry once → tracked fallback instance.

Lifecycle: `startScenarioAttempt` (new, replay, or resume still on INTRO) → `ensureAttemptPersonalization` →
`claim_scenario_personalization` (advisory lock: `ready` → reuse, `busy` → wait ≤10s, `claimed` → generate) →
`complete_scenario_personalization` → `link_attempt_personalization` (only while the attempt is INTRO). The START event
prepares it once more if a response was lost. Views read the linked instance; nothing regenerates on refresh, app
switching, or re-render. Replays reuse the scenario's Gemini instance; a fallback instance is retried on the next new
attempt.

**Personalized intros (owner decision 13).** The same request returns `introLine`. `INTRO_RULES` (`intro.ts`) gives each
scenario authoritative facts sent to Gemini (channel, roles, situation; never the truth), a personalization hint (which
profile details fit, e.g. M3-S1 uses occupation/job search, never shopping or devices), and checks: required setting
words (M2-S2 must say online/marketplace/listing and laptop), forbidden contradictions (M2-S2: local, nearby, in person,
private seller…; M1-S1: email/inbox; M3-S2: buying), a spoiler/hint/instruction/credential/evidence deny list, one
sentence of 15–120 characters starting with You/Your/A/An, no digits/links/real brands, and capitalized names only if
they already appear in the scenario or its validated slots. A rejected intro falls back to the authored one (recorded in
`fallback_reason`); the validated intro is stored in `scenario_personalizations.intro_line` and reused on refresh,
resume, and replays. Live check (2026-11-13, 4 × 6 requests while tuning): the final configuration accepted 6/6 accurate,
personalized intros.

### 19.5 Evaluation and scoring
FINALIZED (decision + explanation locked; any checkout captured, cancelled, or finished without paying) → the player
calls `POST …/evaluation` → `claim_attempt_evaluation` → facts (`buildAttemptFacts`: deterministic correctness,
recorded actions, verified capture from `payment_transactions`, fictional outcome) → one Gemini call → validation →
`scoreScenario` (40/30/20/10, unchanged formula and `SCORING_VERSION`) → `record_attempt_evaluation`, which in one
transaction stores the evaluation, applies FEEDBACK_READY → REVIEW_READY → RECOVERY_READY, and calls
`complete_scenario_attempt` (immutable score, payment classification, module completion; replays never touch official
results). Failure → `fail_attempt_evaluation`, attempt stays FINALIZED, retry or basic feedback. Evaluation never calls
PayPal. The results page (`/play/[id]/results`) renders stored data only.

### 19.6 Reliability, limits, and monitoring
- Deadlines per category (classification 12s, personalization 20s, evaluation 35s); per-request timeout
  `GEMINI_TIMEOUT_MS`; ≤2 retries for timeouts/network/429/5xx with exponential backoff + full jitter or the API's
  `retryDelay`; invalid output retried once; 400/401/403/404 and daily-quota 429 not retried. SDK retries disabled.
- In-process rate limiter: global `GEMINI_MAX_RPM` (default 12) and 24 logical calls per user per 10 minutes.
- Duplicate protection: DB claims for personalization and evaluation, insert-once caches, unique indexes.
- `src/lib/ai/usage.ts` counts requests, successes, retries, cache hits, tokens (SDK `usageMetadata`, thinking tokens
  included), errors, rate-limit, invalid-output, and fallback events; no prompts, outputs, or personal data. Exposed at
  `GET /api/dev/gemini-usage` in development; token counts are also stored per personalization/evaluation row.
- Prompt injection: user text is fenced as `<untrusted>` data (closing tags stripped), system prompts forbid following
  it, and every output is validated regardless.

### 19.7 Security
Every Gemini path runs behind an authenticated route and the attempt/profile ownership checks of the existing services;
writes use the trusted writer with the session user id; all five new tables are RLS read-own with no browser writes;
answer keys stay server-only (the client bundle was scanned: no key, prompt, or evidence ID). Before the migration is
applied the app degrades (profile reads fall back to legacy columns; descriptions can't be saved; personalization falls
back; evaluation reports a calm error).

## 20. Post-scenario debrief (Step 9)

Journey: completion → results (`/results`) → **Reveal the Red Flags** (`/review`) → **Your Recovery Playbook**
(`/playbook`) → module. `PostScenarioNav` links the three pages; each is a server component that loads the owner's
attempt through the session client (RLS + user filter → not found for anyone else) and redirects unfinished attempts
to the player. None of them calls PayPal; only the Playbook note may call Gemini, once per attempt.

### 20.1 Reveal the Red Flags
- **Data** (`src/lib/review/`): `reviewFromLoaded` refuses non-COMPLETED attempts (`NotCompletedError`), rebuilds the
  exact played render with `buildClientView` (same tokens, same stored personalization), and builds `ReviewView`:
  evidence in answer-key order (number, anchor, type, title, explanation, location, `seenDuringAttempt`, reasoning
  status from the stored evaluation), unsupported assumptions, decision and truth. Reads only.
- **Semantic target mapping** (`locate.ts`, pure): walks the render and maps every anchor (`anchor`, `…Anchor`) to
  `{appId, target, requires}`. Targets: chat thread (+ contact details), mail message (+ document attachment index),
  browser page, wallet tab, marketplace page (home/product + specs/reviews tab/seller/chat/checkout), seller-hub tab
  (+ order). The most specific place wins. Tests prove all 50 evidence targets of the six scenarios are located.
- **Read-only environment**: `SimApi` gained `readOnly` and `reveal {appId, target, nonce}`. The review passes no-op
  `record`/`decide`, `interactive: false` (decisions and reply chips disabled), and `recorded` = the learner's actions
  followed by every other action (all content visible, learner's path first). `useCanNavigate()` keeps navigation-only
  controls (mail links, "Buy now" → checkout page) usable; `useReveal(appId, fn)` lets each app open the right place.
  In review, invoice documents open inline (instead of a modal) so markers can sit on them.
- **Markers** (`src/components/review/`): an overlay above the workspace. `geometry.ts` measures each anchor's VISIBLE
  box relative to the container (union of children for `display: contents` key/value rows; clipped by scrolling
  ancestors; hidden apps have no box), re-measured on scroll, resize, and DOM mutations of the environment only.
  Outlines don't take pointer events; markers are buttons with labels; collisions are nudged. One non-modal
  explanation (`role="dialog"`) at a time, placed below/above its target and clamped to the container; focus moves
  into it and returns on Close/Escape. The evidence guide below lists every item with "Show in scenario".
- Nothing in the review sends a request: there is no way for it to create attempts, events, payments, or scores.

### 20.2 Your Recovery Playbook
- **Knowledge base** `src/content/playbook/policies.ts` (versioned, Zod; `2026-11-10.1`, nine records, all verified):
  verified records carry key facts, eligibility conditions, procedures, and exclusions (each item verbatim or flagged
  as a summary) with `lastVerified` and the page's own `pageUpdated`; `source_unavailable` records carry none (schema
  refinement + tests). Curated offline from the official pages: nothing is fetched from PayPal at runtime. Authored
  limitations in `distinctions.ts`; server-only per-scenario guidance and policy mapping in `scenarios.server.ts`.
- **Assembly** `src/lib/recovery/playbook.ts` (pure): `selectPolicyIds` = core ∪ whenPaid ∪ whenAffected; steps of
  kind `paypal` cite any verified item of a record (fact, eligibility, procedure, or exclusion) and are shown only with
  it and its source (otherwise dropped); `policyView` builds the card data for both Playbook pages; "Sandbox isn't
  coverage" only for payment scenarios.
- **Sensei Kenshi** (§21) retrieves the same records; its reply guard accepts a timeframe only when a retrieved
  verified item states it.
- **Personal note** `src/lib/recovery/{prompt,schema,server}.ts`: `claim_recovery_playbook` (DB lock; `ready`/`busy`/
  `claimed`) → one `generateJson` (`recovery`) → `parsePlaybookNote` → `complete_recovery_playbook`. Invalid output or
  Gemini failure → stored `fallback`; rate-limited → left pending (claim expires after 45 s); Gemini not configured or
  table missing → `unavailable` with no call. The page reads the stored note; the client POSTs once only when none is
  stored.

## 21. Sensei Kenshi (Step 10)

**Where he appears.** The dashboard card (`KenshiLauncher variant="card"`), the `/sensei` page, and "Ask Sensei Kenshi"
in `PostScenarioNav` (Results, Reveal the Red Flags, Recovery Playbook of a COMPLETED attempt, opened focused on that
attempt). The launcher is a native `<dialog>` side panel (full screen below 640 px): focus trapped, Esc closes, focus
returns. The scenario player (`/play/[attemptId]`) has no entry point: `navItemsFor()` drops the "Sensei Kenshi"
primary-nav item there (`isGameplayPath`), and a test forbids any Kenshi import or `/sensei` link in
`src/components/scenario/**` and the player page. Visibility is not the protection; the API is (below).

**Answer protection (server, before any prompt exists)**, `src/lib/kenshi/server.ts`:
1. `requireApiUser()` (cookie session verified with Supabase Auth) + onboarded profile.
2. With `attemptId`: `loadAttempt` reads through the session client (RLS + explicit `user_id` filter), so foreign or
   missing attempts are a 404. `state !== COMPLETED` → 409 before the answer key is read. Only then is that ONE
   scenario's template loaded; `buildAttemptContext` re-checks COMPLETED (defence in depth).
3. Without `attemptId`: only `scenario_attempts` rows with `state = 'COMPLETED'` are queried; their evaluations and
   scores are filtered to those ids. Unfinished and locked scenarios appear by public title only; their templates are
   never read.
4. Gemini never receives the answer-key library, other scenarios' evidence, or unfinished data, so no prompt injection
   can extract it. As a backstop, `parseKenshiOutput` rejects a reply that names an unfinished scenario in the same
   sentence as a verdict word (scam, legit, genuine, safe, red flag, …); follow-ups are filtered the same way.

**Completed-attempt context** (`context.ts`, pure): scenario truth (fraudulent/legitimate), appropriate decisions, all
of that scenario's evidence (type, title, explanation), key lessons, safest next step; the learner's recorded actions
(labels; verification flagged) and the verification actions not done; the locked decision and story outcome; the
verified Sandbox capture (if any); the justification (fenced); the STORED Step 8 evaluation (feedback fields,
recognized/missed evidence titles, assumptions) and score. A missing evaluation or score is "not available", never
invented. Each attempt id is its own context: a replay uses its own rows and is labelled PRACTICE #n ("never changes
the official record"); the original is labelled ORIGINAL. The overview (dashboard) summarizes each completed scenario's
ORIGINAL attempt and counts replays.

**Policy grounding** (`policies.ts`, pure): no records unless the question touches PayPal, protection, reporting, or
recovery; then topic matches (verified first), then the attempt's Step 9 `selectPolicyIds` mapping, max 4. Verified
records carry their facts; `source_unavailable` records carry title + id only and the prompt says "NOT VERIFIED: only
point to the official page". `sources[]` in the response come from those records (cited ids whitelisted; if the reply
mentions PayPal without citing, the retrieved records are shown), never from model text.

**Reply guards** (`schema.ts`): reject deadlines/timeframes (digits or number words + days/weeks/months), percentages,
un-negated "guarantee", refund/coverage promises ("you'll get a refund", "you're covered"), URLs and real domains
(fictional `.example` domains allowed), emails other than `phishing@paypal.com`, phone numbers, credential requests,
and the unfinished-scenario leak above. A rejected reply is retried once by `callGeminiJson`, then the API answers 503.

**Conversation and efficiency.** The client keeps the conversation (not stored) and sends at most 6 recent turns since
the last context switch (switching to or from a scenario inserts a divider and restarts history, so contexts never
mix); the server bounds history again and fences every turn as untrusted. One Gemini request per question; none to
open, close, switch, or show suggestions (static per mode; Gemini's validated `followUps` replace them after a reply).
Retry re-sends the same question in the same bubble. Errors show links to the Recovery Playbook and the attempt's
results.
