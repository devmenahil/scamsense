-- =====================================================================================================================
-- ScamSense — Step 7: genuine PayPal SANDBOX checkout (Orders v2) for payable scenario decisions
--
-- Changes
--   1. scenario_payment_basis_points(): SQL mirror of src/content/modules.ts paymentBasisPoints (drift-tested), so the
--      database can re-derive every order amount on its own.
--   2. payment_transactions: one row per PayPal Sandbox order created for an attempt (scored attempt OR practice
--      replay). Order id, capture id, PayPal-Request-Id, server-computed amount/currency, statuses, the practice flag,
--      the fictional-wallet link, and the outcome classification (pending until the attempt completes, R10).
--   3. record_payment_order(): stores a freshly created (or re-returned) PayPal order after re-checking ownership, the
--      PAYMENT_PENDING state, the checkout sequence (= the PayPal-Request-Id), the amount, the currency, the
--      remaining Training Funds, and that no other order for the attempt is open or captured.
--   4. record_payment_capture(): the ONLY way a payment becomes real for ScamSense. In ONE transaction: verifies the
--      capture against the stored order, marks it CAPTURED, debits the official ledger exactly once (scored attempt
--      only; idempotency key = PayPal-Request-Id), and moves the attempt PAYMENT_PENDING → PAYMENT_COMPLETED →
--      FINALIZED. Idempotent for the same capture id.
--   5. update_payment_order(): PENDING (capture still processing at PayPal), CANCELLED (buyer cancelled) or FAILED
--      (declined / voided / unverifiable). Cancelled and failed orders also move the attempt to PAYMENT_CANCELLED.
--   6. complete_scenario_attempt(): additionally classifies the attempt's captured payment row (scored or practice)
--      as 'spending' or 'fraud_loss' when the attempt completes. Signature unchanged.
--
-- Trust model unchanged: users can only SELECT their own rows; every write is a SECURITY DEFINER function executable
-- by service_role only. environment is pinned to 'sandbox' (R28, R31).
--
-- Never edit this file once applied — add a new migration.
-- Run once: Supabase Dashboard → SQL Editor → paste this whole file → Run. Requires the four earlier migrations.
-- =====================================================================================================================

