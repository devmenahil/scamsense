# CLAUDE.md — ScamSense

Permanent instructions for Claude Code working in this repository. Read this file fully before every task.
Detailed specifications live in `docs/`:

- `docs/PRODUCT_SPEC.md` — what the product does (functional source of truth)
- `docs/ARCHITECTURE.md` — how it is built (stack, routes, APIs, state machine, AI/payment boundaries)
- `docs/DATA_MODEL.md` — database entities and relationships
- `docs/IMPLEMENTATION_PLAN.md` — staged build checklist (work only on the current phase)

## Project summary

ScamSense is a desktop-first, fully responsive web platform (PayPal AI Hackathon project) that teaches adults (18+)
to recognize, investigate, avoid, and respond to financial scams through AI-personalized, immersive, fictional
financial simulations connected to the PayPal ecosystem (PayPal **Sandbox** only). Three modules × two scenarios,
Gemini-assisted feedback, a post-scenario "Reveal the Red Flags" answer key, "Your Recovery Playbook" (verified U.S.
PayPal policies), the "Sensei Kenshi" learning chatbot, badges, on-screen certificates (optionally emailed via
Zapier), and downloadable analysis reports.

## Source-of-truth precedence

1. **ScamSense Product Experience — Non-Negotiable Rules** (below) — always wins.
2. `docs/PRODUCT_SPEC.md` and the other `docs/` files.
3. `reference/ScamSense_Brand_Identity_Guide.pdf` — **visual branding only** (logo, colors, tints, typography, icons,
   shapes, buttons, cards, personality). Ignore its target-audience definition, gameplay instructions, scenario
   structures, XP/streak mechanics, and example interfaces wherever they conflict with the spec.
4. `reference/scamSense level info.docx` — source for the five scam categories and the three difficulty definitions
   only. Its quiz-style "What should you do?" question format is **not** used.

Never invent product requirements. If something is unspecified and non-essential, choose the simplest maintainable
option and record it as an open question in the relevant doc rather than expanding scope.

---

## ScamSense Product Experience — Non-Negotiable Rules

> These are permanent, mandatory product requirements, not optional design recommendations. They take precedence
> over any conflicting examples in the brand identity PDF, earlier reference documents, or implementation
> suggestions. Claude Code must follow these rules throughout every development phase.

### Core principles (verbatim from the project owner)

ScamSense must never feel like a traditional cybersecurity quiz.

The primary product experience is an immersive financial simulation.

Every player should feel that they are using realistic fictional financial tools, encountering believable situations,
making meaningful decisions, and observing the consequences.

The system must not reveal which scenario is fraudulent or legitimate before the final decision.

No hints or red-flag highlighting appear during the simulation.

The user must provide written reasoning for every final decision.

An appropriate payment decision can lead to a genuine PayPal Sandbox checkout.

The application then presents Gemini-generated feedback, a separate contextual humorous comment, the Reveal the Red
Flags answer key, and the Recovery Playbook.

The scenario interface must adapt to the type of activity, not simply display a question with multiple-choice answers.

Gemini personalizes narrative content but never determines payment truth, scenario correctness, or PayPal policy.

The actual visual identity must follow the supplied ScamSense brand guide, excluding its outdated gameplay and audience
definitions.

ScamSense is web-based, desktop-first and fully mobile-responsive.

All development work must preserve these principles, even when a technically easier implementation is available.

### Detailed product rules (R1–R30) and derived safeguards (R31–R38)

These rules spell out the core principles above in detail. If any rule here seems to conflict with the core principles,
the core principles win.

#### Platform and audience
- **R1.** ScamSense is web-based, desktop-first, and fully responsive for mobile and tablets.
- **R2.** Only adults aged 18+ can register.
- **R3.** Users provide financial activities, profession/life stage, digital payment experience, optional income
  bracket, financial goal, age bracket, and other minimal contextual information. Collect nothing beyond what is
  needed.
- **R4.** Users choose a preferred currency from currencies supported by the configured PayPal Sandbox Checkout
  integration. USD is the default.

#### Modules and progression
- **R5.** There are exactly three modules: **Spot the Trap**, **Trust Under Pressure**, **Outsmart the Scam**.
- **R6.** Each module contains exactly two scenarios.
- **R7.** Modules unlock sequentially, only after both scenarios in the previous module are completed.

#### Scenario gameplay
- **R8.** Scenario experiences are immersive interactive environments (realistic fictional websites, chats, payment
  requests, invoices, marketplaces), **not quiz pages**.
- **R9.** Before a scenario, the user receives only a neutral, one-line introduction.
- **R10.** During gameplay, never reveal red flags, hints, answers, clue highlights, or judgments, whether through UI,
  copy, styling, tooltips, network payloads, the chatbot, or any other channel.
