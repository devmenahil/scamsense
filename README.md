
# ScamSense

### Scammers don't give you a practice round. ScamSense does.

**Pause. Check. Verify. Then Pay.**

[**Try ScamSense Live**](https://scamsense-3f74.onrender.com) · [Product Specification](docs/PRODUCT_SPEC.md) · [System Architecture](docs/ARCHITECTURE.md)

ScamSense is an **AI-powered financial scam education platform** that transforms traditional scam awareness into immersive, personalized learning experiences.

Instead of answering multiple-choice questions, learners investigate realistic financial situations, make decisions, explain their reasoning, and experience the consequences in a safe environment.

Built for the **PayPal AI Hackathon**, ScamSense combines **Google Gemini**, **PayPal Sandbox**, and a **Recovery Playbook grounded in verified official PayPal policies** to help users recognize scams, make informed payment decisions, and understand what to do when something goes wrong.

> **All PayPal transactions use Sandbox accounts and simulated funds. No real money is transferred.**

---

## Try ScamSense — No Installation Required

**Live application:** https://scamsense-3f74.onrender.com

ScamSense is publicly accessible through Render. You do not need to install software, clone the repository, configure API keys, or run the project locally.

### Step 1 — Create Your ScamSense Account

1. Visit [ScamSense](https://scamsense-3f74.onrender.com).
2. Select **Sign Up**.
3. Register using an accessible email address.
4. Confirm that you are at least 18 years old.
5. Verify your email address if prompted.
6. Sign in and complete the onboarding process.

During onboarding, ScamSense collects information about your occupation, financial activities, and goals to personalize your learning experience.

### Step 2 — Start Your Learning Journey

From the dashboard:

1. Open **Module 1 — Spot the Trap**.
2. Select an available scenario.
3. Explore the simulated messages, websites, or financial interactions.
4. Investigate the available information.
5. Make your final decision.
6. Explain why you chose that action.
7. Review your AI-generated feedback.
8. Explore **Reveal the Red Flags** and **Your Recovery Playbook**.

Complete both scenarios to unlock the next module.

**Important:** ScamSense intentionally does not reveal red flags or correct answers during gameplay. You must make your own decisions before receiving feedback.

### Step 3 — Set Up a PayPal Sandbox Buyer Account

Some scenarios contain an authentic PayPal Sandbox checkout.

To approve a payment, you need a **PayPal Sandbox Personal (buyer) account**.

Your ScamSense login credentials cannot be used to log in to PayPal Sandbox.

#### Create or Access Your Sandbox Account

1. Visit [PayPal Developer](https://developer.paypal.com).
2. Sign in with your PayPal Developer account, or create one if necessary.
3. Open the [Sandbox Accounts dashboard](https://developer.paypal.com/dashboard/accounts).
4. Check whether a **Personal** Sandbox account already exists.
5. If one exists, you can use it. Otherwise, create a new Sandbox account with:
   - **Account type:** Personal (Buyer).
   - **Country/Region:** United States (recommended for the English-language demo).
6. Open the account's **View/Edit Account** option.
7. Locate the Sandbox account's test email and password.

These credentials are specifically for the PayPal testing environment.

**Do not use real payment credentials or your actual PayPal account to complete ScamSense Sandbox checkout.**

#### Complete a Sandbox Payment

When you encounter a payment-enabled scenario:

1. Investigate the scenario and decide whether to proceed with the payment.
2. Confirm your decision and submit your written reasoning.
3. Select **Pay with PayPal** when checkout is available.
4. The official PayPal Sandbox checkout window will open.
5. Sign in using your **Sandbox Personal buyer account email and password**.
6. Review the fictional payment.
7. Approve the payment if you want to complete that simulated transaction.
8. Return to ScamSense to view your results.

PayPal processes the transaction within its Sandbox environment.

**No real money will be charged.**

You may also encounter scenarios where the safer decision is to avoid payment altogether.

#### Important Notes for Testers

- You need a ScamSense account to access the learning platform.
- You need a PayPal Sandbox Personal account only when approving Sandbox payments.
- The two accounts are completely separate.
- A Sandbox Business account is not the appropriate account for signing in as the buyer.
- If PayPal automatically signs you into a different Sandbox account, try a private/incognito browser window.
- PayPal's hosted checkout language may depend on the Sandbox account's country and language preferences.

For more information, refer to [PayPal Developer Documentation](https://developer.paypal.com/docs/).

### Step 4 — Receive Your Certificate by Email

Completing both original scenarios in a module unlocks its completion badge and certificate.

To receive your certificate:

1. Complete both scenarios in the module.
2. Open the module's completion or certificate section.
3. Preview your certificate.
4. Select the option to receive the certificate by email.
5. Enter a **valid email address that you can access**.
6. Submit the email request.
7. Check your inbox for the certificate email and its PDF attachment.

**If you do not receive the email, check your Spam or Junk folder.**

Certificate emails are delivered through the existing **Zapier and Gmail integration**.

The certificate is an educational achievement issued by ScamSense. It is not an official PayPal certification.

### Step 5 — Download Your Learning Report

After completing a module, you can download a PDF analysis report containing your recorded learning results.

The report includes information about your decisions, reasoning, evidence recognition, scores, and simulated financial outcomes.

Unlike certificates, **analysis reports are downloaded directly from ScamSense**.

### Account Requirements at a Glance

| Activity | Account Required |
|---|---|
| Access ScamSense | ScamSense account |
| Complete onboarding and scenarios | ScamSense account |
| Receive Gemini feedback | ScamSense account |
| Approve Sandbox payments | PayPal Sandbox Personal account |
| Receive certificate PDF by email | Valid, accessible email address |
| Download analysis report | Completed module on your ScamSense account |

---

## The Problem

Financial scams are increasingly convincing.

Fraudulent invoices, phishing emails, fake payment confirmations, and impersonation attempts can resemble legitimate financial interactions.

Traditional awareness resources explain warning signs, but recognizing a scam in an article is different from making a financial decision under pressure.

Users need opportunities to practice identifying suspicious behavior, verifying information, and making informed decisions without risking actual money.

**ScamSense turns scam awareness from passive information into active experience.**

---

## Our Solution

ScamSense provides a safe environment where users learn by doing.

A learner can:

1. Enter realistic scenarios personalized to their profile.
2. Investigate messages, websites, invoices, and marketplace interactions.
3. Make meaningful financial decisions.
4. Explain the evidence behind those decisions.
5. Receive personalized feedback powered by Google Gemini.
6. Revisit the scenario to identify important clues.
7. Learn relevant protection and recovery procedures grounded in official PayPal policies.
8. Earn badges, certificates, and downloadable analysis reports.

**Not every scenario is fraudulent.**

ScamSense also includes legitimate financial interactions, encouraging learners to distinguish genuine opportunities from suspicious situations rather than automatically rejecting every payment.

The goal is to develop **financial confidence through evidence-based decision-making**.

---

## Key Features

### 1. AI-Personalized Scam Simulations

ScamSense uses **Google Gemini** to personalize the narrative details of each scenario according to the learner's profile.

Personalization considers relevant information such as:

- Occupation.
- Financial activities.
- Financial goals.
- Custom profile descriptions.

For example, students, freelancers, and online shoppers may encounter different contextual details within the same underlying educational scenario.

The application uses a hybrid personalization architecture:

- Deterministic routing for predefined profile options.
- Gemini-based classification for meaningful custom descriptions.
- Gemini-generated scenario narrative details.
- Persisted personalization for consistency across refreshes and replays.

**Gemini personalizes the experience but cannot change whether a scenario is fraudulent or legitimate.**

Correct answers, required evidence, payment rules, and authoritative scenario outcomes remain controlled by the backend.

### 2. Immersive, Decision-Based Learning

ScamSense presents financial situations through realistic fictional interfaces, including:

- Messaging conversations.
- Emails and websites.
- Payment invoices.
- Online marketplaces.
- Seller dashboards.

During gameplay, learners do not receive highlighted red flags or hints identifying the correct decision.

They must investigate, decide, and explain their reasoning.

After locking a decision, learners can review the original scenario in a **read-only reasoning workspace** while writing their explanation.

The interface prevents additional gameplay decisions or payments during this stage.

### 3. Authentic PayPal Sandbox Integration

Payment-enabled scenarios use the official **PayPal JavaScript SDK v6** and **PayPal Orders v2 API**.

The application:

- Creates Sandbox orders using server-calculated amounts.
- Opens PayPal's hosted approval interface.
- Captures approved transactions.
- Verifies the completed payment status, amount, and currency.
- Records approved transactions in the fictional Training Funds ledger.

This allows learners to practice realistic financial decisions without transferring actual money.

**Testers must use a PayPal Sandbox Personal buyer account to approve payments.** See [Step 3 — Set Up a PayPal Sandbox Buyer Account](#step-3--set-up-a-paypal-sandbox-buyer-account).

### 4. Gemini-Powered Reasoning Evaluation

Every final decision requires a written explanation.

Gemini evaluates the learner's reasoning and produces personalized educational feedback covering:

- Recognized evidence.
- Overlooked evidence.
- Unsupported assumptions.
- Verification behavior.
- Opportunities to improve.

ScamSense uses a transparent scoring framework:

| Category | Maximum Points |
|---|---:|
| Decision correctness | 40 |
| Reasoning and evidence recognition | 30 |
| Verification behavior | 20 |
| Payment safety | 10 |
| **Total** | **100** |

The backend calculates scores using application-defined rules. Gemini provides structured educational analysis.

### 5. Reveal the Red Flags

After completing a scenario, learners unlock an interactive review of the experience.

Evidence annotations explain:

- **Red flags:** Indicators associated with fraudulent behavior.
- **Worth verifying:** Information requiring further investigation.
- **Positive verification evidence:** Indicators supporting a legitimate interaction.

All evidence explanations are predefined and linked to the specific scenario.

This ensures that the answer key is consistent rather than generated independently by AI.

### 6. Recovery Playbook — Powered by Verified PayPal Policies

Recognizing a scam is only the beginning. Users also need to know what actions they can take if something goes wrong.

ScamSense's **Recovery Playbook** provides scenario-specific educational guidance using a versioned knowledge base of verified official U.S. PayPal policies and help resources.

Depending on the scenario, learners can explore:

- Reporting suspicious messages and phishing attempts.
- Responding to potentially unauthorized transactions.
- Understanding PayPal's Resolution Center.
- Disputing eligible transactions.
- PayPal Purchase Protection.
- PayPal Seller Protection.
- Relevant limitations, eligibility conditions, exclusions, and reporting timeframes.

Gemini can personalize educational explanations, but official policy records provide the authoritative information.

**The Recovery Playbook does not guarantee refunds or replace PayPal's current official terms and support procedures.**

### 7. Sensei Kenshi — AI Learning Companion

**Sensei Kenshi** is ScamSense's Gemini-powered financial safety learning companion.

Learners can ask Kenshi questions about:

- Completed scenarios.
- Their decisions and reasoning.
- Recognized and missed evidence.
- Fraud techniques.
- Safer verification practices.
- Relevant PayPal protection and recovery policies.

Kenshi can use the learner's completed scenario context to make its explanations more relevant.

It is not available during active gameplay and cannot reveal the correct answers or hidden evidence of unfinished scenarios.

### 8. Training Funds and Financial Consequences

ScamSense uses fictional **Training Funds** to make financial choices meaningful.

The platform tracks:

- Sandbox payment transactions.
- Legitimate spending.
- Fictional scam-related losses.
- Remaining Training Funds.
- Module-level financial history.

Financial records are maintained through a controlled ledger.

Replaying a scenario does not modify official scores, Training Funds, module progression, badges, or certificates.

### 9. Badges, Certificates, and Reports

Completing both original scenarios in a module awards a badge and certificate.

| Module | Achievement Badge |
|---|---|
| Spot the Trap | Scam Spotter |
| Trust Under Pressure | Fraud Detective |
| Outsmart the Scam | ScamSense Guardian |

Learners can:

- View their achievements.
- Preview certificates.
- Receive certificate PDFs by email.
- Download module analysis reports.
- Replay completed scenarios.

**Certificate email delivery requires a valid, accessible email address. Check Spam/Junk if the message does not appear in the inbox.**

---

## Learning Modules

ScamSense currently includes **three modules and six mandatory scenarios**.

### Module 1 — Spot the Trap

**The Security Check**

A fictional conversation tests the learner's ability to recognize attempts to obtain sensitive verification information.

**Your Account Needs Attention**

A convincing account-related email and website experience challenges the learner to investigate an apparent security alert.

### Module 2 — Trust Under Pressure

**An Invoice Has Arrived**

An unexpected invoice tests whether the learner verifies the request before making a payment.

**The Laptop Purchase**

A legitimate marketplace purchase challenges the learner to recognize positive evidence and make an informed purchasing decision.

### Module 3 — Outsmart the Scam

**The Job Opportunity**

A job-related advance-fee scenario tests the learner's response to a suspicious payment request.

**The Seller's Dilemma**

The learner takes the seller's perspective and must decide how to respond to a claimed payment before shipping an item.

Together, the six scenarios explore different scam techniques and reinforce evidence-based financial decision-making.

---

## How ScamSense Works

```text
Register and Complete Onboarding
              |
              v
      Personalized Modules
              |
              v
       Immersive Scenario
              |
              v
    Investigate and Verify
              |
              v
         Final Decision
              |
              v
     Written Justification
              |
              v
   PayPal Sandbox (if applicable)
              |
              v
     Gemini-Powered Feedback
              |
              v
      Reveal the Red Flags
              |
              v
        Recovery Playbook
              |
              v
          Sensei Kenshi
              |
              v
   Badge + Certificate + Report
```

The platform combines adaptive AI experiences with deterministic backend rules to provide consistent, explainable educational outcomes.

---

## Technology Stack

| Technology | Purpose |
|---|---|
| Next.js | Full-stack web application |
| React | Interactive user interfaces |
| TypeScript | Type-safe application development |
| Tailwind CSS | Responsive styling |
| Google Gemini API | Scenario personalization, reasoning evaluation, and Sensei Kenshi |
| PayPal JavaScript SDK v6 | Sandbox checkout interface |
| PayPal Orders v2 API | Payment order creation, capture, and verification |
| Supabase Authentication | User accounts and authentication |
| Supabase PostgreSQL | Profiles, attempts, progress, scores, and ledger |
| Supabase Storage | Private certificate PDF storage |
| Zapier + Gmail | Certificate email delivery |
| React PDF | Certificate and analysis report generation |
| Vitest | Automated testing |
| Render | Application deployment |

---

## System Architecture

ScamSense separates immersive user experiences, AI-generated content, authoritative application logic, and external integrations.

### Frontend

Next.js and React deliver the learner dashboard, interactive scenarios, checkout interfaces, feedback screens, and educational resources.

### Backend

Next.js server-side endpoints manage authentication, game state transitions, scoring, payment verification, and certificate eligibility.

### Database

Supabase PostgreSQL stores profiles, progress, attempts, events, payment transactions, evaluations, and rewards.

### AI Layer

Google Gemini powers narrative personalization, reasoning analysis, Recovery Playbook personalization, and Sensei Kenshi.

### Payment Layer

PayPal Sandbox processes simulated payments through its official checkout infrastructure.

### Policy Knowledge Layer

A versioned knowledge base of official PayPal sources supports the Recovery Playbook and policy-related educational assistance.

### Certificate Delivery

Certificate PDFs are generated on the server, stored privately in Supabase, and delivered as email attachments through Zapier and Gmail.

For further details, see:

- [Product Specification](docs/PRODUCT_SPEC.md)
- [System Architecture](docs/ARCHITECTURE.md)
- [Data Model](docs/DATA_MODEL.md)

---

## Security and Responsible AI

ScamSense follows a key principle:

**AI can personalize the learning experience, but it cannot override authoritative gameplay, scoring, or payment rules.**

Safeguards include:

- PayPal Sandbox-only payment processing.
- Server-side payment amount calculation.
- Server-side payment capture verification.
- Idempotent financial transaction handling.
- Supabase authentication and Row Level Security.
- User-specific data access restrictions.
- Protected scenario answer keys.
- Validation of Gemini-generated structured output.
- Safe fallback content when AI services are unavailable.
- Separation of original attempts and practice replays.
- Private certificate storage.
- Temporary signed certificate access URLs.
- Verified policy sources separated from AI-generated explanations.

ScamSense uses fictional educational scenarios and does not handle real-money transactions.

---

## Running Locally — Developers Only

**You do not need to complete this section to use the live website.**

These instructions are for developers who want to clone, run, or contribute to the project.

### Prerequisites

- Node.js 24.
- npm.
- Supabase project.
- Google Gemini API key.
- PayPal Developer Sandbox credentials.
- Optional Zapier webhook for certificate email delivery.

### 1. Clone the Repository

```bash
git clone https://github.com/devmenahil/scamsense.git
cd scamsense
```

### 2. Install Dependencies

```bash
npm ci
```

### 3. Configure Environment Variables

Create a `.env.local` file using `.env.example` as the template.

```bash
cp .env.example .env.local
```

Configure the following values:

```dotenv
# Application
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# PayPal Sandbox
PAYPAL_ENV=sandbox
PAYPAL_API_BASE=https://api-m.sandbox.paypal.com
NEXT_PUBLIC_PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=

# Google Gemini
GEMINI_API_KEY=
GEMINI_MODEL=
GEMINI_TIMEOUT_MS=30000
GEMINI_MAX_RPM=12

# Optional certificate email integration
ZAPIER_CERTIFICATE_WEBHOOK_URL=
```

The application also supports `NEXT_PUBLIC_SUPABASE_ANON_KEY` for applicable Supabase configurations.

Environment variables beginning with `NEXT_PUBLIC_` are accessible to the browser and must never contain secret credentials.

**Never commit `.env.local`, service-role credentials, PayPal secrets, Gemini API keys, or Zapier webhook URLs.**

### 4. Configure Supabase

Create a Supabase project and apply the SQL migrations stored in:

```text
supabase/migrations/
```

Apply migrations in filename order.

Configure Supabase Authentication to allow the relevant local application redirect URLs.

The database migrations establish the required tables, authorization policies, scenario state machine, payment ledger, AI personalization records, and reward system.

### 5. Start the Application

```bash
npm run dev
```

Open:

http://localhost:3000

### 6. Build for Production

```bash
npm run build
npm start
```

### 7. Test Sandbox Checkout

To test PayPal Sandbox locally, create or access a **Sandbox Personal buyer account** through the PayPal Developer Dashboard.

Use its test credentials when the PayPal checkout opens.

A separate Sandbox Business account and REST application are required to configure the payment integration.

---

## Testing and Quality Assurance

ScamSense has undergone automated unit and integration testing across its core subsystems.

The final pre-deployment QA reported:

| Check | Result |
|---|---|
| Unit tests | 461 passed across 40 files |
| TypeScript | Passed |
| ESLint | Passed |
| Production build | Passed |
| Integration tests | 82 passed, 5 skipped, 1 failed with Gemini deliberately disabled |

The remaining integration failure concerned an AI-generated Recovery Playbook note when Gemini was intentionally unavailable. Verified policy content remained accessible.

Automated coverage includes:

- Authentication and profile validation.
- User authorization and data isolation.
- Scenario state transitions.
- Module progression.
- Scoring calculations.
- Training Funds ledger.
- PayPal payment validation.
- Duplicate transaction prevention.
- Replay isolation.
- Gemini output validation.
- Evidence review.
- Policy retrieval.
- Badge and certificate generation.
- Certificate ownership.
- Email request handling.

### Testing Commands

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

Additional integration and Gemini test scripts are available in the repository. Some tests require configured external services and may create test records or Sandbox orders.

**Automated tests do not substitute for real browser verification of hosted PayPal checkout, email delivery, or responsive layouts.**

---

## Deployment

ScamSense is hosted on **Render**.

**Live URL:** https://scamsense-3f74.onrender.com

The application runs as a Node.js Web Service.

| Configuration | Value |
|---|---|
| Deployment platform | Render |
| Branch | `main` |
| Node.js version | 24 |
| Build command | `npm ci && npm run build` |
| Start command | `npm start` |
| Health check path | `/` |

Production environment variables are configured securely through Render.

Supabase Authentication is configured to recognize the deployed HTTPS domain.

PayPal remains in Sandbox mode; no real-money transactions are supported.

---

## Impact and Future Potential

ScamSense aims to improve digital financial awareness by making learning practical, personalized, and engaging.

The experience has potential applications in:

- Financial literacy education.
- University and student awareness programs.
- Digital payment safety training.
- Freelancer and marketplace education.
- Community scam-prevention initiatives.
- Consumer financial safety programs.

Its modular structure could support additional scenarios, languages, regions, and learning audiences.

Potential future enhancements include multilingual simulations, broader scam categories, and privacy-preserving aggregate learning insights for educational organizations.

These are future opportunities, not claims of existing institutional partnerships.

---

## Built for the PayPal AI Hackathon

**Build What's Next with PayPal and AI**

ScamSense demonstrates how AI and payment technology can support practical financial safety education.

Our approach combines three complementary capabilities:

**AI makes learning personal.**

Google Gemini adapts experiences and provides individualized feedback.

**Authentic payment experiences make decisions meaningful.**

PayPal Sandbox lets users interact with real checkout infrastructure without risking actual funds.

**Verified recovery guidance makes lessons actionable.**

The Recovery Playbook connects scenario outcomes to official PayPal policies and practical next steps.

Together, these elements help learners practice safer financial decision-making before encountering real financial risks.

---

## Disclaimer

ScamSense is an independent educational prototype developed for the PayPal AI Hackathon.

All scenarios, characters, accounts, and Training Funds are fictional. Payment transactions occur exclusively through PayPal Sandbox.

The Recovery Playbook provides educational guidance based on referenced official PayPal sources. Actual protection eligibility, dispute rights, reporting requirements, and recovery outcomes depend on applicable terms, jurisdiction, and circumstances.

ScamSense is not affiliated with, endorsed by, or certified by PayPal or Google.

---

### Scammers don't give you a practice round. ScamSense does.

**Pause. Check. Verify. Then Pay.**

[**Experience ScamSense**](https://scamsense-3f74.onrender.com)
