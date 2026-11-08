# ScamSense

> Scammers don't give you a practice round. ScamSense does.

ScamSense is a desktop-first, fully responsive web app (PayPal AI Hackathon project) that teaches adults (18+) to
recognise, investigate, avoid, and respond to financial scams through immersive, fictional financial simulations.
It uses PayPal **Sandbox** only. No real money ever moves.

- Product rules: [`CLAUDE.md`](CLAUDE.md)
- Specification: [`docs/PRODUCT_SPEC.md`](docs/PRODUCT_SPEC.md) · Architecture: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
  · Data model: [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md) · Build plan: [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md)

## Current status: Phase 1 (foundation and brand design system)

What works today:

- Brand design system: tokens, Logo, icons, and UI primitives (Button, Card, Badge, Input family, Modal/Dialog,
  ProgressBar, PageHeader, FeedbackBanner, EmptyState, LoadingState).
- Responsive navigation: header navigation on desktop, bottom navigation below 1024px.
- Landing page with real content.
- Page shells that use **clearly labelled demonstration data**:

| Page | Route |
|---|---|
| Landing | `/` |
| Sign up / Sign in | `/sign-up`, `/sign-in` |
| Onboarding | `/onboarding` |
| Dashboard | `/dashboard` |
| Modules / Module overview | `/modules`, `/modules/spot-the-trap` |
| Scenario player (demo) | `/play/demo` |
| Scenario feedback + Reveal the Red Flags | `/play/demo/results` |
| Module completion (badge, certificate, report) | `/modules/spot-the-trap/complete` |
| Certificates | `/certificates` |
| My Profile | `/profile` |
| Sensei Kenshi | `/sensei` |
| Your Recovery Playbook | `/playbook` |

Not built yet (by design): authentication, database, Gemini, PayPal Sandbox checkout, Zapier email, PDF reports,
and verified Recovery Playbook content. These arrive in later phases (see the implementation plan). Forms validate
your input and continue to the next screen, but nothing is stored or sent.

## Getting started

Requires Node.js 20+ (developed on Node 24).

```bash
npm install
cp .env.example .env.local   # optional in Phase 1; all values may stay blank
npm run dev                  # http://localhost:3000
```

The app refuses to start if `PAYPAL_ENV` is set to anything other than `sandbox`, or if `PAYPAL_API_BASE` is not
the Sandbox host.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and server |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript (`strict`) |
| `npm test` | Vitest unit tests (env guard, money formatting, navigation integrity) |
| `npm run format` | Prettier (with Tailwind class sorting) |

## Project layout

```
src/app/(marketing)   public pages: landing, Recovery Playbook
src/app/(auth)        sign-in / sign-up
src/app/(app)         app shell + dashboard, modules, play, profile, certificates, sensei
src/components/ui     brand primitives
src/components/…      brand, icons, layout, dashboard, scenario, feedback, certificate, chat
src/content           module definitions, onboarding option lists
src/lib               env validation, navigation, formatting, demo data (Phase 1 only)
```

## Brand

Teal `#0B5F66`, yellow `#FFC93C`, and white, plus their tints and shades. Headings and buttons use Nunito, and body
text uses Inter. Shapes are rounded, and buttons have a pressable bottom edge. There are no red or green status
colours, and meaning is never carried by colour alone. All tokens live in `src/app/globals.css`. Do not hardcode
hex values in components.
