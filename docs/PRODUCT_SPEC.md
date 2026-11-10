# ScamSense — Product Specification

Status: updated for Step 11 (module rewards, certificates, analysis reports, Zapier certificate email; earlier: Step 9 Reveal the Red Flags + Your Recovery Playbook; earlier: Step 8 hybrid routing, Gemini personalization, Gemini reasoning evaluation). This is the functional source of truth. It must stay consistent with the
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
| 1 About you | Occupation description | **Required only when "Other"** (Step 8) | free text 3–80 chars, must contain letters; cleared when another option is chosen |
| 1 About you | Country of residence | Yes | ISO 3166-1 alpha-2 code |
| 2 Activities | Financial activities | Yes (≥1) | `online_shopping`,`online_selling`,`freelance_payments`,`sending_invoices`,`receiving_invoices`,`job_applications`,`business_purchases`,`subscription_payments`,`investments`,`digital_wallet_usage`,`other` (Step 8) |
| 2 Activities | Other activity description | **Required only when "Other"** (Step 8) | free text 3–160 chars; cleared when "Other" is unticked |
| 2 Activities | Digital payment experience | Yes | `new`,`occasional`,`frequent` |
| 3 Goals | Financial goal | Yes | `buying_laptop`,`vacation_travel`,`building_savings`,`education`,`business_growth`,`paying_off_debt`,`other` |
| 3 Goals | Custom goal details | **Required when the goal is "Other"**, optional otherwise (Step 8) | free text ≤120 chars (3+ with letters when required) |
| 3 Goals | Goal amount | Optional | integer minor units of the preferred currency |
| 3 Goals | Monthly income bracket | Optional | `prefer_not_to_say`,`under_1000`,`1000_2499`,`2500_4999`,`5000_9999`,`10000_plus` (USD ranges) + derived display label. Never an exact income |
| 3 Goals | Preferred currency | Yes (default **USD**) | Server-validated allowlist of currencies verified with the configured PayPal Sandbox merchant (R4). **Currently USD only** (§5.1, ARCHITECTURE §9) |

The profile is used only to personalize scenario surface details, feedback wording, goal-based humor, illustrative
training budgets, the routed order of a module's two scenarios, and the chatbot. It never changes answer keys,
correctness, or difficulty (R13). No bank balances or account information are collected.

**Step 8 inspection result (before the change):** occupation "Other" and goal "Other / custom goal" existed; a custom
goal text existed but was optional even for "Other"; there was **no** occupation description, **no** "Other"
financial activity, and **no** activity description. All three are now implemented as above, in onboarding (same three
steps) and on My Profile, validated in the browser, the API (Zod, with Unicode normalization and markup characters
removed), and the database (`20261112090000_hybrid_intelligence.sql`). Free text is always treated as untrusted data.

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

### 3.3 Scenario lineup (authored in Step 6; storylines await owner review)
The six scenarios together cover all five categories and include one **legitimate** scenario (R17). Titles and the
one-line introductions are shown to players; everything else in this table is internal and never shown before
completion (R10). All organisations are fictional; TandemPay is the fictional payment app used inside the stories
(real PayPal UI appears only in the Sandbox checkout, R34).

| Slot | Title | Neutral introduction | Environment | Category | Truth | Payment decision |
|---|---|---|---|---|---|---|
| M1-S1 | **The Security Check** | "You receive a message about your payment account." | Chat (Messages + TandemPay app) | 1 (+3) | Scam | No (sharing the code is the unsafe choice) |
| M1-S2 | **Your Account Needs Attention** | "You receive a notification about your account." | Email + fictional browser (spasebank.example vs spacebank.example) | 2 (+1) | Scam | No |
| M2-S1 | **An Invoice Has Arrived** | "A new invoice has arrived in your inbox." | Invoice (mail, invoice viewer, supplier portal) | 3 (+2) | Scam | Yes: "Pay invoice" |
| M2-S2 | **The Laptop Purchase** | "You've found a laptop that fits your budget." | Marketplace (buyer) | 4 | **Legit** | Yes: "Place order" (correct) |
| M3-S1 | **The Job Opportunity** | "You've received an update about a job opportunity." | Chat/email + browser | 5 (+3) | Scam | Yes: "Pay request" (equipment deposit) |
| M3-S2 | **The Seller's Dilemma** | "A buyer has contacted you about an item you're selling." | Marketplace (seller hub) + mail + TandemPay | 4 (+3, +2) | Scam | No (the decision is whether to ship) |

