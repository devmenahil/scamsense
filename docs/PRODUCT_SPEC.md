# ScamSense — Product Specification

Status: updated for Phase 3 (Step 5: progression, training funds, dashboard, scoring). This is the functional source of truth. It must stay consistent with the
**ScamSense Product Experience — Non-Negotiable Rules** in `CLAUDE.md`, including both the core principles and the
detailed rules. Rule references such as (R10) point to that section.

**Core principle:** ScamSense is an immersive financial simulation and must never feel like a traditional
cybersecurity quiz. Players use realistic fictional financial tools, meet believable situations, make meaningful
decisions, and see the consequences.

## 1. Purpose

ScamSense teaches digital-payment users to **recognize, investigate, avoid, and respond to** financial scams. Users work through
realistic, fictional, AI-personalized financial simulations connected to the PayPal ecosystem. They make real
decisions and explain them, and only then do they learn what the evidence showed.

Brand promise (from the brand guide): *Pause. Check. Verify. Then Pay.* The intended feelings are capable, calm, and
curious. The tone is "practice, not panic."

Honest by design: ScamSense is an educational simulator. It does not detect fraud in real messages, does not access
real financial accounts, and never moves real money (R28, R31).

## 2. Users and registration

- ScamSense is an inclusive scam-education experience for digital-payment users of every background and experience
  level. It is **not** described or marketed as an "adult" or "18+" platform: no "18+" / "Adults only" messaging
  appears on the landing page, dashboard, modules, certificates, or promotional content.
- Registration (R2) asks for a display name, email, password, an **optional** age bracket, and a required checkbox:
  "I confirm that I am at least 18 years old." The confirmation is enforced in the browser, in the API, and by the
  database trigger that creates the profile (sign-up is rejected without it). It is collected once, at sign-up only.
- Credentials are handled entirely by Supabase Auth. ScamSense tables never store passwords or duplicate emails.
- Age is never used to infer digital literacy or fraud susceptibility.
- The platform is desktop-first and fully responsive on tablets and phones (R1).

### 2.1 Onboarding profile (R3)
Collected in three steps after sign-up (age is not asked again) and editable later on My Profile. Steps 1–2 are
saved as the user continues, so a refresh or a later sign-in resumes at the right step. All options are stored as
stable machine-readable identifiers (`src/content/profileOptions.ts`) for the future routing engine.

| Step | Field | Required | Stored identifiers |
|---|---|---|---|
| Sign-up | Display name | Yes | free text, 1–60 chars (prefilled in step 1, editable) |
| Sign-up | Age bracket | **Optional** | `18_24`,`25_34`,`35_44`,`45_54`,`55_64`,`65_plus` (or none) |
| Sign-up | "At least 18" confirmation | Yes | `age_confirmed` + timestamp |
| 1 About you | Occupation / life stage | Yes | `student`,`employed_professional`,`freelancer`,`business_owner`,`self_employed`,`job_seeker`,`retired`,`other` |
| 1 About you | Country of residence | Yes | ISO 3166-1 alpha-2 code |
| 2 Activities | Financial activities | Yes (≥1) | `online_shopping`,`online_selling`,`freelance_payments`,`sending_invoices`,`receiving_invoices`,`job_applications`,`business_purchases`,`subscription_payments`,`investments`,`digital_wallet_usage` |
| 2 Activities | Digital payment experience | Yes | `new`,`occasional`,`frequent` |
| 3 Goals | Financial goal | Yes | `buying_laptop`,`vacation_travel`,`building_savings`,`education`,`business_growth`,`paying_off_debt`,`other` |
| 3 Goals | Custom goal details | Optional | free text ≤120 chars |
| 3 Goals | Goal amount | Optional | integer minor units of the preferred currency |
| 3 Goals | Monthly income bracket | Optional | `prefer_not_to_say`,`under_1000`,`1000_2499`,`2500_4999`,`5000_9999`,`10000_plus` (USD ranges) + derived display label. Never an exact income |
| 3 Goals | Preferred currency | Yes (default **USD**) | Server-validated allowlist of currencies verified with the configured PayPal Sandbox merchant (R4). **Currently USD only** (§5.1, ARCHITECTURE §9) |

The profile is used only to personalize scenario surface details, feedback wording, goal-based humor, illustrative
training budgets, and the chatbot. It never changes answer keys, correctness, or difficulty (R13). No bank balances or
account information are collected.

