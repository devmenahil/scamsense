-- =====================================================================================================================
-- ScamSense — Step 5 review: USD is the only selectable currency until PayPal merchant verification
--
-- Product decision (2026-11-09): only offer currencies confirmed to work with the configured PayPal Sandbox merchant
-- and Checkout integration. None has been verified yet, so the allowlist in src/lib/domain/currency.ts is USD only
-- and this constraint matches it (src/lib/profile/migration.test.ts fails if they drift).
--
-- Existing profiles with another preferred currency are moved to USD. Module runs are NOT touched: a started module
-- keeps the currency it was started in (its ledger and amounts stay consistent), and the new preference applies from
-- the next module start.
--
-- Run once in the Supabase SQL Editor, after 20261109120000_progression_wallet.sql.
-- =====================================================================================================================

update public.profiles set preferred_currency = 'USD' where preferred_currency <> 'USD';

alter table public.profiles drop constraint if exists profiles_preferred_currency_check;
alter table public.profiles add
  constraint profiles_preferred_currency_check
    check (preferred_currency in ('USD'));