-- ---------------------------------------------------------------------------------------------------------------------
-- 1. Payment percentages (mirror of src/content/modules.ts; paypalMigration.test.ts fails if they drift)
-- ---------------------------------------------------------------------------------------------------------------------
create or replace function public.scenario_payment_basis_points(p_scenario_key text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case p_scenario_key
    when 'm1-s1' then 500
    when 'm1-s2' then 800
    when 'm2-s1' then 1000
    when 'm2-s2' then 1200
    when 'm3-s1' then 1500
    when 'm3-s2' then 2000
    else null
  end;
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 2. payment_transactions
-- ---------------------------------------------------------------------------------------------------------------------
create table if not exists public.payment_transactions (
  id                     uuid        primary key default gen_random_uuid(),
  user_id                uuid        not null references auth.users (id) on delete cascade,
  attempt_id             uuid        not null,
  module_run_id          uuid        not null,
  scenario_key           text        not null,
  is_practice            boolean     not null,
  decision_id            text        not null,
  checkout_sequence      integer     not null,
  environment            text        not null default 'sandbox',
  -- PayPal-Request-Id used to create the order (also the ledger idempotency key). One per (attempt, sequence).
  request_id             text        not null,
  paypal_order_id        text        not null,
  paypal_order_status    text,
  paypal_capture_id      text,
  paypal_capture_status  text,
  amount_minor           bigint      not null,
  currency               text        not null,
  percent_bp             integer     not null,
  -- CREATED: awaiting buyer approval · PENDING: capture processing at PayPal (not a payment yet)
  -- CAPTURED: verified COMPLETED capture · CANCELLED: buyer cancelled · FAILED: declined/voided/unverifiable
  status                 text        not null default 'CREATED',
  failure_code           text,
  -- Fictional-wallet meaning of a captured payment: 'pending' during play (nothing reveals legitimacy, R10), then
  -- 'spending' or 'fraud_loss' once, at completion. Kept separate from the PayPal status.
  outcome_classification text,
  -- Scored attempts only: the official Training Funds debit for this capture.
  ledger_entry_id        bigint      references public.wallet_ledger_entries (id),
  captured_at            timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),

  constraint payment_transactions_attempt_fk
    foreign key (attempt_id, user_id, module_run_id)
    references public.scenario_attempts (id, user_id, module_run_id) on delete cascade,
  constraint payment_transactions_environment_check check (environment = 'sandbox'),
  constraint payment_transactions_status_check
    check (status in ('CREATED', 'PENDING', 'CAPTURED', 'CANCELLED', 'FAILED')),
  constraint payment_transactions_amount_check check (amount_minor > 0 and amount_minor <= 100000000000),
  constraint payment_transactions_currency_check check (currency ~ '^[A-Z]{3}$'),
  constraint payment_transactions_percent_check check (percent_bp between 1 and 10000),
  constraint payment_transactions_sequence_check check (checkout_sequence >= 1),
  constraint payment_transactions_ids_check
    check (char_length(request_id) between 8 and 200
       and char_length(paypal_order_id) between 1 and 64
       and (paypal_capture_id is null or char_length(paypal_capture_id) between 1 and 64)
       and decision_id ~ '^[a-z0-9_]{1,64}$'),
  constraint payment_transactions_classification_check
    check (outcome_classification is null or outcome_classification in ('pending', 'spending', 'fraud_loss')),
  constraint payment_transactions_shape_check
    check (
      ((status = 'CAPTURED') = (captured_at is not null))
      and (status <> 'CAPTURED' or (paypal_capture_id is not null and outcome_classification is not null))
      and (status = 'CAPTURED' or (outcome_classification is null and ledger_entry_id is null))
      and (not is_practice or ledger_entry_id is null)
      and (is_practice or status <> 'CAPTURED' or ledger_entry_id is not null)
    ),
  constraint payment_transactions_request_id_key unique (request_id),
  constraint payment_transactions_order_id_key unique (paypal_order_id),
  constraint payment_transactions_capture_id_key unique (paypal_capture_id),
  constraint payment_transactions_attempt_sequence_key unique (attempt_id, checkout_sequence),
  constraint payment_transactions_ledger_entry_key unique (ledger_entry_id)
);

