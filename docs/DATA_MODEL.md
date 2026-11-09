# ScamSense — Data Model

Status: Phase 3 (Step 5). Supabase PostgreSQL. Implemented: `profiles`
(`20261109000000_profiles.sql`) and `module_runs`, `scenario_attempts`, `wallet_ledger_entries`, `scenario_scores`
(`20261109120000_progression_wallet.sql`); currency allowlist narrowed to USD by `20261109140000_usd_only_currency.sql`
(Step 5 review). The other tables are still design-only and arrive with the phases that
need them (see IMPLEMENTATION_PLAN).

## 1. Principles
- **Content lives in code, progress lives in the DB.** Modules, scenarios, answer keys, and Playbook content are
  versioned TypeScript content (`src/content/`). The DB stores only `module_key` / `scenario_key` strings plus
  `content_version`, so historical attempts stay interpretable after content edits.
- **Money uses integer minor units** (`bigint`) plus an ISO 4217 `currency` code. No floats.
- **Append-only history** for the wallet ledger, evaluations, and payment transactions.
- Every user-owned table has `user_id uuid references auth.users(id) on delete cascade` and RLS
  `user_id = auth.uid()` for select.
- All timestamps are `timestamptz default now()`.

## 2. Entity-relationship overview

```
auth.users 1─1 profiles
auth.users 1─* module_runs            (one per module the user has started; holds the wallet "reset")
module_runs 1─* scenario_attempts
module_runs 1─* wallet_ledger_entries
scenario_attempts 1─0..1 scenario_scores (deterministic 40/30/20/10 score, written at completion)
scenario_attempts 1─0..1 evaluations  (latest/final; history kept via evaluation rows with is_final flag)
scenario_attempts 1─* payment_transactions
scenario_attempts 1─* wallet_ledger_entries (payment entries reference the attempt)
module_runs 1─0..1 badges
module_runs 1─0..1 certificates
certificates 1─* certificate_email_requests
auth.users 1─* chat_messages          (optionally linked to a scenario_attempt)
auth.users 1─* rate_limit_events
```

Static (code) entities referenced by key: `Module`, `Scenario` (render + answer key), `Evidence`, `Decision`,
`PlaybookSection`, `Currency`.

## 3. Tables

### 3.1 `profiles` (implemented)
One row per Supabase Auth user, created by the `on_auth_user_created` trigger from sign-up metadata. Emails and
passwords live only in `auth.users`.

| Column | Type | Notes |
|---|---|---|
| `user_id` | uuid PK, FK auth.users on delete cascade | ownership key; never client-writable |
| `display_name` | text not null | 1–60 chars (trimmed) |
| `age_confirmed` | boolean not null, check = true | 18+ attestation (R2); immutable |
| `age_confirmed_at` | timestamptz not null default now() | immutable |
| `age_bracket` | text null | optional; adult brackets only |
| `occupation` | text null | fixed ids; required once onboarded |
| `country` | text null | ISO 3166-1 alpha-2 (249 codes); required once onboarded |
| `financial_activities` | text[] not null default `{}` | ⊆ fixed ids, ≤10, de-duplicated + sorted by trigger; ≥1 once onboarded |
| `payment_experience` | text null | `new`,`occasional`,`frequent`; required once onboarded |
| `income_bracket` | text null | optional fixed ids incl. `prefer_not_to_say` |
| `income_bracket_label` | text null | **derived by trigger** from the id (display value snapshot); not client-writable |
| `financial_goal` | text null | fixed ids; required once onboarded |
| `custom_goal` | text null | ≤120 chars |
| `goal_amount_minor` | bigint null | integer minor units of `preferred_currency`, 1…1e9 (R38) |
| `preferred_currency` | text not null default `'USD'` | check: enabled allowlist, **USD only** until PayPal merchant verification |
| `onboarding_completed` | boolean not null default false | check: only true when all required fields are present; can't flip back |
| `onboarding_completed_at` | timestamptz null | stamped by trigger |
| `created_at`, `updated_at` | timestamptz | `updated_at` maintained by trigger |