- **R11.** The user must make a final decision **and** justify that decision before any feedback appears.
- **R12.** If the user chooses to pay in a scenario that supports payment, the scenario must run a genuine PayPal
  **Sandbox** checkout.

#### Evaluation and feedback
- **R13.** The AI evaluates the user's reasoning against a fixed answer key and predetermined evidence. The AI never
  decides what the correct answer is.
- **R14.** Gemini generates factual explanations and a **separate** short, personalized, humorous comment. The two
  are stored and displayed separately.
- **R15.** "Reveal the Red Flags" appears only after the scenario is completed and highlights the relevant evidence
  with explanations.
- **R16.** Evidence is classified as a **red flag**, **something worth verifying**, or **positive verification
  evidence**. Do not treat every observation as proof of fraud.
- **R17.** At least one of the six scenarios is legitimate.

#### Training funds (fictional wallet)
- **R18.** The simulated financial wallet is independent of actual PayPal balances.
- **R19.** Payment amounts are calculated from predefined percentages of the module's starting training funds.
- **R20.** Training funds reset at the start of each module. Historical financial results are preserved.

#### Recovery, chatbot, and completion
- **R21.** The recovery section is called **Your Recovery Playbook** and uses verified U.S. PayPal policies only.
- **R22.** The AI chatbot is named **Sensei Kenshi** and answers scenario, scam-awareness, and PayPal-related
  questions.
- **R23.** No separate intent classifier is needed for the MVP.
- **R24.** After module completion, the user receives a badge, an on-screen certificate preview, and a downloadable
  analysis report.
- **R25.** The certificate itself is not directly downloadable. The user can optionally enter an email address to
  receive it through Zapier.
- **R26.** The learning report downloads directly from the website.

#### Resilience, safety, and integrity
- **R27.** The app must remain usable when Gemini or Zapier is unavailable.
- **R28.** No live PayPal transactions, no real banking credentials, no functional phishing links, and no real fraud
  execution features.
- **R29.** Simulated fraudulent interfaces use fictional organizations and non-functional example domains.
- **R30.** Never fabricate PayPal policies, fraud statistics, payment outcomes, or refund guarantees.

#### Derived safeguards (stated elsewhere in the project brief, or direct implementations of R10–R30)
- **R31.** Users never spend real money.
- **R32.** Payment amounts, correctness, scoring, progression, unlocks, and wallet balances are determined by
  deterministic server-side code, never by Gemini.
- **R33.** Fake interfaces must never ask for or store real passwords, OTPs, card numbers, or bank credentials. Any
  "login" or "code" field inside a simulation is inert: nothing typed there is transmitted or persisted.
- **R34.** Simulated fraudulent interfaces must not reproduce PayPal's real branding in a way that could be mistaken
  for a real PayPal page. Real PayPal UI appears only through the official PayPal JavaScript SDK in Sandbox mode.
- **R35.** Visual branding follows the ScamSense Brand Identity Guide (teal/yellow/white, Nunito + Inter, rounded
  shapes, no alarm-red/green status colors, meaning never carried by color alone). This applies to ScamSense chrome
  only. Fictional in-scenario sites may use their own fictional styling.
- **R36.** Do not substitute a design mockup for a functional application. Every screen built must actually work.
- **R37.** Feedback tone is calm and encouraging ("practice, not panic"): praise first, explanation second, and never
  scold.
- **R38.** All money uses integer minor units with the currency's PayPal-defined decimal rules. Never use
  floating-point arithmetic for money.

---

## Development rules

### Stack (do not substitute without explicit approval)
- Next.js (App Router) + React + TypeScript (`strict`), Tailwind CSS.
- Server-side API route handlers (`app/api/**/route.ts`). Server Actions only where documented in ARCHITECTURE.md.
- Supabase (PostgreSQL + Auth). SQL migrations in `supabase/migrations/`.
- Zod for all external input, environment variables, AI output, and content-file validation.
- Gemini via the official `@google/genai` SDK; the model name comes from `GEMINI_MODEL`, never hardcoded.
- PayPal JavaScript SDK (client) + Orders v2 REST API (server), **Sandbox only**.
- `@react-pdf/renderer` for server-side analysis-report PDFs.
- Zapier "Catch Hook" webhook for optional certificate email.
- Vitest for unit tests, Playwright for end-to-end tests (added in the phases listed in the plan).

### Security and secrets
- Secrets are read only in server code through a Zod-validated `env` module. Only `NEXT_PUBLIC_*` values reach the
  browser.