-- At most one captured payment and at most one open order per attempt (double clicks and retries can't add more).
create unique index if not exists payment_transactions_one_captured_idx
  on public.payment_transactions (attempt_id) where status = 'CAPTURED';
create unique index if not exists payment_transactions_one_open_idx
  on public.payment_transactions (attempt_id) where status in ('CREATED', 'PENDING');
create index if not exists payment_transactions_user_idx on public.payment_transactions (user_id, created_at);

comment on table public.payment_transactions is
  'PayPal SANDBOX orders for scenario pay decisions (scored attempts and practice replays). Never live money.';

-- Identity is immutable; statuses only move forward; a captured row only changes its classification, once.
create or replace function public.payment_transactions_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (to_jsonb(new) - 'status' - 'paypal_order_status' - 'paypal_capture_id' - 'paypal_capture_status'
        - 'failure_code' - 'outcome_classification' - 'ledger_entry_id' - 'captured_at' - 'updated_at')
     is distinct from
     (to_jsonb(old) - 'status' - 'paypal_order_status' - 'paypal_capture_id' - 'paypal_capture_status'
        - 'failure_code' - 'outcome_classification' - 'ledger_entry_id' - 'captured_at' - 'updated_at') then
    raise exception 'payment_identity_immutable' using errcode = 'P0001';
  end if;
  if old.status in ('CANCELLED', 'FAILED') then
    raise exception 'payment_closed' using errcode = 'P0001';
  end if;
  if old.paypal_capture_id is not null and new.paypal_capture_id is distinct from old.paypal_capture_id then
    raise exception 'capture_id_immutable' using errcode = 'P0001';
  end if;
  if old.status = 'CAPTURED' then
    if (to_jsonb(new) - 'outcome_classification' - 'updated_at')
         is distinct from (to_jsonb(old) - 'outcome_classification' - 'updated_at')
       or not coalesce(old.outcome_classification = 'pending'
                       and new.outcome_classification in ('spending', 'fraud_loss'), false) then
      raise exception 'payment_captured_final' using errcode = 'P0001';
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists payment_transactions_before_update on public.payment_transactions;
create trigger payment_transactions_before_update
  before update on public.payment_transactions
  for each row execute function public.payment_transactions_before_update();

-- ---------------------------------------------------------------------------------------------------------------------
-- 3. record_payment_order — store the order PayPal created for the attempt's current checkout
-- ---------------------------------------------------------------------------------------------------------------------
create or replace function public.record_payment_order(
  p_user_id uuid,
  p_attempt_id uuid,
  p_request_id text,
  p_paypal_order_id text,
  p_paypal_order_status text,
  p_amount_minor bigint,
  p_currency text
)
returns public.payment_transactions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.payment_transactions;
  v_attempt public.scenario_attempts;
  v_run public.module_runs;
  v_sequence integer;
  v_bp integer;
  v_expected bigint;
  v_balance bigint;
begin
  -- Idempotent: the same PayPal-Request-Id returns the same PayPal order, and here the same row.
  select * into v_payment from public.payment_transactions where request_id = p_request_id;
  if found then
    if v_payment.user_id <> p_user_id or v_payment.attempt_id <> p_attempt_id
       or v_payment.paypal_order_id <> p_paypal_order_id then
      raise exception 'payment_order_mismatch' using errcode = 'P0001';
    end if;
    return v_payment;
  end if;

  select * into v_attempt from public.scenario_attempts
  where id = p_attempt_id and user_id = p_user_id for update;
  if not found then
    raise exception 'attempt_not_found' using errcode = 'P0001';
  end if;
  if v_attempt.state <> 'PAYMENT_PENDING' or v_attempt.decision_id is null then
    raise exception 'attempt_state_conflict' using errcode = 'P0001';
  end if;

  -- The checkout sequence is derived from the attempt's own log: 1 + RETRY_PAYMENT events.
  select 1 + count(*) into v_sequence from public.scenario_attempt_events
  where attempt_id = p_attempt_id and event_type = 'RETRY_PAYMENT';
  if p_request_id <> 'scamsense-' || p_attempt_id::text || '-checkout-' || v_sequence::text then
    raise exception 'checkout_sequence_mismatch' using errcode = 'P0001';
  end if;

  select * into v_run from public.module_runs where id = v_attempt.module_run_id for update;
  if p_currency is distinct from v_run.currency then
    raise exception 'currency_mismatch' using errcode = 'P0001';
  end if;
  v_bp := public.scenario_payment_basis_points(v_attempt.scenario_key);
  if v_bp is null then
    raise exception 'scenario_not_payable' using errcode = 'P0001';
  end if;
  -- Same half-up integer rounding as percentOfMinor() in src/lib/domain/money.ts.
  v_expected := (v_run.starting_funds_minor * v_bp + 5000) / 10000;
  if p_amount_minor is null or p_amount_minor <> v_expected or v_expected <= 0 then
    raise exception 'amount_mismatch' using errcode = 'P0001';
  end if;

  if exists (select 1 from public.payment_transactions where attempt_id = p_attempt_id and status = 'CAPTURED') then
    raise exception 'attempt_already_paid' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.payment_transactions
             where attempt_id = p_attempt_id and status in ('CREATED', 'PENDING')) then
    raise exception 'payment_order_open' using errcode = 'P0001';
  end if;

  if not v_attempt.is_replay then
    if exists (select 1 from public.wallet_ledger_entries where attempt_id = p_attempt_id and entry_type = 'PAYMENT') then
      raise exception 'duplicate_attempt_payment' using errcode = 'P0001';
    end if;
    select coalesce(sum(amount_minor), 0) into v_balance
    from public.wallet_ledger_entries where module_run_id = v_run.id;
    if v_expected > v_balance then
      raise exception 'insufficient_funds' using errcode = 'P0001';
    end if;
  end if;

  insert into public.payment_transactions
    (user_id, attempt_id, module_run_id, scenario_key, is_practice, decision_id, checkout_sequence, request_id,
     paypal_order_id, paypal_order_status, amount_minor, currency, percent_bp)
  values
    (p_user_id, p_attempt_id, v_attempt.module_run_id, v_attempt.scenario_key, v_attempt.is_replay,
     v_attempt.decision_id, v_sequence, p_request_id, p_paypal_order_id, p_paypal_order_status, v_expected,
     v_run.currency, v_bp)
  returning * into v_payment;
  return v_payment;