Security: RLS enabled; policies `profiles_select_own` / `profiles_update_own` (`(select auth.uid()) = user_id`) for the
`authenticated` role only. Privileges: `anon` has none; `authenticated` has `SELECT` and column-level `UPDATE` on the
user-editable columns only. No INSERT or DELETE grants (rows come from the trigger and go via cascade). The check
constraints mirror the TypeScript option lists; `src/lib/profile/migration.test.ts` fails if they drift.

### 3.2 `module_runs` (implemented): one row per (user, module), the module's Training Funds period
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK auth.users, cascade | |
| `module_key` | text not null | `spot-the-trap` / `trust-under-pressure` / `outsmart-the-scam` (check) |
| `currency` | text not null | ISO 4217 snapshot of the preferred currency at start |
| `starting_funds_minor` | bigint not null | > 0; snapshot of `calculateStartingFunds` (USD baseline from the income bracket, converted at the fixed reference rate) |
| `closing_balance_minor` | bigint null | frozen at completion; set together with `completed_at` |
| `started_at` | timestamptz | |
| `completed_at` | timestamptz null | set by `complete_scenario_attempt` when both scenarios' first attempts are COMPLETED |
| unique | (`user_id`, `module_key`) | one run per module; replays reuse it and never change it |

Lock state is **derived**, not stored: module N is unlocked if N = 1 or module N−1 has both scenarios completed (no
minimum score). `start_module_run` re-checks that the previous run is completed. Only completion columns may ever
change, once (trigger).

### 3.3 `scenario_attempts` (implemented)
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK | |
| `module_run_id`, `module_key` | composite FK → module_runs (id, user_id, module_key) | the attempt cannot point at another user's or module's run |
| `scenario_key` | text not null | `m1-s1` … `m3-s2`; (module, scenario) pair checked |
| `attempt_number` | int ≥ 1 | 1 = scored attempt; > 1 = replay |
| `is_replay` | boolean generated (`attempt_number > 1`) | a **practice attempt**: full flow (decision, justification, Sandbox payment, feedback) recorded separately; never official |
| `content_version` | text not null | |
| `state` | text not null default `INTRO` | `INTRO`,`EXPLORING`,`PAYMENT_PENDING`,`AWAITING_JUSTIFICATION`,`EVALUATING`,`COMPLETED` |
| `decision_id`, `decision_committed_at` | null until committed | write-once (trigger) |
| `justification`, `justification_submitted_at` | 20–1000 chars | write-once (trigger) |
| `decision_correct` | boolean null | set at completion only (check) |
| `completed_at` | timestamptz null | present iff COMPLETED (check) |
| `created_at`, `updated_at` | timestamptz | |
| unique | (`user_id`, `scenario_key`, `attempt_number`) | |
| partial unique | (`user_id`, `scenario_key`) where state ≠ COMPLETED | at most one unfinished attempt (resume, never duplicate) |

COMPLETED attempts are final. The state can only become COMPLETED inside `complete_scenario_attempt`.

### 3.3a `scenario_scores` (implemented): one immutable score per completed attempt
| Column | Type | Notes |
|---|---|---|
| `attempt_id` | uuid PK, composite FK → scenario_attempts (id, user_id, module_run_id) | |
| `user_id`, `module_run_id`, `scenario_key` | | denormalized for reads |
| `is_replay` | boolean | replays are stored but excluded from totals |
| `decision_correct` | boolean | consistent with `decision_points` (check) |
| `decision_points` | smallint | 0 or 40 |
| `reasoning_points` | smallint | 0–30 |
| `verification_points` | smallint | 0–20 |
| `payment_safety_points` | smallint | 0 or 10 |
| `total_points` | smallint generated | sum of the four |
| `max_points` | smallint = 100 | |
| `reasoning_source` | text | `gemini` or `fallback` (no score exists without a real assessment) |
| `addressed_evidence_ids`, `verification_action_ids` | text[] | validated IDs used for the points |
| `scoring_version` | text | `SCORING_VERSION` in `scoring.ts` |
| `created_at` | timestamptz | |