## 3. Learning structure

### 3.1 Modules (R5–R7)
| # | Module | Difficulty (from level info doc) | Unlock condition |
|---|---|---|---|
| 1 | **Spot the Trap** | Beginner (Awareness): obvious warning signs | Available after onboarding · badge **Scam Spotter** |
| 2 | **Trust Under Pressure** | Intermediate (Recognition): less obvious tricks, urgency, impersonation, familiar branding | Both Module 1 scenarios completed · badge **Fraud Detective** |
| 3 | **Outsmart the Scam** | Advanced (Critical thinking): multi-step situations, subtle inconsistencies, mixed clues | Both Module 2 scenarios completed · badge **ScamSense Guardian** |

Each module has exactly two scenarios (R6). Within a module, the two scenarios can be played in either order.
Scenario slots have stable keys `m1-s1` … `m3-s2` (`src/content/modules.ts`). Unlocking needs completion only: **no
minimum score** is required (Step 5).

### 3.2 Scam categories (from the level info doc)
1. OTP theft and social engineering
2. Phishing, fake links, and duplicated websites
3. Fake invoices, payment requests, and impersonation
4. Online shopping and marketplace scams
5. Advance-fee, job, and investment scams

Categories can overlap. Advanced scenarios should combine warning signs.

### 3.3 Scenario lineup (official titles confirmed in the Step 5 review; storylines still drafts)
The six scenarios together cover all five categories and include at least one **legitimate** scenario (R17).
Titles are shown to players; the legitimacy column is internal and never shown before completion (R10).

| Slot | Official title | Draft storyline | Category | Environment | Legit? | Payment possible? |
|---|---|---|---|---|---|---|
| M1-S1 | **The Security Check** | "Support agent" asks for a verification code | 1 | Chat window | Scam | No |
| M1-S2 | **Your Account Needs Attention** | Account "restricted" email and look-alike sign-in page | 2 | Email inbox + fictional website | Scam | No |
| M2-S1 | **An Invoice Has Arrived** | Unexpected invoice with "call us now" number | 3 | Email + invoice view | Scam | Yes (paying the invoice) |
| M2-S2 | **The Laptop Purchase** | Genuine purchase from a fictional online store | 4 | Fictional storefront + checkout | **Legit** | Yes (paying is correct) |
| M3-S1 | **The Job Opportunity** | Recruiter's job offer with upfront "activation fee" | 5 | Job board + chat + payment request | Scam | Yes (paying the fee) |
| M3-S2 | **The Seller's Dilemma** | Buyer's fake "payment pending" confirmation and push to ship | 4 + 3 | Marketplace seller dashboard + email + chat | Scam | No (seller-side; the decision is whether to ship) |

The title-to-storyline pairing above is my mapping of the confirmed titles onto the draft storylines; it is confirmed
when the scenarios are authored. Decision options, evidence, and final content are authored per ARCHITECTURE §6 and
reviewed against R8–R17, R28–R30. Which of a module's two scenarios is suggested first is ranked by the deterministic
personalization algorithm in Step 8; slot keys, titles, and amounts never move.

## 4. Scenario experience

### 4.1 Flow
1. **Neutral intro (R9).** One line only, for example: "You've received a new message in your inbox." It contains no
   hints, warnings, or judgment words.
2. **Explore (R8).** The user explores an immersive, interactive fictional environment, such as an email client,
   chat, website, invoice, marketplace, or payment request. They can open messages, follow in-simulation navigation,
   inspect sender details, view the (non-functional) address bar, and so on.
   - No red-flag highlighting, hints, scores, or judgments appear during gameplay (R10).
   - All links are in-simulation navigation or inert. External fraudulent domains use reserved non-functional
     domains, such as `*.example`, `*.test`, and `*.invalid` (R28, R29).
   - Fake credential or OTP fields are inert. Nothing typed into them is transmitted or stored (R33).