end;
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 4. record_payment_capture — verified COMPLETED capture → CAPTURED + ledger (scored only) + attempt FINALIZED
-- ---------------------------------------------------------------------------------------------------------------------
create or replace function public.record_payment_capture(
  p_user_id uuid,
  p_payment_id uuid,
  p_paypal_capture_id text,
  p_paypal_capture_status text,
  p_paypal_order_status text,
  p_amount_minor bigint,
  p_currency text
)
returns public.payment_transactions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.payment_transactions;
  v_attempt public.scenario_attempts;
  v_entry public.wallet_ledger_entries;
begin
  select * into v_payment from public.payment_transactions
  where id = p_payment_id and user_id = p_user_id for update;
  if not found then
    raise exception 'payment_not_found' using errcode = 'P0001';
  end if;
  if v_payment.status = 'CAPTURED' then
    if v_payment.paypal_capture_id = p_paypal_capture_id then
      return v_payment; -- the same verified capture recorded again: nothing changes
    end if;
    raise exception 'capture_mismatch' using errcode = 'P0001';
  end if;
  if v_payment.status not in ('CREATED', 'PENDING') then
    raise exception 'payment_closed' using errcode = 'P0001';
  end if;
  if p_paypal_capture_status is distinct from 'COMPLETED' or p_paypal_capture_id is null then
    raise exception 'capture_not_completed' using errcode = 'P0001';
  end if;
  if p_amount_minor is distinct from v_payment.amount_minor or p_currency is distinct from v_payment.currency then
    raise exception 'capture_amount_mismatch' using errcode = 'P0001';
  end if;

  select * into v_attempt from public.scenario_attempts
  where id = v_payment.attempt_id and user_id = p_user_id for update;
  if v_attempt.state <> 'PAYMENT_PENDING' then
    raise exception 'attempt_state_conflict' using errcode = 'P0001';
  end if;

  if not v_payment.is_practice then
    v_entry := public.record_training_payment(p_user_id, v_payment.attempt_id, v_payment.amount_minor,
                                              v_payment.request_id);
  end if;

  update public.payment_transactions
    set status = 'CAPTURED',
        paypal_capture_id = p_paypal_capture_id,
        paypal_capture_status = p_paypal_capture_status,
        paypal_order_status = p_paypal_order_status,
        failure_code = null,
        outcome_classification = 'pending',
        ledger_entry_id = v_entry.id,
        captured_at = now()
    where id = p_payment_id
    returning * into v_payment;

  perform public.apply_attempt_event(p_user_id, v_payment.attempt_id, 'PAYMENT_PENDING', 'PAYMENT_COMPLETED',
                                     'PAYMENT_CAPTURED', null, null, null);
  perform public.apply_attempt_event(p_user_id, v_payment.attempt_id, 'PAYMENT_COMPLETED', 'FINALIZED',
                                     'FINALIZE', null, null, null);
  return v_payment;
