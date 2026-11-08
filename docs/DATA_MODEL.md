# ScamSense — Data Model

Status: Phase 0 baseline. Supabase PostgreSQL. Migrations are implemented in a later phase (see IMPLEMENTATION_PLAN).

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

### 3.1 `profiles`
| Column | Type | Notes |
|---|---|---|
| `user_id` | uuid PK, FK auth.users | |
| `display_name` | text not null | 1–60 chars |
| `age_bracket` | text not null | check in (`18_24`,`25_34`,`35_44`,`45_54`,`55_64`,`65_plus`) |
| `adult_confirmed_at` | timestamptz not null | 18+ attestation (R2) |
| `life_stage` | text not null | enum-like check |
| `financial_activities` | text[] not null | ≥1, values from a fixed list |
| `payment_experience` | text not null | `new`,`occasional`,`regular`,`very_experienced` |
| `financial_goal` | text not null | fixed option key |
| `financial_goal_note` | text null | ≤120 chars |
| `income_bracket` | text null | optional, includes `prefer_not_to_say` (R3) |
| `preferred_currency` | char(3) not null default `'USD'` | validated against the server allowlist (R4) |
| `onboarded_at` | timestamptz null | set when onboarding completes |
| `created_at`, `updated_at` | timestamptz | |

### 3.2 `module_runs`: one row per (user, module), representing the module's training-funds period
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK | |
| `module_key` | text not null | `spot_the_trap` / `trust_under_pressure` / `outsmart_the_scam` |
| `currency` | char(3) not null | snapshot of the preferred currency at start |
| `starting_funds_minor` | bigint not null | snapshot from content config (R19, R20) |
| `closing_balance_minor` | bigint null | frozen at completion |
| `started_at` | timestamptz | |
| `completed_at` | timestamptz null | set when both scenarios are COMPLETED |
| unique | (`user_id`, `module_key`) | MVP: one run per module |

Lock state is **derived**, not stored: module N is unlocked if N = 1 or the run for module N−1 has `completed_at`.

### 3.3 `scenario_attempts`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK | |
| `module_run_id` | uuid FK module_runs | |
| `scenario_key` | text not null | |
| `content_version` | text not null | |
| `state` | text not null | `INTRO`,`EXPLORING`,`PAYMENT_PENDING`,`AWAITING_JUSTIFICATION`,`EVALUATING`,`COMPLETED` |
| `personalization` | jsonb not null | validated slot values + `source` (`gemini`/`default`) |
| `decision_id` | text null | immutable once set |
| `decision_committed_at` | timestamptz null | |
| `justification` | text null | 20–1000 chars, immutable once set |
| `justification_submitted_at` | timestamptz null | |
| `decision_correct` | boolean null | deterministic, set at evaluation |
| `completed_at` | timestamptz null | |
| `created_at`, `updated_at` | timestamptz | |
| unique | (`user_id`, `scenario_key`) | MVP: one attempt per scenario (resumable) |

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

### 3.5 `payment_transactions` (PayPal Sandbox only)
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK | |
| `attempt_id` | uuid FK | |
| `decision_id` | text not null | the pay decision |
| `environment` | text not null check (= `'sandbox'`) | R28 guard at DB level |
| `paypal_order_id` | text unique not null | |
| `paypal_capture_id` | text unique null | |
| `request_id` | uuid unique not null | PayPal-Request-Id idempotency key |
| `amount_minor` | bigint not null | server-computed |
| `currency` | char(3) not null | = module run currency |
| `percent_bp` | int not null | basis points used to compute the amount |
| `status` | text not null | `CREATED`,`CAPTURED`,`CANCELLED`,`FAILED` |
| `paypal_status` | text null | raw status from PayPal |
| `failure_code` | text null | |
| `created_at`, `updated_at` | timestamptz | |

Partial unique index: at most one `CAPTURED` row per attempt.

### 3.6 `wallet_ledger_entries` (fictional training funds, append-only)
| Column | Type | Notes |
|---|---|---|
| `id` | bigserial PK | |
| `user_id` | uuid FK | |
| `module_run_id` | uuid FK | |
| `attempt_id` | uuid FK null | null for MODULE_START |
| `payment_transaction_id` | uuid FK null | |
| `entry_type` | text | `MODULE_START`, `PAYMENT` |
| `amount_minor` | bigint | signed (+ start, − payment) |
| `balance_after_minor` | bigint | check ≥ 0 |
| `currency` | char(3) | |
| `created_at` | timestamptz | |

Unique: one `MODULE_START` per module run; one `PAYMENT` per payment transaction.
Balance = `sum(amount_minor)` per module run. It is independent of any PayPal balance (R18).

### 3.7 `badges`
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

## 4. Transactional operations (Postgres functions, `security definer`, re-check `auth.uid()`)
1. `start_module_run(module_key)`: checks unlock, inserts the run + MODULE_START ledger entry atomically.
2. `record_capture(payment_transaction_id, capture_id, paypal_status)`: marks CAPTURED, inserts the PAYMENT ledger
   entry (balance check), commits the attempt decision, and sets state → `AWAITING_JUSTIFICATION`.
3. `complete_attempt(attempt_id, evaluation…)`: inserts the evaluation and sets `COMPLETED`. If both module scenarios
   are complete, it sets `module_runs.completed_at` and the closing balance and inserts the badge + certificate.

## 5. Static content types (TypeScript, validated by Zod)
```ts
Module      { key, order: 1|2|3, title, difficulty: "beginner"|"intermediate"|"advanced",
              startingFundsMajor: number, scenarioKeys: [string, string] }
ScenarioRender { key, moduleKey, contentVersion, introLine, environment: Screen[],
              personalizationSlots: Slot[], decisions: { id, kind: "pay"|"other", trigger }[] }
AnswerKey   { scenarioKey, legitimacy: "scam"|"legitimate", correctDecisionIds: string[],
              decisionOutcomes: Record<decisionId, string>, payable: Record<decisionId, basisPoints>,
              evidence: Evidence[], safestNextStep, keyLessons: string[], playbookSectionIds: string[],
              fallbackFeedback: { correct: string, incorrect: string } }
Evidence    { id, anchorId, classification: "red_flag"|"verify"|"positive", title, explanation,
              keywords: string[], weight: 1|2|3 }
PlaybookSection { id, title, body, sources: { url, title }[], lastVerified: ISODate }
Currency    { code, minorUnitDigits }
```