3. **Decide.** The user commits one final decision from the scenario's fixed set (for example: pay, decline/ignore,
   verify independently through an official channel, report, ship, don't ship). Decisions are made **through actions
   native to the environment**: "Pay now" on an invoice, "Ship item" or "Message buyer" in a seller dashboard, "Block
   & report" in a chat, "Open the official app instead," and so on. The interface adapts to the activity and is never
   a question with a multiple-choice answer list. Before committing, a short confirmation step ("This will be your
   final decision") makes it clear the action is final. Nothing indicates whether the scenario is fraudulent or
   legitimate before this point.
4. **Pay (only if the decision is to pay and the scenario supports payment, R12).** A genuine PayPal **Sandbox**
   checkout runs for the server-calculated amount. If the user cancels the PayPal window, no decision is recorded and
   they return to exploring.
5. **Justify (R11).** The user writes why they made the decision (required, 20–1,000 characters). Once submitted,
   the decision and justification are locked.
6. **Feedback.** This shows:
   - Decision outcome (deterministic: whether the decision matches the answer key).
   - Fictional wallet impact (deterministic).
   - Reasoning assessment: which predetermined evidence the user's reasoning identified, with factual explanations
     (Gemini, grounded in the answer key, R13–R14).
   - A separate short, personalized, lighthearted comment (Gemini, R14).
   - The safest next step (authored).
7. **Reveal the Red Flags (R15, R16).** Available only after completion. The scenario environment is shown again in
   reveal mode, with each piece of evidence highlighted and labeled as one of:
   - **Red flag**: a warning sign.
   - **Worth verifying**: not proof of fraud by itself, but something to check independently.
   - **Positive verification**: evidence that supports legitimacy.

   Each item has an explanation. Items the user cited in their reasoning are marked.
8. **Recovery Playbook.** The results screen ends with the Your Recovery Playbook sections relevant to this
   scenario (authored and verified, §6), with a link to the full Playbook.

### 4.2 Feedback tone
Praise first, explanation second. Misses use "Look again" framing with a yellow tint and a flag icon, and correct
answers use teal with a tick, per the brand guide. Never scold (R37). Meaning is always carried by an icon and words,
never by color alone.

### 4.3 Attempts and replays
- An in-progress attempt is resumed, never duplicated (at most one unfinished attempt per scenario).
- The **first completed attempt** of each scenario is the scored one: it counts for progression, the module score,
  the Training Funds ledger, and reports.
- Completed scenarios can be **replayed** at any time. A replay is a **full new practice attempt**, not a review of
  old answers (product decision, Step 5 review). The player can reopen the scenario, explore the whole environment,
  inspect evidence, perform verification actions, make a new decision, write a new justification, complete a
  **genuine PayPal Sandbox checkout again** if they choose to pay, and receive fresh Gemini feedback, a new witty
  comment, Reveal the Red Flags, the Recovery Playbook, and Sensei Kenshi follow-ups for that attempt.
- Each replay has its own attempt ID and is clearly labelled a **practice attempt**. Its decision, justification,
  feedback, score, and any Sandbox order/capture are stored as separate records.
- Replays never: replace the original attempt; change the official scenario or module score; change progression or
  unlocks; change badges or certificates; produce a second completion reward; deduct from or rewrite the official
  Training Funds ledger. A replay's Sandbox payment is recorded for learning and audit (with its own order and
  idempotency identifiers, verified outcome, and spending/scam-loss classification), outside the official ledger.
  Cancelled or failed payments are never recorded as successful. Live PayPal is never used.
- Only one unfinished attempt per scenario exists at a time; starting again resumes it.

### 4.4 Scoring (deterministic, 100 points per scenario)
| Component | Points | How it is decided |
|---|---|---|
| Decision | 40 | The committed decision is one of the answer key's correct decisions (all or nothing) |
| Reasoning | 30 | Weighted share of the answer key's evidence that the written reasoning addressed (R13). Gemini only proposes evidence IDs, validated against the answer key; the keyword fallback does the same when Gemini is down |
| Verification behavior | 20 | Weighted share of the scenario's verification actions the user performed in the environment (e.g. checking a sender address), recorded by the engine and never hinted during play |
| Payment safety | 10 | Full points unless the user took one of the scenario's unsafe payment or credential actions |

Totals: 200 per module and 600 overall, shown on the dashboard as "Total score". Scores are computed by
`src/lib/domain/scoring.ts` and stored immutably with a scoring version. No AI assessment is invented: until Phase 6
there is no evaluator, so no score is produced outside tests. XP levels and streaks remain out of scope (§11).

## 5. Training funds (fictional wallet) — R18–R20

