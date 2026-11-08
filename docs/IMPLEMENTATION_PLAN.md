# ScamSense — Staged Implementation Plan

Work one phase at a time. Each phase ends with type-check, lint, and tests passing, docs updated, and a short report.
Every phase must preserve the **Non-Negotiable Rules** in `CLAUDE.md`.

## Phase 0 — Foundations and documentation ✅
- [x] Inspect the brand guide and level-info reference documents
- [x] `CLAUDE.md` with the Non-Negotiable Rules (core principles + R1–R38) and development rules
- [x] `docs/PRODUCT_SPEC.md`, `docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md`, `docs/IMPLEMENTATION_PLAN.md`
- [x] `.env.example` (placeholder names only)

## Phase 1 — Project scaffold and brand design system ✅
- [x] Next.js 15 (App Router, TS strict, `src/` dir), Tailwind v4, ESLint, Prettier, Vitest
- [x] `src/lib/env.ts` (server-only) + `env.schema.ts`: Zod-validated server/public env, including the Sandbox-only
      PayPal guard (tested). Service credentials stay optional until their phase makes them required
- [x] Brand tokens (colours, radii, 3D bottom-edge shadows, type scale) in `src/app/globals.css` `@theme`
      (Tailwind v4 CSS config; default palette removed). Nunito + Inter via `next/font`
- [x] Logo (symbol + wordmark component, light/dark variants, `public/brand/*.svg`, `app/icon.svg`) and the icon-tile
      component + brand icon set
- [x] UI primitives: Button/ButtonLink (primary/secondary/yellow/ghost/inverse, 3D edge, hover/active/focus/disabled/
      loading), Card, Badge (pill), IconTile, Input/Textarea/Select/Checkbox/ChoiceChip, Modal + Dialog (native
      `<dialog>`), ProgressBar, PageHeader, FeedbackBanner ("Nice catch" teal + tick, "Look again" yellow tint + flag),
      EmptyState, LoadingState/Spinner, DemoNotice
- [x] App shell: desktop header nav (≥1024px), mobile/tablet bottom nav, footer, "Training simulation" indicator,
      skip link, 360px → desktop layouts
- [x] Landing page (functional, real content, no mock data)
- [x] Page shells with clearly labelled demonstration data (`src/lib/demo/demoData.ts`): sign-in/sign-up,
      onboarding, dashboard, modules index, module overview, scenario player, results + Reveal layout, Recovery
      Playbook (topics only), profile, certificates, module completion, Sensei Kenshi
- [x] Accessibility baseline (visible focus rings, AA brand pairings, icon + words for every status, keyboard-operable
      dialog/forms, reduced-motion support)
- [x] QA: no horizontal scroll at 1440/768/390/360 on every route; key journeys clicked through on desktop + mobile

**Phase 1 notes / limitations**
- No authentication or persistence: forms validate and navigate but store nothing. `(app)` routes are not protected
  until Phase 2 middleware.
- Only the demo attempt `/play/demo` exists. The demo email environment is a placeholder for the Phase 4 renderers.
- The report download button is intentionally disabled; certificate email and Sensei Kenshi reply with a local
  "not connected yet" message.
- `cn()` does not merge conflicting Tailwind classes. Components must not receive overrides of their own base
  utilities (wrap them for visibility instead). Revisit with `tailwind-merge` only if this becomes limiting.

## Phase 2 — Supabase, auth, onboarding
- [ ] SQL migrations for all tables in DATA_MODEL §3, RLS policies, and §4 functions
- [ ] Supabase SSR clients, `middleware.ts` route protection, `requireUser()`
- [ ] Sign-up (email/password + adult age bracket + 18+ confirmation), sign-in, sign-out
- [ ] Currency allowlist (`src/lib/domain/currency.ts`) transcribed from official PayPal docs, verified in Sandbox, USD default
- [ ] Onboarding and settings forms with `PUT /api/profile` (Zod)
- [ ] Dashboard skeleton powered by `GET /api/progress` (derived lock states)

## Phase 3 — Domain core and content model
- [ ] Zod content schemas (`src/content/schema.ts`) and the render/answer-key file split with `server-only`
- [ ] Module definitions and starting-funds config (needs product-owner value, PRODUCT_SPEC §12)
- [ ] Pure domain modules + unit tests: state machine, money/rounding, wallet ledger math, unlock rules, scoring,
      fallback keyword evaluator