end;
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 5. update_payment_order — PENDING capture, buyer cancellation, or failure (never a payment)
-- ---------------------------------------------------------------------------------------------------------------------
create or replace function public.update_payment_order(
  p_user_id uuid,
  p_payment_id uuid,
  p_status text,
  p_paypal_order_status text,
  p_paypal_capture_id text,
  p_paypal_capture_status text,
  p_failure_code text
)
returns public.payment_transactions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.payment_transactions;
  v_attempt public.scenario_attempts;
begin
  if p_status not in ('PENDING', 'CANCELLED', 'FAILED') then
    raise exception 'invalid_payment_status' using errcode = 'P0001';
  end if;
  select * into v_payment from public.payment_transactions
  where id = p_payment_id and user_id = p_user_id for update;
  if not found then
    raise exception 'payment_not_found' using errcode = 'P0001';
  end if;
  if v_payment.status = p_status and p_status <> 'PENDING' then
    return v_payment; -- repeated cancel/fail: idempotent
  end if;
  if v_payment.status not in ('CREATED', 'PENDING') then
    raise exception 'payment_closed' using errcode = 'P0001';
  end if;

  update public.payment_transactions
    set status = p_status,
        paypal_order_status = coalesce(p_paypal_order_status, paypal_order_status),
        paypal_capture_id = coalesce(paypal_capture_id, p_paypal_capture_id),
        paypal_capture_status = coalesce(p_paypal_capture_status, paypal_capture_status),
        failure_code = left(p_failure_code, 64)
    where id = p_payment_id
    returning * into v_payment;

  if p_status in ('CANCELLED', 'FAILED') then
    select * into v_attempt from public.scenario_attempts
    where id = v_payment.attempt_id and user_id = p_user_id for update;
    if v_attempt.state = 'PAYMENT_PENDING' then
      perform public.apply_attempt_event(p_user_id, v_payment.attempt_id, 'PAYMENT_PENDING', 'PAYMENT_CANCELLED',
                                         case p_status when 'CANCELLED' then 'PAYMENT_CANCELLED'
                                                       else 'PAYMENT_FAILED' end,
                                         null, null, null);
    end if;
  end if;
  return v_payment;
