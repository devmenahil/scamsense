
# ScamSense

### Scammers don't give you a practice round. ScamSense does.

**Pause. Check. Verify. Then Pay.**

[**🚀 Try ScamSense Live**](https://scamsense-3f74.onrender.com) · [Product Specification](docs/PRODUCT_SPEC.md) · [System Architecture](docs/ARCHITECTURE.md)

> **Note:** ScamSense is hosted on Render's free tier. The first visit after inactivity may take approximately 50–60 seconds while the server starts. Subsequent navigation should be faster once the service is active.

ScamSense is an **AI-powered financial scam education platform** that transforms traditional scam awareness into immersive, personalized simulations.

Instead of answering multiple-choice questions, users investigate realistic financial situations, make decisions, explain their reasoning, and experience the consequences in a safe environment.

Built for the **PayPal AI Hackathon**, ScamSense combines **Google Gemini**, **PayPal Sandbox**, and a **Recovery Playbook grounded in verified official PayPal policies** to help users recognize scams, make informed payment decisions, and understand what to do when something goes wrong.

> **All PayPal transactions use Sandbox accounts and simulated funds. No real money is transferred.**

---

## The Problem

Financial scams are increasingly convincing. Fraudulent invoices, phishing emails, fake payment confirmations, and impersonation attempts can closely resemble legitimate financial interactions.

Traditional awareness resources explain warning signs, but recognizing a scam in an article is different from making a financial decision under pressure.

People need opportunities to practice identifying suspicious behavior, verifying information, and making informed decisions **without risking actual money**.

**ScamSense turns scam awareness from passive information into active experience.**

---

## Our Solution

ScamSense provides a personalized learning environment where users can:

1. Enter realistic scenarios tailored to their occupations, financial activities, and goals.
2. Investigate messages, websites, invoices, and marketplace interactions.
3. Make meaningful financial decisions, including PayPal Sandbox payments where applicable.
4. Explain the evidence behind their decisions.
5. Receive personalized reasoning feedback powered by Google Gemini.
6. Revisit completed scenarios to discover important evidence.
7. Learn relevant protection and recovery procedures grounded in official PayPal policies.
8. Track progress, earn badges, receive certificates, and download analysis reports.

**Not every scenario is fraudulent.**

ScamSense also includes legitimate financial interactions, encouraging learners to distinguish genuine opportunities from suspicious situations instead of automatically rejecting every payment.

Our objective is to develop **financial confidence through evidence-based decision-making**.

---

## Try ScamSense — No Installation Required

**Live application: https://scamsense-3f74.onrender.com**

ScamSense is deployed on Render and can be accessed directly through a web browser.

**You do not need to clone the repository, configure API keys, or install anything to use the live application.**

### Step 1 — Create Your Account

> **Note:** Password recovery is not yet functional. Your progress is linked to your ScamSense account, so it is advisable to save your login credentials somewhere securely. 

1. Open [ScamSense](https://scamsense-3f74.onrender.com).
2. Select **Sign In**.
3. If you don't have an account, click **Create Account** on the Sign In page.
4. Enter your email address and choose a password.
5. Confirm that you are at least 18 years old.
6. Sign in and complete the onboarding process.

During onboarding, ScamSense collects relevant profile information to personalize your learning experience.

### Step 2 — Start Your Learning Journey

1. Open **Module 1 — Spot the Trap** from your dashboard.
2. Select an available scenario.
3. Explore the simulated messages, websites, or financial interactions.
4. Investigate the information presented.
5. Make your final decision.
6. Explain why you chose that action.
7. Review your Gemini-powered feedback.
8. Explore **Reveal the Red Flags** and **Your Recovery Playbook**.

Complete both scenarios in a module to unlock the next module.

> **Important:** To simulate real-world financial interactions, ScamSense does not highlight red flags or provide hints during gameplay. Feedback is revealed only after you make your final decision.

### Step 3 — PayPal Sandbox Checkout

Certain scenarios include authentic PayPal Sandbox checkout.

**To approve a payment, you must use a PayPal Sandbox Personal (buyer) account.**

Your ScamSense login credentials cannot be used to sign in to PayPal Sandbox.

PayPal Sandbox transactions use simulated funds. No real money is transferred.

<details>
<summary><strong>How to create and use a PayPal Sandbox buyer account (click to expand)</strong></summary>

### A. Create or Access Your Sandbox Account

1. Visit [PayPal Developer](https://developer.paypal.com).
2. Sign in with your PayPal Developer account, or register if you do not have one.
3. Open [Sandbox Accounts](https://developer.paypal.com/dashboard/accounts).
4. Check whether a **Personal** Sandbox account already exists.
5. If an appropriate account exists, use it. Otherwise, create a new Sandbox account:
   - **Account type:** Personal (Buyer)
   - **Country/Region:** United States (recommended for an English-language demonstration)
6. Open the account's **View/Edit Account** option.
7. Locate the Sandbox test email address and password.

These credentials belong to PayPal's testing environment and are separate from your ScamSense credentials.

### B. Complete a Sandbox Payment in ScamSense

When you encounter a payment-enabled scenario:

1. Investigate the scenario and choose whether to proceed with payment.
2. Confirm your decision and submit your written reasoning.
3. Select **Pay with PayPal** when checkout becomes available.
4. The official PayPal Sandbox checkout window will open.
5. Sign in using your **Sandbox Personal buyer account** credentials.
6. Review the simulated payment.
7. Approve the transaction if you want to complete the payment.
8. Return to ScamSense to view your results.

### Important Notes

- A ScamSense account is required to play scenarios.
- A PayPal Sandbox Personal account is required only when approving Sandbox payments.
- A Sandbox Business account is not the buyer account used to approve checkout.
- Do not use your real PayPal payment credentials for Sandbox checkout.
- If PayPal automatically signs you into another Sandbox account, try a private/incognito browser window.
- Hosted checkout language may depend on the Sandbox buyer account and browser preferences.
- Some scenarios involve no payment, and avoiding a suspicious payment may be the safer decision.

For additional information, consult the [PayPal Developer Documentation](https://developer.paypal.com/docs/).

</details>

### Step 4 — Receive Your Certificate by Email

> **Note:** Certificate emails use a 14-day Zapier trial and may stop working after it expires. Certificate previews and reports remain available.

To receive your certificate:

1. Open the completed module's certificate section.
2. Preview your certificate.
3. Select the option to receive it by email.
4. Enter a **valid email address you can access**.
5. Submit the request.
6. Check your inbox for the certificate PDF attachment.

**If the email does not arrive, check your Spam or Junk folder.**

Certificate emails are delivered through the existing **Zapier and Gmail integration**.

The certificate recognizes completion of a ScamSense educational module. It is not an official PayPal certification.

### Step 5 — Download Your Analysis Report

After completing a module, you can also download a PDF report containing your recorded learning results.

The report includes your decisions, reasoning, evidence recognition, scores, and simulated financial outcomes.

**Analysis reports are downloaded directly from ScamSense. Certificates are delivered by email.**

### Account Requirements

| Activity | What You Need |
|---|---|
| Access the platform | ScamSense account |
| Complete scenarios | ScamSense account |
| Receive AI feedback | ScamSense account |
| Approve Sandbox payments | PayPal Sandbox Personal account |
| Receive a certificate PDF | Valid, accessible email address |
| Download an analysis report | Completed module |

---

## Key Features

### 1. AI-Personalized Simulations

ScamSense uses **Google Gemini** to personalize scenario narratives based on user profiles.

Personalization considers:

- Occupation
- Financial activities
- Financial goals
- Meaningful custom profile descriptions

For example, a student, freelancer, and online shopper may encounter different contextual details within the same underlying scenario.

Our hybrid approach combines:

- **Deterministic routing** for predefined profile options.
- **Gemini classification** for meaningful custom descriptions.
- **Gemini-generated narrative personalization** across all six scenarios.
- **Persistent personalization** for consistent refreshes and replays.

**AI personalizes the experience but does not determine whether a scenario is fraudulent or legitimate.**

Correct answers, mandatory evidence, financial rules, and scenario outcomes remain controlled by the application.

### 2. Immersive, Decision-Based Learning

Learners interact with fictional environments resembling:

- Messaging applications
- Emails and websites
- Payment invoices
- Online marketplaces
- Seller dashboards

There are no answer hints or highlighted warning signs during gameplay.

Users must investigate, make their final decision, and explain their reasoning.

After locking a decision, learners can review the original scenario through a **read-only reasoning workspace** without changing their decision or triggering additional actions.

### 3. Authentic PayPal Sandbox Integration

ScamSense integrates:

- **PayPal JavaScript SDK v6** for hosted Sandbox checkout.
- **PayPal Orders v2 API** for order creation and capture.
- Server-side verification of payment status, amount, and currency.
- A fictional Training Funds ledger for financial consequences.

Eligible scenarios allow users to approve simulated payments through PayPal's official Sandbox interface.

The application verifies completed captures before recording financial outcomes.

**No real-money payment processing is enabled.**

### 4. Gemini-Powered Reasoning Evaluation

Every final decision requires a written explanation.

Gemini analyzes the learner's reasoning and provides personalized feedback covering:

- Recognized evidence
- Overlooked evidence
- Unsupported assumptions
- Verification behavior
- Opportunities for improvement

ScamSense uses a transparent scoring framework:

| Category | Maximum Points |
|---|---:|
| Decision correctness | 40 |
| Reasoning and evidence recognition | 30 |
| Verification behavior | 20 |
| Payment safety | 10 |
| **Total** | **100** |

The backend calculates numerical scores using application-defined rules, while Gemini provides structured educational analysis and personalized feedback.

### 5. Reveal the Red Flags

Once a scenario is completed, learners can revisit the original experience with interactive evidence annotations.

Evidence is categorized as:

- **Red flags:** Indicators associated with fraudulent behavior.
- **Worth verifying:** Information requiring further investigation.
- **Positive verification evidence:** Indicators supporting a legitimate interaction.

These explanations come from predefined scenario answer keys rather than independently generated AI answers.

### 6. Recovery Playbook — Grounded in Official PayPal Policies

Recognizing a scam is only the beginning. Users also need to understand what they can do if something goes wrong.

ScamSense's **Recovery Playbook** provides scenario-specific educational guidance using a versioned knowledge base of verified official U.S. PayPal policies and help resources.

Depending on the scenario, users can learn about:

- Reporting phishing and suspicious messages.
- Responding to potentially unauthorized activity.
- Using PayPal's Resolution Center.
- Disputing eligible transactions.
- PayPal Purchase Protection.
- PayPal Seller Protection.
- Applicable eligibility conditions, exclusions, and timeframes.

Gemini may personalize educational explanations, but authoritative policy facts come from verified PayPal sources.

**The Recovery Playbook does not guarantee refunds or replace current official PayPal terms and support procedures.**

### 7. Sensei Kenshi — AI Learning Companion

**Sensei Kenshi** is ScamSense's Gemini-powered financial safety learning companion.

Learners can ask Kenshi about:

- Completed scenarios.
- Their decisions and reasoning.
- Recognized and missed evidence.
- Common financial scam techniques.
- Safer verification practices.
- Relevant PayPal protection and recovery information.

Kenshi uses the learner's completed scenario context to make its responses more relevant.

To preserve the learning experience, Kenshi cannot reveal hidden evidence or correct answers for unfinished scenarios.

### 8. Training Funds and Financial Consequences

ScamSense gives learners fictional **Training Funds** to make financial decisions meaningful.

The platform tracks:

- Sandbox payment transactions.
- Legitimate spending.
- Fictional scam-related losses.
- Remaining Training Funds.
- Module-level transaction history.

The backend maintains controlled financial records and prevents duplicate deductions.

Practice replays are isolated from official scores, wallet balances, progression, badges, and certificates.

### 9. Badges, Certificates, and Reports

Completing both original scenarios in a module unlocks its badge and certificate.

| Module | Achievement Badge |
|---|---|
| Spot the Trap | Scam Spotter |
| Trust Under Pressure | Fraud Detective |
| Outsmart the Scam | ScamSense Guardian |

Learners can:

- View earned achievements.
- Preview module certificates.
- Request certificate PDFs by email.
- Download detailed module analysis reports.
- Replay completed scenarios.

---

## Learning Modules

ScamSense currently includes **three modules and six mandatory scenarios**.

| Module | Scenario | Learning Focus |
|---|---|---|
| **1. Spot the Trap** | The Security Check | Recognizing attempts to obtain sensitive verification information |
| | Your Account Needs Attention | Investigating phishing emails and suspicious websites |
| **2. Trust Under Pressure** | An Invoice Has Arrived | Verifying unexpected payment requests |
| | The Laptop Purchase | Recognizing legitimate transactions and informed purchasing decisions |
| **3. Outsmart the Scam** | The Job Opportunity | Identifying advance-fee recruitment scams |
| | The Seller's Dilemma | Verifying payment claims before shipping goods |

The inclusion of legitimate scenarios encourages learners to make evidence-based decisions rather than assuming every financial interaction is fraudulent.

---

## How ScamSense Works

```text
Registration and Onboarding
           |
           v
Personalized Module Experience
           |
           v
Immersive Financial Scenario
           |
           v
Investigation and Verification
           |
           v
Final Decision + Written Reasoning
           |
           v
PayPal Sandbox Checkout
    (when applicable)
           |
           v
Gemini Feedback + Backend Scoring
           |
           v
Reveal the Red Flags
           |
           v
Recovery Playbook
           |
           v
Sensei Kenshi Learning Support
           |
           v
Badge + Certificate + Analysis Report
```

ScamSense combines adaptive AI personalization with deterministic backend rules to deliver consistent and explainable educational outcomes.

---

## Technology Stack

| Technology | Purpose |
|---|---|
| Next.js | Full-stack web application |
| React | Interactive user interfaces |
| TypeScript | Type-safe development |
| Tailwind CSS | Responsive styling |
| Google Gemini API | Personalization, reasoning feedback, and Sensei Kenshi |
| PayPal JavaScript SDK v6 | Hosted Sandbox checkout |
| PayPal Orders v2 API | Order creation, capture, and verification |
| Supabase Auth | Authentication and sessions |
| Supabase PostgreSQL | Profiles, attempts, scores, progress, and financial ledger |
| Supabase Storage | Private certificate PDF storage |
| Zapier + Gmail | Certificate email delivery |
| React PDF | Certificate and analysis report generation |
| Vitest | Automated testing |
| Render | Cloud deployment |

---

## System Architecture

ScamSense separates user interactions, AI-generated content, authoritative application rules, and external integrations.

**Frontend:** Next.js and React render the dashboard, immersive scenarios, checkout interface, and learning results.

**Backend:** Next.js server-side endpoints manage authentication, gameplay transitions, scoring, payment verification, and reward eligibility.

**Database:** Supabase PostgreSQL stores user profiles, attempts, event history, payment transactions, evaluations, and rewards.

**AI Layer:** Gemini personalizes narratives, evaluates written reasoning, and powers Sensei Kenshi.

**Payment Layer:** PayPal Sandbox processes simulated transactions through official checkout infrastructure.

**Policy Knowledge Layer:** A versioned collection of official PayPal resources grounds the Recovery Playbook and policy-related educational assistance.

**Certificate Delivery:** PDFs are generated server-side, stored privately in Supabase, and delivered through Zapier and Gmail.

For detailed implementation information:

- [Product Specification](docs/PRODUCT_SPEC.md)
- [System Architecture](docs/ARCHITECTURE.md)
- [Data Model](docs/DATA_MODEL.md)

---

## Security and Responsible AI

ScamSense follows a core principle:

**AI can personalize learning but cannot override authoritative gameplay, scoring, or payment rules.**

Implemented safeguards include:

- PayPal Sandbox-only transactions.
- Server-side payment amount calculation.
- Server-side payment capture verification.
- Idempotent transaction handling.
- Supabase authentication and Row Level Security.
- User-specific authorization checks.
- Protected scenario answer keys.
- Validation of structured Gemini output.
- Safe fallback behavior when Gemini is unavailable.
- Original attempts isolated from practice replays.
- Private certificate storage.
- Expiring signed certificate URLs.
- Verified PayPal policy records separated from AI-generated explanations.

All scenarios are fictional educational experiences.

---

## Testing and Quality Assurance

ScamSense has undergone automated testing across its core systems.

The final pre-deployment QA reported:

| Check | Result |
|---|---|
| Unit tests | 461 passed across 40 files |
| TypeScript | Passed |
| ESLint | Passed |
| Production build | Passed |
| Integration tests | 82 passed |

Automated testing covers:

- Authentication and user authorization.
- Scenario state transitions.
- Module progression.
- Scoring calculations.
- Training Funds and financial ledger.
- PayPal payment verification.
- Duplicate transaction prevention.
- Original and replay isolation.
- Gemini output validation.
- Evidence matching.
- Policy retrieval.
- Badges and certificates.
- Report authorization.
- Certificate email requests.

**Automated testing does not replace manual verification of PayPal-hosted checkout, certificate email delivery, or responsive browser behavior.**

---

## Running Locally — Developers Only

**You do not need this section to use the live ScamSense website.**

These instructions are for developers who want to run the application locally.

### Prerequisites

- Node.js 24
- npm
- Supabase project
- Google Gemini API key
- PayPal Developer Sandbox application credentials
- Optional Zapier Catch Hook for certificate delivery

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

Create `.env.local` using `.env.example` as the reference.

```bash
cp .env.example .env.local
```

Configure:

```dotenv
# Application
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# PayPal Sandbox
PAYPAL_ENV=sandbox
PAYPAL_API_BASE=https://api-m.sandbox.paypal.com
NEXT_PUBLIC_PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=

# Gemini
GEMINI_API_KEY=
GEMINI_MODEL=
GEMINI_TIMEOUT_MS=30000
GEMINI_MAX_RPM=12

# Optional certificate email
ZAPIER_CERTIFICATE_WEBHOOK_URL=
```

The application also supports `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in applicable Supabase configurations.

Variables beginning with `NEXT_PUBLIC_` are accessible to browser code and must never contain secret credentials.

**Never commit `.env.local`, API secrets, service-role credentials, or Zapier webhook URLs.**

### 4. Configure Supabase

Create a Supabase project and apply the SQL migrations in:

```text
supabase/migrations/
```

Apply the migrations in filename order.

Configure Supabase Authentication to allow the relevant application redirect URLs.

The migrations create the required database tables, authorization policies, scenario state machine, payment records, personalization storage, and module rewards.

### 5. Start the Application

```bash
npm run dev
```

Open http://localhost:3000.

### 6. Production Build

```bash
npm run build
npm start
```

### Testing Commands

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

Additional integration and live Gemini testing scripts are available in the repository. Some tests require configured external services and may create test records or Sandbox orders.

---

## Deployment

ScamSense is deployed on **Render** as a Node.js Web Service.

**Live application:** https://scamsense-3f74.onrender.com

| Setting | Value |
|---|---|
| Deployment platform | Render |
| Branch | `main` |
| Node.js version | 24 |
| Build command | `npm ci && npm run build` |
| Start command | `npm start` |
| Health check path | `/` |

Production environment variables are configured securely through Render.

Supabase authentication is configured to recognize the deployed HTTPS domain.

All PayPal transactions remain in Sandbox mode.

---

## Impact and Future Potential

ScamSense aims to make financial safety education practical, engaging, and personally relevant.

Its approach has potential applications in:

- University and student financial literacy programs.
- Freelancer and online marketplace education.
- Consumer scam-prevention initiatives.
- Digital payment safety training.
- Community financial awareness programs.
- Educational organizations.

Its modular architecture could support additional scenarios, languages, regions, and learning audiences.

Potential future developments include:

- Multilingual immersive simulations.
- Expanded financial scam categories.
- Region-specific educational guidance.
- Privacy-preserving aggregated learning insights.

These represent future opportunities, not claims of existing partnerships or implemented functionality.

---

## Built for the PayPal AI Hackathon

**Build What's Next with PayPal and AI**

ScamSense demonstrates how AI and authentic payment testing infrastructure can work together to improve financial safety education.

Our approach combines three complementary ideas:

**1. AI makes learning personal.**

Google Gemini adapts scenario narratives and provides individualized reasoning feedback.

**2. Authentic payment experiences make decisions meaningful.**

PayPal Sandbox allows users to interact with real checkout infrastructure without risking actual funds.

**3. Verified recovery guidance makes lessons actionable.**

The Recovery Playbook connects simulated experiences to official PayPal policies and practical next steps.

Together, these capabilities help learners practice safer financial habits before encountering real-world risks.

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