- [ ] Content validation tests (anchors exist, deny-listed judgment words, reserved TLDs, ≥1 legitimate scenario,
      payable % sum ≤ 100%)
- [ ] Author the **first** scenario end to end (render + answer key) as the reference implementation

## Phase 4 — Immersive scenario engine (no AI, no payments yet)
- [ ] Environment renderers: EmailClient, ChatWindow, FakeBrowser (inert address bar), InvoiceView,
      MarketplaceView, PaymentRequest. All are responsive and keyboard operable
- [ ] Decisions bound to environment-native actions + final-decision confirmation (not a multiple-choice list)
- [ ] Inert credential/OTP inputs (never transmitted)
- [ ] Attempt APIs: create/resume, get (client-safe), events, decision, justification
- [ ] Justification step (20–1000 chars), locking
- [ ] Leak test: API payload snapshots contain no answer-key fields before COMPLETED

## Phase 5 — PayPal Sandbox checkout + fictional wallet
- [ ] `paypal.ts` (OAuth token cache, create order, capture, Sandbox guard, idempotency keys)
- [ ] `/api/paypal/orders`, `/capture`, `/cancel` and the `record_capture` transaction
- [ ] PayPal Buttons inside payable scenario environments (currency = module run currency)
- [ ] Wallet display, MODULE_START reset at module start, ledger history
- [ ] Failure, cancel, and retry paths. E2E with Sandbox test accounts

## Phase 6 — Gemini integration with fallbacks
- [ ] `gemini.ts` client with timeout/retry, Zod output parsing, versioned prompts
- [ ] Scenario personalization (slots) with authored defaults
- [ ] Reasoning evaluation (evidence IDs, feedback, separate humor) + correctness guard + fallback evaluator
- [ ] Tests that simulate Gemini down or returning invalid output → app fully usable

## Phase 7 — Results and Reveal the Red Flags
- [ ] `/play/[attemptId]/results` gated on COMPLETED
- [ ] Feedback view (praise first, outcome, wallet impact, AI feedback, separate humor, safest next step)
- [ ] Reveal mode: re-render the environment with evidence highlights labeled red flag / worth verifying / positive,
      with explanations and "you mentioned this" markers. Labels use icon + text, never color alone
- [ ] Relevant Recovery Playbook sections at the end of results

## Phase 8 — Remaining scenario content
- [ ] Author scenarios 2–6 per PRODUCT_SPEC §3.3 (after the product owner confirms the storylines)
- [ ] Payment percentages, evidence, keywords, fallback texts, Playbook links
- [ ] Content review against the core principles + R8–R17, R28–R30

## Phase 9 — Module completion: badge, certificate, report, Zapier
- [ ] `complete_attempt` module-completion logic (badge + certificate rows, next module unlock)
- [ ] Completion page: badge, on-screen certificate (no download)
- [ ] Zapier webhook integration + email form + retry + rate limit; Zap configured with a shared secret
- [ ] `@react-pdf/renderer` analysis report via `GET /api/modules/[moduleKey]/report`

## Phase 10 — Your Recovery Playbook
- [ ] Research and transcribe verified U.S. PayPal policy content from official sources (URL + last-verified date per
      section)
- [ ] `/playbook` pages; links from results and the report
- [ ] Review: no invented policies, timelines, statistics, or guarantees

## Phase 11 — Sensei Kenshi
- [ ] `/api/chat` (streaming) with grounding rules (completed attempts only, Playbook excerpts)
- [ ] Floating panel + `/sensei` page; history; rate limit; fallback message
- [ ] Tests: refuses hints for in-progress scenarios; no policy invention prompts pass through

## Phase 12 — Hardening and launch
- [ ] Playwright E2E: full journey through 3 modules (with Sandbox), plus degraded modes (Gemini/Zapier off)
- [ ] Responsive QA (360, 768, 1024, 1440), accessibility audit, CSP headers
- [ ] Security review (RLS, ownership checks, secret exposure, payload leaks)
- [ ] Deployment (Vercel + Supabase), production env vars (still Sandbox), demo accounts