end;
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 6. complete_scenario_attempt — also classifies the attempt's captured Sandbox payment (scored or practice)
-- ---------------------------------------------------------------------------------------------------------------------
create or replace function public.complete_scenario_attempt(
  p_user_id uuid,
  p_attempt_id uuid,
  p_decision_correct boolean,
  p_decision_points smallint,
  p_reasoning_points smallint,
  p_verification_points smallint,
  p_payment_safety_points smallint,
  p_reasoning_source text,
  p_addressed_evidence_ids text[],
  p_verification_action_ids text[],
  p_scoring_version text,
  p_payment_classification text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt public.scenario_attempts;
  v_run public.module_runs;
  v_has_payment boolean;
  v_has_capture boolean;
  v_completed_scenarios integer;
begin
  select * into v_attempt from public.scenario_attempts
  where id = p_attempt_id and user_id = p_user_id for update;
  if not found then
    raise exception 'attempt_not_found' using errcode = 'P0001';
  end if;

  if v_attempt.state <> 'COMPLETED' then
    if v_attempt.state <> 'RECOVERY_AVAILABLE' then
      raise exception 'attempt_not_ready_for_completion' using errcode = 'P0001';
    end if;

    select exists (
      select 1 from public.wallet_ledger_entries where attempt_id = p_attempt_id and entry_type = 'PAYMENT'
    ) into v_has_payment;
    select exists (
      select 1 from public.payment_transactions where attempt_id = p_attempt_id and status = 'CAPTURED'
    ) into v_has_capture;
    if (v_has_payment or v_has_capture)
       and coalesce(p_payment_classification, '') not in ('spending', 'fraud_loss') then
      raise exception 'payment_classification_required' using errcode = 'P0001';
    end if;

    perform set_config('scamsense.completing', 'on', true);
    update public.scenario_attempts
      set state = 'COMPLETED', completed_at = now(), decision_correct = p_decision_correct
      where id = p_attempt_id
      returning * into v_attempt;
    perform set_config('scamsense.completing', 'off', true);

    insert into public.scenario_attempt_events
      (user_id, attempt_id, module_run_id, event_type, from_state, to_state)
    values
      (p_user_id, p_attempt_id, v_attempt.module_run_id, 'COMPLETE', 'RECOVERY_AVAILABLE', 'COMPLETED');

    insert into public.scenario_scores
      (attempt_id, user_id, module_run_id, scenario_key, is_replay, decision_correct, decision_points,
       reasoning_points, verification_points, payment_safety_points, reasoning_source, addressed_evidence_ids,
       verification_action_ids, scoring_version)
    values
      (p_attempt_id, p_user_id, v_attempt.module_run_id, v_attempt.scenario_key, v_attempt.is_replay,
       p_decision_correct, p_decision_points, p_reasoning_points, p_verification_points, p_payment_safety_points,
       p_reasoning_source, coalesce(p_addressed_evidence_ids, '{}'), coalesce(p_verification_action_ids, '{}'),
       p_scoring_version);

    if v_has_payment then
      update public.wallet_ledger_entries
        set classification = p_payment_classification
        where attempt_id = p_attempt_id and entry_type = 'PAYMENT';
    end if;
    if v_has_capture then
      update public.payment_transactions
        set outcome_classification = p_payment_classification
        where attempt_id = p_attempt_id and status = 'CAPTURED';
    end if;
  end if;

  select * into v_run from public.module_runs where id = v_attempt.module_run_id for update;
  if v_run.completed_at is null and not v_attempt.is_replay then
    select count(distinct scenario_key) into v_completed_scenarios
    from public.scenario_attempts
    where module_run_id = v_run.id and state = 'COMPLETED' and attempt_number = 1;
    if v_completed_scenarios >= 2 then
      update public.module_runs
        set completed_at = now(),
            closing_balance_minor = (select coalesce(sum(amount_minor), 0)
                                     from public.wallet_ledger_entries where module_run_id = v_run.id)
        where id = v_run.id
        returning * into v_run;
    end if;
  end if;

  return jsonb_build_object(
    'attempt_id', v_attempt.id,
    'is_replay', v_attempt.is_replay,
    'module_run_id', v_run.id,
    'module_completed', v_run.completed_at is not null
  );
end;
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 7. Row Level Security and privileges
-- ---------------------------------------------------------------------------------------------------------------------
alter table public.payment_transactions enable row level security;

drop policy if exists "payment_transactions_select_own" on public.payment_transactions;
create policy "payment_transactions_select_own" on public.payment_transactions
  for select to authenticated using ((select auth.uid()) = user_id);

revoke all on table public.payment_transactions from public, anon, authenticated, service_role;
grant select on table public.payment_transactions to authenticated, service_role;

revoke all on function public.record_payment_order(uuid, uuid, text, text, text, bigint, text)
  from public, anon, authenticated;
revoke all on function public.record_payment_capture(uuid, uuid, text, text, text, bigint, text)
  from public, anon, authenticated;
revoke all on function public.update_payment_order(uuid, uuid, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.record_payment_order(uuid, uuid, text, text, text, bigint, text) to service_role;
grant execute on function public.record_payment_capture(uuid, uuid, text, text, text, bigint, text) to service_role;
grant execute on function public.update_payment_order(uuid, uuid, text, text, text, text, text) to service_role;

revoke all on function public.scenario_payment_basis_points(text) from public, anon, authenticated;
revoke all on function public.payment_transactions_before_update() from public, anon, authenticated;

revoke all on function public.complete_scenario_attempt(
  uuid, uuid, boolean, smallint, smallint, smallint, smallint, text, text[], text[], text, text
) from public, anon, authenticated;
grant execute on function public.complete_scenario_attempt(
  uuid, uuid, boolean, smallint, smallint, smallint, smallint, text, text[], text[], text, text
) to service_role;