- Scenario answer keys, evidence classifications, and explanations live in **server-only** modules
  (`import "server-only"`). They are never sent to the client before the attempt reaches `COMPLETED`.
- The PayPal integration refuses to start unless `PAYPAL_ENV=sandbox` and the API base is the Sandbox host.
- The server computes every payment amount. Never trust amounts, currencies, decisions, or scores from the client.
- Every API route authenticates the user and checks that the user owns the resource.
- Never log justification text, emails, or PayPal payloads containing personal data at info level.

### AI boundaries
- Gemini output must be structured JSON validated with Zod. Invalid output falls back to deterministic content.
- Gemini may only reference evidence IDs that exist in the scenario's answer key. Unknown IDs are discarded.
- Gemini never generates PayPal policy, recovery steps, statistics, or refund promises. Policy content comes only from
  the authored and verified Recovery Playbook content.
- Every Gemini call has a timeout and a deterministic fallback (R27).

### Code conventions
- Domain logic (state machine, scoring, wallet math, unlock rules) is written as pure TypeScript in `src/lib/domain/`
  with unit tests. UI and route handlers call into it and never re-implement it.
- Scenario content is typed, versioned data in `src/content/` and is validated by Zod at build/test time.
- Keep components small. Use brand tokens from Tailwind config and never hardcode hex values in components.
- Accessibility: semantic HTML, keyboard operable, WCAG AA contrast, visible focus, meaning never carried by color
  alone.
- Every page must work at 360px width without horizontal scroll and be designed primarily for 1280px+ desktop.

### Brand tokens (from the Brand Identity Guide)
| Token | Hex | Use |
|---|---|---|
| teal (primary) | `#0B5F66` | logo, headings, body text, main buttons, headers |
| yellow (secondary) | `#FFC93C` | rewards, highlights, the logo dot, red-flag markers. Always with teal text |
| white | `#FFFFFF` | backgrounds, text on teal |
| mist | `#E8F3F2` | card backgrounds |
| teal-shade | `#073F44` | 3D button bottom edges, depth |
| yellow-tint | `#FFF3D1` | "look again" feedback backgrounds |
| yellow-shade | `#D9A21B` | yellow button bottom edges |

- Proportion is roughly 60% white, 30% teal, 10% yellow, with one yellow highlight per screen. Never put yellow text on
  white or white text on yellow. Add no fourth hue, no gradients, and no red/green status colors.
- Typography: Nunito (headings 800 at 32/38, subheadings 700 at 22/28, buttons/labels 900 at 15px uppercase with
  +5% tracking) and Inter (body 400 at 16/24 with a 14px minimum, captions 500 at 13/18). Use sentence-case headings
  and capitals only on buttons.
- Shapes: circles, pill bars, and speech bubbles with corner radius ≥12px. Buttons and cards use a 12–16px radius, a
  2px teal border, and a thicker bottom edge. Use one main button per screen.
- Icons use a 2px rounded teal outline with one yellow fill on a 24px grid, always inside a rounded tile.
- Logo: a speech-bubble symbol with a yellow dot plus the "ScamSense" wordmark. Clear space equals the dot width. The
  minimum size is 24px for the symbol and 130px wide for the full logo. Never stretch, recolor, rotate, or add effects.

### Working process
- Work only on the current phase in `docs/IMPLEMENTATION_PLAN.md`. Tick checklist items when they are done.
- Update the relevant `docs/` file in the same change whenever a decision changes.
- Before finishing a phase, run type-check, lint, and tests, and report the results honestly.
- Do not commit or push unless asked.

## Brand Identity Guide — Strict Usage Rules

The file `reference/ScamSense_Brand_Identity_Guide.pdf` is provided EXCLUSIVELY as a visual branding reference.

Use it only for:
- Official ScamSense logo and logo usage rules
- Brand colors, tints, and color proportions
- Typography and font hierarchy
- Icons, shapes, buttons, cards, and visual components
- Spacing, rounded corners, and visual styling
- Brand personality and tone

DO NOT use the document as a source of truth for:
- Target audience or user demographics
- User onboarding requirements
- Scenario categories, content, or structure
- Gameplay mechanics or interaction flows
- Module definitions or progression rules
- AI personalization and routing
- Scoring and feedback logic
- PayPal integration
- Certificates, reports, or rewards
- Any other application functionality

Examples, screenshots, and mockups within the brand guide are visual references ONLY. Do not reproduce their outdated text, questions, interactions, or application behavior.

If any information in the brand guide conflicts with the finalized ScamSense requirements, ALWAYS follow `CLAUDE.md` and `docs/PRODUCT_SPEC.md`.

The brand guide must never override the application's approved functional requirements.