### 3.4 `evaluations`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `attempt_id` | uuid FK, unique | final evaluation for the attempt |
| `user_id` | uuid FK | |
| `source` | text | `gemini` or `fallback` |
| `model` | text null | Gemini model name used |
| `prompt_version` | text | |
| `addressed_evidence_ids` | text[] | validated against the answer key |
| `reasoning_coverage` | smallint | 0–100, computed deterministically from IDs + weights |
| `misconceptions` | text[] | ≤3 short items (AI) or empty |
| `feedback_text` | text not null | AI or authored fallback |
| `humor_text` | text not null | separate field (R14). Fallback line from a fixed pool |
| `latency_ms` | int null | |
| `created_at` | timestamptz | |

### 3.5 `payment_transactions` (PayPal Sandbox only; design, created in Phase 5)
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK | |
| `attempt_id` | uuid FK (composite with user_id) | the scored attempt **or** a replay's own practice attempt |
| `is_practice` | boolean not null | copied from `scenario_attempts.is_replay`; practice payments never touch the ledger |
| `decision_id` | text not null | the pay decision |
| `environment` | text not null check (= `'sandbox'`) | R28 guard at DB level |
| `paypal_order_id` | text unique not null | |
| `paypal_capture_id` | text unique null | |
| `request_id` | uuid unique not null | PayPal-Request-Id idempotency key; a fresh one per order (replays never reuse the original's) |
| `amount_minor` | bigint not null | server-computed |
| `currency` | char(3) not null | = module run currency |
| `percent_bp` | int not null | basis points used to compute the amount |
| `status` | text not null | `CREATED`,`CAPTURED`,`CANCELLED`,`FAILED` |
| `paypal_status` | text null | raw status from PayPal |
| `failure_code` | text null | |
| `created_at`, `updated_at` | timestamptz | |

| `outcome_classification` | text null | set at completion: `spending` or `fraud_loss` (practice payments are classified here; official ones also in the ledger) |
| `ledger_entry_id` | bigint null FK wallet_ledger_entries | set only for the scored attempt's captured payment; always null for practice |

Partial unique index: at most one `CAPTURED` row per attempt (so retries or double clicks cannot capture twice).
Check: `is_practice` ⇒ `ledger_entry_id is null`. Cancelled/failed rows never produce a ledger entry or a
"paid" outcome. Phase 5 will also extend `complete_scenario_attempt` to classify the practice payment row.

### 3.6 `wallet_ledger_entries` (implemented: fictional Training Funds, append-only)
| Column | Type | Notes |
|---|---|---|
| `id` | bigint identity PK | chronological order |
| `user_id` | uuid FK | |
| `module_run_id` | uuid, composite FK → module_runs (id, user_id) | |
| `attempt_id` | uuid null, composite FK → scenario_attempts (id, user_id, module_run_id) | null for MODULE_START |
| `entry_type` | text | `MODULE_START`, `PAYMENT` |
| `amount_minor` | bigint | signed: > 0 for MODULE_START, < 0 for PAYMENT (shape check) |
| `balance_after_minor` | bigint | check ≥ 0 |
| `currency` | text | = run currency |
| `classification` | text null | PAYMENT only: `pending` during play → `spending` or `fraud_loss` once, at completion |
| `idempotency_key` | text unique null | PAYMENT only (8–200 chars); Phase 5 uses the PayPal-Request-Id |
| `created_at` | timestamptz | |

Partial unique indexes: one `MODULE_START` per run; one `PAYMENT` per attempt. Balance = `sum(amount_minor)` per
module run, independent of any PayPal balance (R18). The only permitted update is classifying a pending payment once
(trigger); there are no delete grants. Spending and fraud loss are reported separately.
(A future `payment_transaction_id` link arrives with `payment_transactions` in Phase 5.)

### 3.7 `badges` (Phase 9; until then a badge is derived from `module_runs.completed_at`)
| `id` uuid PK · `user_id` · `module_run_id` unique · `module_key` · `awarded_at` |

### 3.8 `certificates`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK | |
| `module_run_id` | uuid FK unique | |
| `module_key` | text | |
| `certificate_code` | text unique | random, non-guessable (e.g., 12 chars base32) |
| `recipient_name` | text | snapshot of the display name |
| `issued_at` | timestamptz | |

### 3.9 `certificate_email_requests`
| `id` uuid PK · `certificate_id` FK · `user_id` · `recipient_email` text · `status` (`PENDING`,`SENT`,`FAILED`) ·
`http_status` int null · `error_code` text null · `created_at` |

### 3.10 `chat_messages`
| `id` uuid PK · `user_id` · `attempt_id` uuid null · `role` (`user`,`assistant`) · `content` text (≤4000) ·
`source` (`gemini`,`fallback`) · `created_at` |

### 3.11 `rate_limit_events`
| `id` bigserial · `user_id` · `action` (`chat`,`cert_email`,`attempt_create`) · `created_at` |
Limits are checked by counting rows in a time window. Old rows are pruned opportunistically.

## 4. Transactional operations
Implemented in Phase 3 as `security definer` functions with `search_path = ''`, executable **only by
`service_role`** (the server's trusted writer, `src/lib/supabase/admin.ts`), which passes the user id from the
verified session. Errors are SQLSTATE `P0001` with stable messages (`module_locked`, `module_not_started`,
`insufficient_funds`, `duplicate_attempt_payment`, `replay_not_charged`, `attempt_not_evaluating`, …).
1. `start_module_run(user, module_key, currency, starting_funds_minor)`: idempotent (returns the existing run);
   checks the previous module's run is completed; inserts the run + MODULE_START atomically.
2. `create_scenario_attempt(user, scenario_key, content_version)`: requires the module run; returns the open attempt
   if there is one, else inserts attempt `max + 1` (first play or replay).
3. `record_training_payment(user, attempt, amount_minor, idempotency_key)`: idempotent per key; locks the run; rejects
   replays, completed attempts/runs, a second payment per attempt, and overdrafts; inserts a `pending` PAYMENT.
   Phase 5's capture flow calls it.
4. `complete_scenario_attempt(user, attempt, decision_correct, 4 point components, reasoning_source, evidence ids,
   verification ids, scoring_version, payment_classification)`: requires `EVALUATING`; idempotent once COMPLETED;
   in one transaction marks COMPLETED, inserts the score, classifies the attempt's payment, and completes the module
   run (closing balance) when both scenarios' first attempts are done. Phase 6 calls it.
5. *(Phase 5)* `record_capture(...)`: marks the payment transaction CAPTURED and calls the ledger debit above.
6. *(Phase 9)* badge + certificate rows at module completion.

## 5. Static content types (TypeScript, validated by Zod)
```ts
Module      { key, order: 1|2|3, title, difficulty: "Beginner"|"Intermediate"|"Advanced", focus, summary, badgeName,
              scenarios: [ScenarioSlot, ScenarioSlot] }            // src/content/modules.ts (implemented)
ScenarioSlot { key: "m1-s1"…"m3-s2", moduleKey, position: 1|2, title, paymentBasisPoints }
ExchangeRates { EXCHANGE_RATE_SOURCE, ECB_RATES_PER_EUR }  // src/content/exchangeRates.ts (fixed, documented)
TrainingBudget { DEFAULT_TRAINING_BUDGET_USD = 3000, TRAINING_BUDGET_USD_BY_INCOME }  // USD baseline  // src/content/trainingFunds.ts
ScenarioRender { key, moduleKey, contentVersion, introLine, environment: Screen[],
              personalizationSlots: Slot[], decisions: { id, kind: "pay"|"other", trigger }[] }
AnswerKey   { scenarioKey, legitimacy: "scam"|"legitimate", correctDecisionIds: string[],
              decisionOutcomes: Record<decisionId, string>, payableDecisionIds: string[],
              verificationActions: { id, weight }[], unsafeActionIds: string[],   // scoring rubric
              evidence: Evidence[], safestNextStep, keyLessons: string[], playbookSectionIds: string[],
              fallbackFeedback: { correct: string, incorrect: string } }
Evidence    { id, anchorId, classification: "red_flag"|"verify"|"positive", title, explanation,
              keywords: string[], weight: 1|2|3 }
PlaybookSection { id, title, body, sources: { url, title }[], lastVerified: ISODate }
Currency    { code, minorUnitDigits }
```