- Always labelled **Training Funds**, never "PayPal balance". Fictional money, independent of any PayPal account.
- These amounts are **fictional educational Training Funds**. They do not represent the user's actual income,
  disposable income, bank balance, or financial capacity.
- **Starting budget** (same rule for every module, recalculated when each module starts) from the optional income
  bracket (`src/content/trainingFunds.ts`). Values are a **USD baseline**, approved by the product owner (provisional,
  Step 5 review):

  | Income bracket (monthly, US$ ranges) | Starting Training Funds (USD baseline) |
  |---|---|
  | Skipped / "Prefer not to say" | **3,000** (default) |
  | Under 1,000 | 500 |
  | 1,000–2,499 | 1,750 |
  | 2,500–4,999 | 3,750 |
  | 5,000–9,999 | 7,500 |
  | 10,000 or more | 10,000 |

  Rule: roughly one month at the bracket midpoint (the lower bound for the top bracket).
- **Other currencies (§5.1):** the USD baseline is converted at a fixed, documented reference rate and rounded to whole
  units of that currency. The same number is never reused across currencies (US$3,000 is not £3,000).
- The user explicitly starts a module ("Start module N"), which snapshots the currency and amount and writes the
  opening ledger entry. Profile edits apply from the next module start.
- Every scenario has a predefined **percentage** of the module's starting funds (initial values, tunable in
  `src/content/modules.ts`): M1-S1 5%, M1-S2 8%, M2-S1 10%, M2-S2 12%, M3-S1 15%, M3-S2 20%. The scenario engine
  (never Gemini) computes amount = round-half-up(startingFunds × percent) in integer minor units at the currency's
  PayPal precision (R19, R38).
- The wallet is an append-only **ledger**: a module-start credit, then at most one payment per scored attempt
  (idempotent, no duplicate deductions, never below zero). The balance is always the sum of the entries.
- Payments are recorded as "awaiting results" during play (nothing reveals legitimacy, R10) and classified at
  completion as **ordinary spending** or **lost to a scam**. The two are always reported separately.
- When the user pays in a scenario:
  - A PayPal Sandbox order is created and captured for that amount (a Sandbox test account; no real money).
  - The fictional wallet is debited by the same amount, independently of any PayPal balance (R18).
- What the payment is "worth" in the debrief is deterministic and authored. In a scam scenario the money is lost in the
  story. In the legitimate scenario the user receives the item, so the payment is a successful purchase. The UI never
  claims real-world refund outcomes (R30).
- Replays never touch the official ledger (§4.3).
- At the start of the next module, the wallet resets to that module's starting funds (R20). Earlier module ledgers
  stay preserved and appear on the dashboard and in reports.

### 5.1 Currency
- **Selectable currencies: USD only, for now.** Only currencies confirmed to work with the configured PayPal Sandbox
  merchant and Checkout integration may be offered. None has been verified yet (PayPal credentials arrive in Phase 5),
  so USD is the only option; the server, the API, and the database all enforce this. Each further currency is enabled
  only after an end-to-end Sandbox test.
- **Conversion (ready for when more are enabled):** fixed European Central Bank euro reference rates (reference date
  2026-11-06), stored centrally in `src/content/exchangeRates.ts` with the source URL. USD → X uses the cross rate,
  integer arithmetic, and half-up rounding: starting funds to whole units of X; scenario amounts to X's PayPal minor
  unit (0 decimals for HUF/JPY/TWD). No live FX API. Example: US$3,000 → £2,241 or €2,687.
- One currency per module: it is snapshotted when the module starts and used for the dashboard, scenario amounts,
  ledger, PayPal Sandbox order, and report. Changing the preference never changes an active module; it applies from
  the next module start.

## 6. Your Recovery Playbook (R21, R30)

A static, authored, U.S.-specific section that explains what to do if you have been scammed while using PayPal.
For example: how to report unauthorized activity, how the Resolution Center or disputes work, what Purchase Protection
and Seller Protection do and don't cover, securing your account, and when to contact law enforcement or federal
reporting channels.

- Each statement is transcribed from official PayPal U.S. sources, includes the source URL, and is labeled "last
  verified on [date]."
- Gemini never generates or rewrites policy facts. When uncertain, the content directs users to PayPal's official Help
  Center.
