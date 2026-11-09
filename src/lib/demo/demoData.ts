/**
 * DEMONSTRATION DATA — the Phase 7 results/Reveal design shell only (/play/demo/results). The scenario player
 * itself runs on real attempts since Step 6.
 * Dashboard, modules, and certificates use real progress since Phase 3 (Step 5).
 *
 * Nothing here is real progress, money, or evaluation. Every screen that renders this data shows the
 * <DemoNotice /> label. Phase 2+ replaces these values with server data (GET /api/progress etc.).
 * Amounts are integer minor units (R38).
 */

export const DEMO_WALLET = {
  currency: "USD",
  minorUnitDigits: 2,
  balanceMinor: 50_000,
  startingMinor: 50_000,
} as const;

export const DEMO_ATTEMPT_ID = "demo";
