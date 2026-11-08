# ScamSense — Product Specification

Status: Phase 0 baseline. This is the functional source of truth. It must stay consistent with the
**ScamSense Product Experience — Non-Negotiable Rules** in `CLAUDE.md`, including both the core principles and the
detailed rules. Rule references such as (R10) point to that section.

**Core principle:** ScamSense is an immersive financial simulation and must never feel like a traditional
cybersecurity quiz. Players use realistic fictional financial tools, meet believable situations, make meaningful
decisions, and see the consequences.

## 1. Purpose

ScamSense teaches adults to **recognize, investigate, avoid, and respond to** financial scams. Users work through
realistic, fictional, AI-personalized financial simulations connected to the PayPal ecosystem. They make real
decisions and explain them, and only then do they learn what the evidence showed.

Brand promise (from the brand guide): *Pause. Check. Verify. Then Pay.* The intended feelings are capable, calm, and
curious. The tone is "practice, not panic."

Honest by design: ScamSense is an educational simulator. It does not detect fraud in real messages, does not access
real financial accounts, and never moves real money (R28, R31).

## 2. Users and registration

- Adults aged 18+ only (R2). Registration requires the user to select an adult age bracket and confirm they are 18 or
  older. No bracket below 18 exists, so a user who cannot confirm being 18+ cannot register.
- The platform is desktop-first and fully responsive on tablets and phones (R1).

### 2.1 Onboarding profile (R3)
Collected once after sign-up and editable later. Keep it minimal.

| Field | Required | Notes |
|---|---|---|
| Display name | Yes | Used on the certificate and in feedback |
| Age bracket | Yes | Adult brackets only (e.g., 18–24, 25–34, 35–44, 45–54, 55–64, 65+) |
| 18+ confirmation | Yes | Checkbox |
| Profession / life stage | Yes | Fixed option list (e.g., student, employed, self-employed, freelancer, small-business owner, retired, other) |
| Financial activities | Yes (≥1) | Multi-select (e.g., online shopping, selling online, freelancing/invoicing, sending money to family, paying bills, investing, job seeking) |
| Digital payment experience | Yes | New / Occasional / Regular / Very experienced |
| Financial goal | Yes | Fixed option list plus short free text (≤120 chars) |
| Income bracket | **Optional** | Includes "Prefer not to say" |
| Preferred currency | Yes | Defaults to **USD**. Options come from the PayPal Sandbox Checkout currency allowlist (R4) |

The profile is used only to personalize scenario surface details, feedback wording, and the chatbot. It never
changes answer keys, correctness, or difficulty (R13).

## 3. Learning structure

### 3.1 Modules (R5–R7)
| # | Module | Difficulty (from level info doc) | Unlock condition |
|---|---|---|---|
| 1 | **Spot the Trap** | Beginner (Awareness): obvious warning signs | Available after onboarding |
| 2 | **Trust Under Pressure** | Intermediate (Recognition): less obvious tricks, urgency, impersonation, familiar branding | Both Module 1 scenarios completed |
| 3 | **Outsmart the Scam** | Advanced (Critical thinking): multi-step situations, subtle inconsistencies, mixed clues | Both Module 2 scenarios completed |

Each module has exactly two scenarios (R6). Within a module, the two scenarios can be played in either order.

### 3.2 Scam categories (from the level info doc)
1. OTP theft and social engineering
2. Phishing, fake links, and duplicated websites
3. Fake invoices, payment requests, and impersonation
4. Online shopping and marketplace scams
5. Advance-fee, job, and investment scams

Categories can overlap. Advanced scenarios should combine warning signs.

### 3.3 Proposed scenario lineup (draft, finalized in the content-authoring phase)
The six scenarios together cover all five categories and include at least one **legitimate** scenario (R17).

| Module | Scenario (working title) | Category | Environment | Legit? | Payment possible? |
|---|---|---|---|---|---|
| 1 | Account "restricted" email and look-alike sign-in page | 2 | Email inbox + fictional website | Scam | No |
| 1 | "Support agent" asks for a verification code | 1 | Chat window | Scam | No |
| 2 | Unexpected invoice with "call us now" number | 3 | Email + invoice view | Scam | Yes (paying the invoice) |
| 2 | Genuine purchase from a fictional online store | 4 | Fictional storefront + checkout | **Legit** | Yes (paying is correct) |
| 3 | Buyer's fake "payment pending" confirmation and push to ship | 4 + 3 | Marketplace seller dashboard + email + chat | Scam | No (seller-side; the decision is whether to ship) |
| 3 | Recruiter's job offer with upfront "activation fee" | 5 | Job board + chat + payment request | Scam | Yes (paying the fee) |

Final titles, decision options, evidence, and payment percentages are authored as content (see ARCHITECTURE §6) and
reviewed against R8–R17, R28–R30.

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

### 4.3 Attempts
For the MVP, each scenario is completed once per user, and the completed attempt is final for progression and
reports. An in-progress attempt can be resumed. *(Open question: whether replays are allowed after module
completion. Not in MVP scope unless confirmed.)*

## 5. Training funds (fictional wallet) — R18–R20

- Each module starts with a fixed amount of **training funds** in the user's preferred currency. The amount is a
  configured content value per module, and the currency is fixed when the module starts.
- Every payable action in a scenario has a predefined **percentage** of the module's starting funds. The server
  computes amount = round(startingFunds × percent) in minor units, using the currency's decimal rules (R19, R38).
- When the user pays in a scenario:
  - A PayPal Sandbox order is created and captured for that amount (a Sandbox test account; no real money).
  - The fictional wallet is debited by the same amount, independently of any PayPal balance (R18).
- What the payment is "worth" in the debrief is deterministic and authored. In a scam scenario the money is lost in the
  story. In the legitimate scenario the user receives the item, so the payment is a successful purchase. The UI never
  claims real-world refund outcomes (R30).
- At the start of the next module, the wallet resets to that module's starting funds (R20). Earlier module ledgers
  stay preserved and appear on the dashboard and in reports.

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
1. **Badge.** A module badge appears on the dashboard.
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

The dashboard shows module cards (locked, available, in progress, or completed), scenario status, current training
funds, historical module results, badges, and entry points to Sensei Kenshi and the Recovery Playbook.

## 10. Graceful degradation (R27)

| Dependency down | Behavior |
|---|---|
| Gemini (personalization) | Scenario uses authored default surface text |
| Gemini (evaluation) | Deterministic evidence matching plus authored explanations, with a neutral fallback comment instead of humor |
| Gemini (chat) | Friendly fallback message with links |
| Zapier | Certificate stays visible on screen, and the email can be retried |
| PayPal Sandbox | The payment step shows "Sandbox checkout unavailable." The user can retry or choose another decision. No payment is faked as a PayPal transaction. |

## 11. Out of scope (MVP)
Live PayPal payments, real account linking, scanning real messages, leaderboards, social features, XP/streaks (shown
in the brand mockups, but not part of this product), non-U.S. recovery policies, multiple languages, admin CMS, and
replays (pending confirmation).

## 12. Open questions (need product-owner confirmation)
1. Starting training-funds amount per module (one value for all modules, or a different value per module).
2. Whether completed scenarios can be replayed for practice, which would not affect progression.
3. The exact payment percentages for each payable action (authored with the scenarios).
4. The final six scenario storylines (§3.3 is a draft).