- There are no refund guarantees, invented timelines, or fraud statistics.
- Feedback screens link to the relevant Playbook sections.

## 7. Sensei Kenshi — AI learning chatbot (R22, R23)

- Available as a dedicated page and a floating panel on authenticated pages.
- Answers questions about: completed scenarios, general scam awareness, and PayPal-related topics.
- **Gameplay integrity:** while a scenario is in progress, Sensei Kenshi receives no answer-key data and declines to
  give hints about the active scenario (R10). After completion, it may discuss that scenario's evidence.
- PayPal policy answers are grounded only in Recovery Playbook content, with links. Otherwise it points to PayPal's
  official Help Center (R30).
- There is no separate intent classifier. One system prompt defines scope and politely redirects off-topic
  questions.
- If Gemini is unavailable, it shows a friendly fallback message with links to the Playbook and the user's results
  (R27).

## 8. Module completion (R24–R26)

When both scenarios in a module are completed:
1. **Badge.** The module's badge appears on the dashboard: Scam Spotter (Module 1), Fraud Detective (Module 2),
   ScamSense Guardian (Module 3).
2. **Certificate preview.** An on-screen certificate shows the user's name, module, completion date, and a
   certificate ID. It cannot be downloaded directly (R25).
3. **Email certificate (optional).** The user can enter an email address, and the server sends the certificate data
   to a Zapier webhook, which emails the certificate. If Zapier is unavailable, the user sees a calm "couldn't send
   right now, try again later" message, and the rest of the app still works (R27).
4. **Analysis report (downloadable PDF, R26).** It is generated server-side and covers: decisions, justification
   summaries, evidence identified versus missed, the training-funds ledger for the module, key lessons, and links to
   the Recovery Playbook. It uses only stored data. If AI text is missing, deterministic text is used.

The next module unlocks at the same time (R7).

## 9. Dashboard

The dashboard shows: a welcome message; the current module with its scenario statuses; overall progress (scenarios
completed of 6, the screen's yellow highlight); total score (of 600); modules completed; badges; current Training
Funds (balance, starting amount, spending, losses, awaiting results, or a preview of the next module's funds before
it starts); every module card (available, in progress, completed, or locked with the reason); the user's financial
goal; certificate and report access per module; past module results (score, closing balance, spending vs losses,
kept after later resets); and entry points to Sensei Kenshi and the Recovery Playbook. On small screens a compact
Training Funds strip sits at the top and the cards stack.

## 10. Graceful degradation (R27)

| Dependency down | Behavior |
|---|---|
| Gemini (personalization) | Scenario uses authored default surface text |
| Gemini (evaluation) | Deterministic evidence matching plus authored explanations, with a neutral fallback comment instead of humor |
| Gemini (chat) | Friendly fallback message with links |
| Zapier | Certificate stays visible on screen, and the email can be retried |
| PayPal Sandbox | The payment step shows "Sandbox checkout unavailable." The user can retry or choose another decision. No payment is faked as a PayPal transaction. |

## 11. Out of scope (MVP)
Live PayPal payments, real account linking, scanning real messages, leaderboards, social features, XP levels and
streaks (shown in the brand mockups, but not part of this product; a plain points total is in scope, §4.4),
non-U.S. recovery policies, multiple languages, and admin CMS.

## 12. Open questions (need product-owner confirmation)
1. ~~Starting training-funds amount~~ Resolved: USD baseline 3,000 default and 500 / 1,750 / 3,750 / 7,500 / 10,000
   per bracket, provisionally approved by the product owner (Step 5 review).
2. ~~Replays~~ Resolved: full practice attempts, including a new genuine Sandbox checkout, kept off the official
   record (§4.3).
3. ~~Payment percentages~~ Initial values set in Step 5 (§5); tune them with the authored scenarios. A scenario whose
   story has no payment simply never uses its amount.
4. The final six scenario storylines (§3.3 is a draft).
5. ~~Budget in other currencies~~ Resolved: USD baseline converted at fixed reference rates (§5.1).
6. Which additional PayPal currencies to enable once the Sandbox merchant is tested (Phase 5 / Step 7). Currently
   enabled: **USD only**. Candidates with reference rates ready: AUD, CAD, EUR, GBP and others the ECB publishes.
7. Confirm the title-to-storyline pairing in §3.3.