Final content lives in `src/content/scenarios/<key>/` (render + server-only answer key).

### 3.4 Scenario order within a module (Step 8, hybrid routing)
When a module starts, its two scenarios are ranked by a deterministic relevance score and the order is saved once for
that learner and module (ARCHITECTURE §19). The first is shown as recommended ("Ordered for you"); **both remain
required** and either can still be played first. Refreshes, new sign-ins, profile edits, and replays never change a
saved order. Gemini never chooses scenarios: for a meaningful custom "Other" description it only maps the meaning onto
the approved tag vocabulary, which the formula then uses. A custom goal never affects the order. Scores are relevance
to reported activities, never a probability of being scammed, and age is never an input.

## 4. Scenario experience

### 4.1 Flow
1. **Neutral intro (R9).** One line only, for example: "You've received a new message in your inbox." It contains no
   hints, warnings, or judgment words. Since Step 8 it is personalized by Gemini for each learner (for example "You're
   browsing a laptop listing suitable for your digital art commissions."), validated against the scenario's real
   setting, and replaced by the authored line whenever validation fails.
2. **Explore (R8).** The user explores an immersive, interactive fictional environment, such as an email client,
   chat, website, invoice, marketplace, or payment request. They can open messages, follow in-simulation navigation,
   inspect sender details, view the (non-functional) address bar, and so on.
   - No red-flag highlighting, hints, scores, or judgments appear during gameplay (R10).
   - All links are in-simulation navigation or inert. External fraudulent domains use reserved non-functional
     domains, such as `*.example`, `*.test`, and `*.invalid` (R28, R29).
   - Fake credential or OTP fields are inert. Nothing typed into them is transmitted or stored (R33).
3. **Investigate.** Inspecting and verifying (sender details, the address bar's site information, a saved
   bookmark, the payment app's activity, a seller profile, questions in a chat) are actions inside the environment.
   They are recorded for the verification score and never end the scenario on their own.
4. **Decide.** The user commits one final decision from the scenario's fixed set through a control native to the
   environment ("Pay invoice", "Place order", "Mark as shipped", "Block and report", "Report message", "Start
   verification" on a page). The interface is never a question with an answer list. A confirmation ("This will be
   your final decision") lets the user go back and keep exploring; confirming locks the decision. Nothing indicates
   whether the scenario is fraudulent or legitimate before this point.
5. **Explain (R11).** The user then answers a question that depends on the decision (for example "What made you feel
   comfortable proceeding with this payment?", "What made you believe this request was suspicious?", "What convinced
   you that the payment had been received?"), 20–1,000 characters, reviews it, and submits. Decision and explanation
   are now locked. **Decision change (Step 6):** the explanation now comes **before** any payment.
6. **Pay (only for a pay decision, R12).** A genuine PayPal **Sandbox** checkout runs for the server-calculated
   amount: the official PayPal button (JavaScript SDK v6, Sandbox) opens PayPal's own window, the buyer approves with
   a Sandbox Personal account, and the server captures and verifies the payment before anything is recorded (Step 7).
   The ScamSense Sandbox merchant receives the test money; the fictional payee appears only in the scenario. If the
   user cancels, closes PayPal, or the payment is declined, nothing is paid and the Training Funds are untouched; the
   user can return to checkout (a new order) or finish without paying (the attempt is then finalized as "pay
   decision, no payment made"). A capture PayPal still reports as pending is not counted until it completes. The
   decision and explanation stay locked either way. After a verified payment the player sees the Sandbox amount,
   capture ID and order ID, and (scored attempt) the Training Funds deduction; the attempt waits for evaluation
   (Step 8). Payment-enabled scenarios: M2-S1, M2-S2, M3-S1 (§3.3).
7. **Feedback** (Step 8, implemented). Once the attempt is FINALIZED the player sees "Reviewing your reasoning…" while
   ONE Gemini request evaluates their written explanation; the attempt then completes and the results page shows:
   - Decision outcome (deterministic: whether the decision matches the answer key) and the story outcome (authored).
   - The score (deterministic, §4.4); practice attempts are labelled and never official.
   - Fictional wallet impact (deterministic), and that the PayPal payment was Sandbox test money only.
   - Feedback on the reasoning (Gemini, grounded in the answer key): what they did well, assumptions to double-check,
     their checking, their payment behaviour, what to do next time; evidence they noticed vs. worth a second look.
   - A separate short, personalized, witty comment ("Just for fun"), generated in the same request (R14).
   - A takeaway and the safest next step (authored).
   - Links to Reveal the Red Flags and Your Recovery Playbook (Step 9), plus a debrief navigation bar:
     Results → Reveal the Red Flags → Your Recovery Playbook → Module dashboard.
   If Gemini fails, nothing is invented: the learner can try again, or choose clearly labelled basic feedback (authored
   text + keyword check; a fixed encouragement line instead of a joke). Evaluation never repeats a payment.
8. **Reveal the Red Flags (R15, R16; Step 9, implemented)** at `/play/[attemptId]/review`. Only for the owner's
   COMPLETED attempt (an unfinished attempt goes back to the player; another user's attempt is not found). The learner's
   own scenario is shown again (the same apps and the same personalized narrative, never regenerated) in a
   **read-only review state**: they can switch apps, open conversations, emails, pages, tabs and orders, and follow
   in-simulation links, but nothing is recorded, decisions are disabled, and nothing can start a checkout or change a
   decision, explanation, payment, Training Funds, score, progression, badge or certificate. Content the learner never
   opened (for example a reply they didn't choose) is shown too, and its explanation says so.
   - Each authored piece of evidence is outlined on its stable anchor and gets a **numbered marker** (a real button).
     Selecting a marker (or a number in the legend / evidence guide) opens the right app and panel, scrolls the element
     into view, and opens ONE explanation at a time (title, type, explanation; Previous/Next; Close or Escape).
   - The three types are distinguished by words, icon, and border style, never colour alone: **Red flag** (yellow
     marker, solid outline), **Worth verifying** (white marker, dashed outline: not proof of fraud on its own),
     **Positive verification** (teal marker, double outline: supports legitimacy).
   - Titles and explanations come only from the server-side answer key. Separately, "Your reasoning" says whether the
     stored Step 8 evaluation found the item **mentioned**, **missed** (worth a second look), or not mentioned;
     unsupported assumptions from the feedback are listed apart. Opening the review never re-evaluates or rescores.
   - The legitimate scenario (M2-S2) has no red flags: positive evidence plus details worth verifying, with copy saying
     unfamiliar doesn't mean fraudulent.
9. **Your Recovery Playbook (Step 9, implemented)** at `/play/[attemptId]/playbook`; see §6.

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
`src/lib/domain/scoring.ts` and stored immutably with a scoring version. Since Step 8 the evidence IDs come from the
Gemini evaluation (unknown IDs discarded) or, only after a Gemini failure and the learner's choice, from the keyword
fallback; Gemini never returns or sets points. A pay decision finalized without a completed payment ("finish without
paying") is scored as the decision chosen (resolves open question 10). XP levels and streaks remain out of scope (§11).

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
- When the user pays in a scenario (Step 7):
  - A PayPal Sandbox order is created and captured for that amount (a Sandbox test account; no real money).
  - Only after the server verifies a COMPLETED capture of exactly that amount is the fictional wallet debited by the
    same amount, once, independently of any PayPal balance (R18). Cancelled, declined, failed, or still-pending
    payments never change the Training Funds.
  - PayPal payment status and the fictional spending/scam-loss meaning are stored separately. A completed Sandbox
    capture never means PayPal judged anything to be fraud or eligible for Purchase Protection.
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

## 6. Your Recovery Playbook (R21, R30; Step 9)

Education about what to do after a comparable real-world incident, linked to official U.S. PayPal pages. It is not a
fraud investigation, dispute service, legal service, or promise of reimbursement, and says so on every page.

### 6.1 Per-attempt Playbook (`/play/[attemptId]/playbook`, completed attempts only)
Six parts, labelled "Based on U.S. PayPal policies. Eligibility and terms apply.":
1. **What happened**: the lesson, the learner's decision and its authored story outcome, any Sandbox payment (test
   money; Training Funds are fictional), and framing that depends on whether the decision was appropriate.
2. **What you could do**: ordered steps, each either a *ScamSense practice tip* (a general safety habit, never a PayPal
   rule) or a *verified PayPal fact* quoted with its source link and verification date.
3. **How PayPal may help** and 5. **Official guidance**: the selected policy records as cards: key points, "To be
   eligible", "How it works", and "Not covered or not counted" (verbatim unless labelled a summary), with the source
   link, verification date, and the page's own "Last updated" date. A record that couldn't be verified would show only
   its link as "Not yet verified" (none at present).
4. **Conditions and limitations** (expandable): the distinctions that apply: unauthorized vs. a payment you were
   tricked into approving; reporting a message vs. reporting a payment; protection programs aren't guarantees; a
   payment claim isn't a payment (sellers); a problem with a genuine purchase isn't fraud; Sandbox checkout isn't real
   coverage; Training Funds aren't real money; education, not a case decision.
6. **Prevention**: the scenario's authored key lessons.

Optional **personal note** (Gemini): 2–3 sentences linking the learner's decision to the lesson, plus up to three
existing step IDs to show first. It may not mention PayPal or any protection, dispute, refund, eligibility, coverage,
deadline, number, link, or statistic (rejected otherwise). It is generated once per attempt and stored, so revisits
never call Gemini. Without Gemini, or before the Step 9 migration is applied, the authored Playbook is shown unchanged.

### 6.2 Policy knowledge base and scenario mapping
Versioned content in `src/content/playbook/policies.ts` (`POLICY_KB_VERSION`), one record per official page: policyId,
topic, jurisdiction (US), sourceUrl, effectiveDate (null unless printed), lastVerified, lastChecked, verification
status/note, pageUpdated (the "Last updated" date the page prints), factual summary, eligibility conditions,
procedures, exclusions (+ a note when the page lists more; verbatim quotes flagged), relevant scenarios. Help Center
companions `purchase-protection-help` and `seller-protection-help` are in the knowledge base (public `/playbook` and
Sensei Kenshi); the per-scenario mapping below is unchanged.
An unverified record may carry **no** policy content (schema + tests). The scenario mapping is deterministic
(`scenarios.server.ts`): core ∪ when-paid ∪ when-decision-not-appropriate.

| Scenario | Core policies | + when paid | + when not appropriate |
|---|---|---|---|
| M1-S1 Security Check | report-suspicious-messages, report-fraud, user-agreement | — | report-unauthorized-help |
| M1-S2 Account Needs Attention | report-suspicious-messages, report-fraud | — | report-unauthorized-help, user-agreement |
| M2-S1 Invoice | report-suspicious-messages, report-fraud, purchase-protection, user-agreement | dispute-filing-timeframes | — |
| M2-S2 Laptop (legitimate) | purchase-protection, dispute-filing-timeframes | — | — |
| M3-S1 Job | report-suspicious-messages, report-fraud, purchase-protection, user-agreement | dispute-filing-timeframes | — |
| M3-S2 Seller | seller-protection, report-suspicious-messages, report-fraud | — | — |

### 6.3 Source verification (re-verified 2026-11-10)
The 2026-11-09 automated pass got HTTP 403 from five pages. An HTTP 403 to one automated request isn't evidence that
a policy is unavailable or invalid, so the pages were requested again on 2026-11-10 (browser-like request headers,
plus the alternative official URLs the product owner supplied). **All nine official pages loaded and were read.** Every
item marked as a verbatim quote (75 items) was then checked automatically against the downloaded page text (exact match
after normalizing whitespace and curly quotes); the 15 summary items were checked by hand. Nothing scrapes PayPal at
runtime: the app only reads the curated records.

| Record (topic) | Official source | Page date | Status |
|---|---|---|---|
| report-suspicious-messages (phishing) | /us/security/report-suspicious-messages | none printed | Verified 2026-11-10 (text-message steps corrected: the page now also lists "Tap More and then the Forward arrow" and "Tap Send") |
| report-fraud (unauthorized) | /us/security/report-fraud | none printed | Verified 2026-11-10 (unchanged) |
| report-unauthorized-help (unauthorized) | /us/cshelp/article/…-help136 | none printed | Verified 2026-11-10: reporting steps, 10-day email, check family/subscriptions first |
| user-agreement (unauthorized) | /us/legalhub/paypal/useragreement-full, section "Liability for Unauthorized Transactions and Other Errors" only | Last updated November 4, 2026 | Verified 2026-11-10: definition, what isn't unauthorized, "tell us at once", 60-day statement rule |
| purchase-protection (purchase) | /us/legalhub/paypal/buyer-protection (also ?locale.x=en) | Last updated January 26, 2026 | Verified 2026-11-10: scope, eligibility (6 requirements), dispute→claim steps, selected exclusions, card-issuer choice |
| purchase-protection-help (purchase) | /us/cshelp/article/…-help364 | none printed | Verified 2026-11-10 |
| seller-protection (seller) | /us/legalhub/paypal/seller-protection (also ?locale.x=en_US) | Last updated January 26, 2026 | Verified 2026-11-10: scope, basic requirements, redirect rule, proof of delivery, selected exclusions |
| seller-protection-help (seller) | /us/cshelp/article/…-help156 | none printed | Verified 2026-11-10 |
| dispute-filing-timeframes (Resolution Center) | /us/cshelp/article/dispute-filing-timeframes-help1173 (same article at pep.paypal.com) | none printed | Verified 2026-11-10: 180-day INR, 30/180-day SNAD, unauthorized "at once", 60-day other errors |

Exclusion lists are curated selections; each card says the page lists more and links to it. Summaries are labelled
"(summary of the page)" on screen. Re-verify these pages whenever PayPal updates them (the legal pages print a
"Last updated" date, stored as `pageUpdated`), then bump `POLICY_KB_VERSION`.

### 6.4 Public Playbook (`/playbook`)
The whole knowledge base grouped by topic, with the same cards, labels, and general limitations.

## 7. Sensei Kenshi — AI learning chatbot (R22, R23)

Implemented in Step 10 (technical details: ARCHITECTURE §21).

- **Who he is:** a calm, encouraging, slightly playful mentor with a subtle samurai-inspired identity (a topknot in
  his avatar; no exaggerated speech or stereotypes). He supports learning through mistakes and never shames. He is not
  PayPal, a PayPal representative, a financial or legal adviser, or a fraud-investigation service, and never asks for
  passwords, codes, card or bank details.
- **Where he appears:** a "Sensei Kenshi" card on the dashboard, the `/sensei` page, and "Ask Sensei Kenshi" on the
  Results, Reveal the Red Flags, and Recovery Playbook pages of a completed attempt (opened already focused on that
  attempt, labelled original or practice). He is **not** available on the scenario player (investigation, decision,
  justification, Sandbox checkout): the primary-nav "Sensei Kenshi" item is hidden there and there is no widget. He is
  not shown as a floating widget on module pages.
- **What he answers:** scam awareness, fraud tactics, phishing and impersonation, fake invoices, marketplace, job and
  advance-fee scams, safe payments and verification, the learner's completed scenarios (what happened, what they did,
  what they wrote, what the stored feedback said, the score), and U.S. PayPal reporting, dispute, and protection
  mechanisms. Off-topic questions get a short, kind explanation of what he can help with.
- **Gameplay integrity (R10), enforced on the server:** he can only see the learner's own COMPLETED attempts.
  Unfinished or locked scenarios are known to him by title only, so he can't reveal whether they are scams, their
  evidence, or the right decision, whatever the learner types (repeated asking, role-play, "developer mode"). He says
  something like "I can't reveal the outcome of a scenario you haven't completed yet" and offers general verification
  advice. Asking the API about an unfinished attempt is refused; another user's attempt doesn't exist for you.
- **Completed scenarios:** from the dashboard he can summarize each completed scenario's original attempt; from a
  debrief page he discusses exactly that attempt (a replay uses its own actions, explanation, feedback, and practice
  score, never the original's). He never invents actions, checks, or earlier feedback, and describes the legitimate
  scenario as genuine.
- **PayPal policy (R21, R30):** grounded only in the Step 9 verified U.S. knowledge base; official source links are
  shown under the answer, with "verified on" or "not yet verified" labels. For an unverified page he would only point
  to the official page. No refund promises, eligibility claims about the learner's own case, or statistics; a
  deadline may be repeated only exactly as a retrieved verified fact states it (the reply guard rejects any other
  number of days). When the knowledge base doesn't cover a question he points to the PayPal Help Center.
- **Chat:** greeting, suggested questions (general vs. scenario; static, no AI call), Gemini follow-up suggestions after
  a reply, typing indicator, Enter to send / Shift+Enter for a new line, switch between general questions and a
  completed scenario. Conversations are not stored and disappear when the panel closes.
- There is no separate intent classifier (R23). One Gemini request per question.
- If Gemini is unavailable or busy, he shows a friendly "try again" message (retry keeps the same question) with links
  to the Recovery Playbook and the attempt's results (R27). He never shows a made-up reply.

## 8. Module completion (R24–R26; Step 11)

When both ORIGINAL scenarios in a module are completed (replays never count), in the same database transaction:
1. **Module score.** Frozen as the sum of the two original scenario scores (out of 200). Individual scenario scores
   stay as they were.
2. **Badge.** Scam Spotter (Module 1), Fraud Detective (Module 2), ScamSense Guardian (Module 3): ScamSense learning
   badges, never presented as PayPal awards. Shown on the dashboard, My Profile, the Certificates page, and the
   completion page (rosette design; locked badges say "Not earned yet" in words).
3. **Next module unlocks** (R7).
4. **Certificate.** Exactly one per module, with a stable random ID (e.g. `SS1-7F3A-91C2-0B4E`), the learner's display
   name and the module title (snapshots at completion), and the completion date. It is shown on screen
   (`/modules/[key]/complete`, also reachable from Certificates) and can be reopened any time. It has no download
   button (R25). Disclaimer on the certificate: it recognizes completion of an educational ScamSense simulation and
   is not a PayPal certification, endorsement, or accreditation.
5. **Analysis report (downloadable PDF, R26).** "Download Analysis Report" on the completion and Certificates pages.
   Contents: name, module, completion date, certificate ID, module score and scenario scores, recorded decisions,
   an excerpt of each written explanation with the stored feedback summary, evidence identified, important evidence
   missed, unsupported assumptions, verification actions done and not done, Training Funds start/end, legitimate
   spending vs. fictional scam losses, stored improvement advice and takeaways, key lessons, and official references.
   It uses only stored results (no new Gemini call), original attempts only, and states clearly that Training Funds
   are fictional and payments were PayPal Sandbox tests. Repeat downloads change nothing.
6. **Email certificate (optional).** The learner enters an address; the server sends the certificate details and a
   24-hour private link to the PDF to the existing Zapier workflow, which emails it from
   scamsense.certificates@gmail.com with the PDF attached. Statuses: not requested; sending; "Your certificate email
   request has been submitted." (Zapier accepted it; ScamSense can't confirm delivery and never says "delivered");
   or a calm failure with "Try again". Network retries and double clicks never send twice; "Send again" is allowed;
   at most 5 requests per certificate per hour.

Revisiting, refreshing, replaying, or retrying never creates a second badge or certificate and never changes scores,
Training Funds, or progression. If Zapier is down, the badge, certificate preview, and report are unaffected (R27).

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
| Gemini (routing) | Predefined tags only; custom text gets neutral context (nothing is guessed); the order is still saved |
| Gemini (personalization) | Scenario uses the authored story details, stored as a tracked fallback; play continues |
| Gemini (evaluation) | Attempt stays FINALIZED with everything saved; "Try again", or clearly labelled basic feedback (authored explanations + keyword matching, a fixed encouragement line instead of humor) |
| Gemini (Recovery Playbook note) | No note; the authored Playbook (steps, verified facts, links) is shown unchanged. After a real failure a fallback is stored, so it isn't retried on every visit |
| Gemini (chat) | Friendly fallback message with links |
| Zapier | Certificate stays visible on screen, the report still downloads, and the email can be retried ("We couldn't send your certificate right now") |
| PayPal Sandbox | The payment step shows "Sandbox checkout unavailable" (missing credentials) or "couldn't confirm with PayPal yet, check again" (outage or lost response). The user can cancel, retry, or finish without paying (the decision stays locked). Checking again reads the order and never charges twice. No payment is faked as a PayPal transaction. |

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
4. The six scenario storylines are authored (§3.3); owner review pending.
5. ~~Budget in other currencies~~ Resolved: USD baseline converted at fixed reference rates (§5.1).
6. Which additional PayPal currencies to enable. Step 7 verified **USD** end to end with the Sandbox merchant (real
   orders created and read back); no other currency has been tested, so **USD remains the only enabled currency** and
   checkout refuses any other (`unsupported_currency`). Candidates with reference rates ready: AUD, CAD, EUR, GBP.
7. ~~Title-to-storyline pairing~~ Implemented as in §3.3 (Step 6 brief).
8. M3-S2 uses the fictional TandemPay wallet for the buyer's claimed payment instead of naming PayPal inside the fake
   confirmation, because simulated fraudulent interfaces must use fictional organisations and must not imitate
   PayPal (R29, R34). The debrief can connect it to PayPal. Confirm this is acceptable.
9. At the lowest Training Funds level (US$500), M2-S2's laptop costs US$60 (12%). The whole market is priced
   relative to it so it never looks "too cheap", but the absolute price is unrealistic. Consider a minimum amount.
10. ~~"Finish without paying" scoring~~ Resolved in Step 8: scored as the decision chosen (§4.4); no ledger entry.
11. No MVP scenario targets the "investments" or "sending invoices" activities; routing falls back for them.
12. (Step 7) In PayPal's window the buyer sees the ScamSense Sandbox merchant, not the fictional payee (real PayPal UI
   must not impersonate a fictional or real third party). The checkout panel says so. Confirm this is acceptable.
13. ~~Generated intros~~ Resolved (owner decision, 2026-11-13): Gemini personalizes the neutral one-line introduction
   of every newly played scenario, in the same personalization request. Each intro is checked against the scenario's
   authoritative setting (channel, roles, situation: e.g. a marketplace must stay an ONLINE marketplace) and for
   spoilers, hints, instructions, invented names, digits, and links; a rejected intro falls back to the authored one.
14. ~~Results states~~ Approved (owner decision, 2026-11-13): REVIEW_AVAILABLE and RECOVERY_AVAILABLE are reached
   automatically with the feedback; the Reveal the Red Flags and Recovery Playbook screens arrive in Step 9.
15. ~~M1-S2 routing tag~~ Approved (owner decision, 2026-11-13): M1-S2 keeps the `subscriptions` routing tag.
16. ~~(Step 9) Human policy verification needed~~ Resolved 2026-11-10: all nine official pages were read and the
   quotes checked automatically (§6.3). Still recommended: a person skims the 15 summary items and the curated
   exclusion selections against the live pages.
17. (Step 9) The authored Playbook steps and limitation texts (`src/content/playbook/`) await owner review.
18. (Step 9) The review also shows content the learner never opened (e.g. unchosen chat replies) so every piece of
   evidence can be inspected; it is labelled "You didn't open this part during your attempt". Confirm this is acceptable.
19. (Step 10) Sensei Kenshi conversations are not stored (no `chat_messages` table, no history across visits). Confirm
   this is acceptable, or whether learners should see recent conversations again.
20. (Step 10) Kenshi's avatar is an original SVG drawn in the brand icon style (teal outline, yellow topknot tie). A
   commissioned character illustration could replace it; owner review pending.
21. (Step 11) The certificate keeps the display name from the moment of completion; later profile name changes don't
   rewrite issued certificates. Confirm this is acceptable.
22. (Step 11) Certificate-email delivery can't be confirmed (Zapier only accepts the request). Adding a confirmation
   would need an extra Zap step calling back into ScamSense; not planned for the MVP.
23. (Step 11) PDF fonts cover Latin and Latin Extended characters. Names in other scripts (e.g. Arabic, CJK) would not
   render in the PDFs (the on-screen certificate is fine). Add a fallback font if needed.
