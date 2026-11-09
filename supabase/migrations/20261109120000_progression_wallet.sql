-- =====================================================================================================================
-- ScamSense — Phase 3 (Step 5): module progression, fictional training wallet, scenario scores
--
-- Tables:   module_runs · scenario_attempts · wallet_ledger_entries · scenario_scores
-- Functions (service_role only): start_module_run · create_scenario_attempt · record_training_payment ·
--                                complete_scenario_attempt
--
-- Trust model. Users can READ their own rows (RLS) and can WRITE NOTHING directly. Every write goes through the
-- ScamSense server, which computes money, correctness and points with deterministic TypeScript (src/lib/domain/*,
-- R32) and calls the functions below with the server-only Supabase secret key (role `service_role`). Those functions
-- are not executable by `anon` or `authenticated`, so a browser holding the publishable key cannot award itself
-- points, complete scenarios, or move training funds.
--
-- The database independently enforces the money invariants (R18–R20, R38): integer minor units, one MODULE_START per
-- module run, at most one PAYMENT per attempt and per idempotency key (no duplicate deductions), balance never below
-- zero, append-only ledger and scores, and unlock order between modules.
--
-- The key lists below mirror src/content/modules.ts; src/lib/domain/progressionMigration.test.ts fails if they drift.
-- Never edit this file once applied — add a new migration.
--
-- Run once: Supabase Dashboard → SQL Editor → paste this whole file → Run. Requires 20261109000000_profiles.sql.
-- =====================================================================================================================

-- ---------------------------------------------------------------------------------------------------------------------
-- 1. module_runs — one per (user, module): the module's training-funds period (the R20 "reset")
-- ---------------------------------------------------------------------------------------------------------------------
create table if not exists public.module_runs (
  id                    uuid        primary key default gen_random_uuid(),
  user_id               uuid        not null references auth.users (id) on delete cascade,
  module_key            text        not null,
  currency              text        not null,
  starting_funds_minor  bigint      not null,
  closing_balance_minor bigint,
  started_at            timestamptz not null default now(),
  completed_at          timestamptz,

  constraint module_runs_module_key_check
    check (module_key in ('spot-the-trap', 'trust-under-pressure', 'outsmart-the-scam')),
  constraint module_runs_currency_check
    check (currency ~ '^[A-Z]{3}$'),
  constraint module_runs_starting_funds_check
    check (starting_funds_minor > 0 and starting_funds_minor <= 100000000000),
  constraint module_runs_closing_check
    check (
      (completed_at is null) = (closing_balance_minor is null)
      and (closing_balance_minor is null or closing_balance_minor between 0 and starting_funds_minor)
    ),
  constraint module_runs_user_module_key unique (user_id, module_key),
  constraint module_runs_id_user_key unique (id, user_id),
  constraint module_runs_id_user_module_key unique (id, user_id, module_key)
);

comment on table public.module_runs is
  'One training-funds period per user and module. Fictional money only; independent of any PayPal balance (R18).';

-- ---------------------------------------------------------------------------------------------------------------------
-- 2. scenario_attempts — first plays and replays. attempt_number 1 is the scored attempt; > 1 are practice replays.
-- ---------------------------------------------------------------------------------------------------------------------
create table if not exists public.scenario_attempts (
  id                          uuid        primary key default gen_random_uuid(),
  user_id                     uuid        not null references auth.users (id) on delete cascade,
  module_run_id               uuid        not null,
  module_key                  text        not null,
  scenario_key                text        not null,
  attempt_number              integer     not null,
  is_replay                   boolean     generated always as (attempt_number > 1) stored,
  content_version             text        not null,
  state                       text        not null default 'INTRO',
  decision_id                 text,
  decision_committed_at       timestamptz,
  justification               text,
  justification_submitted_at  timestamptz,
  decision_correct            boolean,
  completed_at                timestamptz,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),

  constraint scenario_attempts_run_fk
    foreign key (module_run_id, user_id, module_key)
    references public.module_runs (id, user_id, module_key) on delete cascade,
  constraint scenario_attempts_scenario_key_check
    check ((module_key, scenario_key) in (
      ('spot-the-trap', 'm1-s1'), ('spot-the-trap', 'm1-s2'),
      ('trust-under-pressure', 'm2-s1'), ('trust-under-pressure', 'm2-s2'),
      ('outsmart-the-scam', 'm3-s1'), ('outsmart-the-scam', 'm3-s2')
    )),
  constraint scenario_attempts_attempt_number_check check (attempt_number >= 1),
  constraint scenario_attempts_content_version_check check (char_length(content_version) between 1 and 64),
  constraint scenario_attempts_state_check
    check (state in ('INTRO', 'EXPLORING', 'PAYMENT_PENDING', 'AWAITING_JUSTIFICATION', 'EVALUATING', 'COMPLETED')),
  constraint scenario_attempts_justification_check
    check (justification is null or char_length(justification) between 20 and 1000),
  constraint scenario_attempts_completion_check
    check ((state = 'COMPLETED') = (completed_at is not null) and (state = 'COMPLETED') = (decision_correct is not null)),
  constraint scenario_attempts_user_scenario_number_key unique (user_id, scenario_key, attempt_number),
  constraint scenario_attempts_id_owner_key unique (id, user_id, module_run_id)
);

-- At most one unfinished attempt per user and scenario: the user resumes it instead of opening another.
create unique index if not exists scenario_attempts_one_open_idx
  on public.scenario_attempts (user_id, scenario_key)
  where state <> 'COMPLETED';

create index if not exists scenario_attempts_run_idx on public.scenario_attempts (module_run_id);

-- ---------------------------------------------------------------------------------------------------------------------
-- 3. wallet_ledger_entries — append-only training-funds ledger. Balance = sum(amount_minor) per module run.
-- ---------------------------------------------------------------------------------------------------------------------
create table if not exists public.wallet_ledger_entries (
  id                  bigint      generated always as identity primary key,
  user_id             uuid        not null references auth.users (id) on delete cascade,
  module_run_id       uuid        not null,
  attempt_id          uuid,
  entry_type          text        not null,
  amount_minor        bigint      not null,
  balance_after_minor bigint      not null,
  currency            text        not null,
  -- PAYMENT only. 'pending' while the scenario is being played (nothing about legitimacy is stored during play,
  -- R10); set once to 'spending' (ordinary purchase) or 'fraud_loss' (lost to a scam) when the attempt completes.
  classification      text,
  idempotency_key     text,
  created_at          timestamptz not null default now(),

  constraint wallet_ledger_run_fk
    foreign key (module_run_id, user_id) references public.module_runs (id, user_id) on delete cascade,
  constraint wallet_ledger_attempt_fk
    foreign key (attempt_id, user_id, module_run_id)
    references public.scenario_attempts (id, user_id, module_run_id) on delete cascade,
  constraint wallet_ledger_entry_type_check check (entry_type in ('MODULE_START', 'PAYMENT')),
  constraint wallet_ledger_balance_check check (balance_after_minor >= 0),
  constraint wallet_ledger_currency_check check (currency ~ '^[A-Z]{3}$'),
  constraint wallet_ledger_classification_check
    check (classification is null or classification in ('pending', 'spending', 'fraud_loss')),
  constraint wallet_ledger_shape_check
    check (
      (entry_type = 'MODULE_START' and amount_minor > 0 and attempt_id is null
        and classification is null and idempotency_key is null)
      or
      (entry_type = 'PAYMENT' and amount_minor < 0 and attempt_id is not null
        and classification is not null and char_length(idempotency_key) between 8 and 200)
    ),
  constraint wallet_ledger_idempotency_key unique (idempotency_key)
);

create unique index if not exists wallet_ledger_one_start_per_run_idx
  on public.wallet_ledger_entries (module_run_id) where entry_type = 'MODULE_START';
create unique index if not exists wallet_ledger_one_payment_per_attempt_idx
  on public.wallet_ledger_entries (attempt_id) where entry_type = 'PAYMENT';
create index if not exists wallet_ledger_run_idx on public.wallet_ledger_entries (module_run_id, id);

-- ---------------------------------------------------------------------------------------------------------------------
-- 4. scenario_scores — one immutable deterministic score per completed attempt (40/30/20/10, src/lib/domain/scoring)
-- ---------------------------------------------------------------------------------------------------------------------
create table if not exists public.scenario_scores (
  attempt_id              uuid        primary key,
  user_id                 uuid        not null references auth.users (id) on delete cascade,
  module_run_id           uuid        not null,
  scenario_key            text        not null,
  is_replay               boolean     not null,
  decision_correct        boolean     not null,
  decision_points         smallint    not null,
  reasoning_points        smallint    not null,
  verification_points     smallint    not null,
  payment_safety_points   smallint    not null,
  total_points            smallint    generated always as
                            (decision_points + reasoning_points + verification_points + payment_safety_points) stored,
  max_points              smallint    not null default 100,
  reasoning_source        text        not null,
  addressed_evidence_ids  text[]      not null default '{}',
  verification_action_ids text[]      not null default '{}',
  scoring_version         text        not null,
  created_at              timestamptz not null default now(),

  constraint scenario_scores_attempt_fk
    foreign key (attempt_id, user_id, module_run_id)
    references public.scenario_attempts (id, user_id, module_run_id) on delete cascade,
  constraint scenario_scores_decision_check
    check (decision_points in (0, 40) and decision_correct = (decision_points = 40)),
  constraint scenario_scores_reasoning_check check (reasoning_points between 0 and 30),
  constraint scenario_scores_verification_check check (verification_points between 0 and 20),
  constraint scenario_scores_payment_safety_check check (payment_safety_points in (0, 10)),
  constraint scenario_scores_max_check check (max_points = 100),
  constraint scenario_scores_reasoning_source_check check (reasoning_source in ('gemini', 'fallback')),
  constraint scenario_scores_version_check check (char_length(scoring_version) between 1 and 64)
);

-- ---------------------------------------------------------------------------------------------------------------------
-- 5. Integrity triggers
-- ---------------------------------------------------------------------------------------------------------------------

-- module_runs: only completion (completed_at + closing balance) may be written, and only once.
create or replace function public.module_runs_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.completed_at is not null then
    raise exception 'module_run_final' using errcode = 'P0001';
  end if;
  if (to_jsonb(new) - 'completed_at' - 'closing_balance_minor')
     is distinct from (to_jsonb(old) - 'completed_at' - 'closing_balance_minor') then
    raise exception 'module_run_immutable' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists module_runs_before_update on public.module_runs;
create trigger module_runs_before_update
  before update on public.module_runs
  for each row execute function public.module_runs_before_update();

-- scenario_attempts: identity is immutable; decision and justification are write-once (R11); completed attempts are
-- final; COMPLETED can only be reached through complete_scenario_attempt (which also writes the score).
create or replace function public.scenario_attempts_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.state = 'COMPLETED' then
    raise exception 'attempt_final' using errcode = 'P0001';
  end if;
  if new.user_id <> old.user_id or new.module_run_id <> old.module_run_id or new.module_key <> old.module_key
     or new.scenario_key <> old.scenario_key or new.attempt_number <> old.attempt_number
     or new.created_at <> old.created_at or new.content_version <> old.content_version then
    raise exception 'attempt_identity_immutable' using errcode = 'P0001';
  end if;
  if (old.decision_id is not null and new.decision_id is distinct from old.decision_id)
     or (old.decision_committed_at is not null and new.decision_committed_at is distinct from old.decision_committed_at)
     or (old.justification is not null and new.justification is distinct from old.justification)
     or (old.justification_submitted_at is not null
         and new.justification_submitted_at is distinct from old.justification_submitted_at) then
    raise exception 'attempt_decision_locked' using errcode = 'P0001';
  end if;
  if new.state = 'COMPLETED' and coalesce(current_setting('scamsense.completing', true), '') <> 'on' then
    raise exception 'attempt_complete_via_function' using errcode = 'P0001';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists scenario_attempts_before_update on public.scenario_attempts;
create trigger scenario_attempts_before_update
  before update on public.scenario_attempts
  for each row execute function public.scenario_attempts_before_update();

-- wallet_ledger_entries: append-only. The single permitted change is classifying a pending payment, once.
create or replace function public.wallet_ledger_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (to_jsonb(new) - 'classification') is distinct from (to_jsonb(old) - 'classification')
     or not coalesce(old.classification = 'pending' and new.classification in ('spending', 'fraud_loss'), false) then
    raise exception 'ledger_append_only' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists wallet_ledger_before_update on public.wallet_ledger_entries;
create trigger wallet_ledger_before_update
  before update on public.wallet_ledger_entries
  for each row execute function public.wallet_ledger_before_update();

-- ---------------------------------------------------------------------------------------------------------------------
-- 6. Transactional operations (SECURITY DEFINER, executable by service_role only)
--    Errors use SQLSTATE P0001 with a stable machine-readable message that the server maps to a calm response.
-- ---------------------------------------------------------------------------------------------------------------------

-- Opens a module's training-funds period: the run row + its MODULE_START ledger entry, atomically. Idempotent: an
-- existing run is returned unchanged (funds are never reset twice). Enforces the unlock order (R7) independently of
-- the application: the previous module's run must be completed.
create or replace function public.start_module_run(
  p_user_id uuid,
  p_module_key text,
  p_currency text,
  p_starting_funds_minor bigint
)
returns public.module_runs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run public.module_runs;
  v_prerequisite text := case p_module_key
      when 'trust-under-pressure' then 'spot-the-trap'
      when 'outsmart-the-scam' then 'trust-under-pressure'
      else null
    end;
begin
  if p_user_id is null then
    raise exception 'user_required' using errcode = 'P0001';
  end if;
  select * into v_run from public.module_runs where user_id = p_user_id and module_key = p_module_key;
  if found then
    return v_run;
  end if;
  if v_prerequisite is not null and not exists (
    select 1 from public.module_runs
    where user_id = p_user_id and module_key = v_prerequisite and completed_at is not null
  ) then
    raise exception 'module_locked' using errcode = 'P0001';
  end if;

  insert into public.module_runs (user_id, module_key, currency, starting_funds_minor)
  values (p_user_id, p_module_key, p_currency, p_starting_funds_minor)
  on conflict (user_id, module_key) do nothing
  returning * into v_run;

  if v_run.id is null then
    -- A concurrent request created it first.
    select * into v_run from public.module_runs where user_id = p_user_id and module_key = p_module_key;
    return v_run;
  end if;

  insert into public.wallet_ledger_entries
    (user_id, module_run_id, entry_type, amount_minor, balance_after_minor, currency)
  values
    (p_user_id, v_run.id, 'MODULE_START', p_starting_funds_minor, p_starting_funds_minor, p_currency);
  return v_run;
end;
$$;

-- Creates a first attempt or a replay for a scenario, or returns the open attempt (resume). The module run must exist.
create or replace function public.create_scenario_attempt(
  p_user_id uuid,
  p_scenario_key text,
  p_content_version text
)
returns public.scenario_attempts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt public.scenario_attempts;
  v_run public.module_runs;
  v_module_key text := case left(p_scenario_key, 2)
      when 'm1' then 'spot-the-trap'
      when 'm2' then 'trust-under-pressure'
      when 'm3' then 'outsmart-the-scam'
      else null
    end;
begin
  if v_module_key is null then
    raise exception 'unknown_scenario' using errcode = 'P0001';
  end if;
  select * into v_run from public.module_runs where user_id = p_user_id and module_key = v_module_key for update;
  if not found then
    raise exception 'module_not_started' using errcode = 'P0001';
  end if;

  select * into v_attempt from public.scenario_attempts
  where user_id = p_user_id and scenario_key = p_scenario_key and state <> 'COMPLETED';
  if found then
    return v_attempt;
  end if;

  insert into public.scenario_attempts
    (user_id, module_run_id, module_key, scenario_key, attempt_number, content_version)
  values (
    p_user_id, v_run.id, v_module_key, p_scenario_key,
    coalesce((select max(attempt_number) from public.scenario_attempts
              where user_id = p_user_id and scenario_key = p_scenario_key), 0) + 1,
    p_content_version
  )
  returning * into v_attempt;
  return v_attempt;
end;
$$;

-- Debits the module's training funds for a scored attempt. Idempotent per key; at most one payment per attempt;
-- never below zero. Replays are practice and are never charged to the module's funds.
create or replace function public.record_training_payment(
  p_user_id uuid,
  p_attempt_id uuid,
  p_amount_minor bigint,
  p_idempotency_key text
)
returns public.wallet_ledger_entries
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entry public.wallet_ledger_entries;
  v_attempt public.scenario_attempts;
  v_run public.module_runs;
  v_balance bigint;
begin
  select * into v_entry from public.wallet_ledger_entries where idempotency_key = p_idempotency_key;
  if found then
    if v_entry.user_id <> p_user_id or v_entry.attempt_id <> p_attempt_id then
      raise exception 'idempotency_key_reused' using errcode = 'P0001';
    end if;
    return v_entry;
  end if;

  select * into v_attempt from public.scenario_attempts
  where id = p_attempt_id and user_id = p_user_id for update;
  if not found then
    raise exception 'attempt_not_found' using errcode = 'P0001';
  end if;
  if v_attempt.state = 'COMPLETED' then
    raise exception 'attempt_final' using errcode = 'P0001';
  end if;
  if v_attempt.is_replay then
    raise exception 'replay_not_charged' using errcode = 'P0001';
  end if;
  if p_amount_minor is null or p_amount_minor <= 0 then
    raise exception 'invalid_amount' using errcode = 'P0001';
  end if;

  -- Lock the run so concurrent payments are serialized and balances stay consistent.
  select * into v_run from public.module_runs where id = v_attempt.module_run_id for update;
  if v_run.completed_at is not null then
    raise exception 'module_run_final' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.wallet_ledger_entries where attempt_id = p_attempt_id and entry_type = 'PAYMENT') then
    raise exception 'duplicate_attempt_payment' using errcode = 'P0001';
  end if;

  select coalesce(sum(amount_minor), 0) into v_balance
  from public.wallet_ledger_entries where module_run_id = v_run.id;
  if p_amount_minor > v_balance then
    raise exception 'insufficient_funds' using errcode = 'P0001';
  end if;

  insert into public.wallet_ledger_entries
    (user_id, module_run_id, attempt_id, entry_type, amount_minor, balance_after_minor, currency,
     classification, idempotency_key)
  values
    (p_user_id, v_run.id, p_attempt_id, 'PAYMENT', -p_amount_minor, v_balance - p_amount_minor, v_run.currency,
     'pending', p_idempotency_key)
  returning * into v_entry;
  return v_entry;
end;
$$;

-- Completes an attempt in ONE transaction: final state, deterministic score row, payment classification, and — when
-- both scenarios of the module now have a completed first attempt — the module run's completion and closing balance.
-- Idempotent: completing an already completed attempt returns its current result without changing anything.
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
  v_completed_scenarios integer;
begin
  select * into v_attempt from public.scenario_attempts
  where id = p_attempt_id and user_id = p_user_id for update;
  if not found then
    raise exception 'attempt_not_found' using errcode = 'P0001';
  end if;

  if v_attempt.state <> 'COMPLETED' then
    if v_attempt.state <> 'EVALUATING' then
      raise exception 'attempt_not_evaluating' using errcode = 'P0001';
    end if;

    select exists (
      select 1 from public.wallet_ledger_entries where attempt_id = p_attempt_id and entry_type = 'PAYMENT'
    ) into v_has_payment;
    if v_has_payment and coalesce(p_payment_classification, '') not in ('spending', 'fraud_loss') then
      raise exception 'payment_classification_required' using errcode = 'P0001';
    end if;

    perform set_config('scamsense.completing', 'on', true);
    update public.scenario_attempts
      set state = 'COMPLETED', completed_at = now(), decision_correct = p_decision_correct
      where id = p_attempt_id
      returning * into v_attempt;
    perform set_config('scamsense.completing', 'off', true);

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
-- 7. Row Level Security: users read only their own rows; no user-level write policies at all.
-- ---------------------------------------------------------------------------------------------------------------------
alter table public.module_runs enable row level security;
alter table public.scenario_attempts enable row level security;
alter table public.wallet_ledger_entries enable row level security;
alter table public.scenario_scores enable row level security;

drop policy if exists "module_runs_select_own" on public.module_runs;
create policy "module_runs_select_own" on public.module_runs
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "scenario_attempts_select_own" on public.scenario_attempts;
create policy "scenario_attempts_select_own" on public.scenario_attempts
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "wallet_ledger_select_own" on public.wallet_ledger_entries;
create policy "wallet_ledger_select_own" on public.wallet_ledger_entries
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "scenario_scores_select_own" on public.scenario_scores;
create policy "scenario_scores_select_own" on public.scenario_scores
  for select to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------------------------------------------------
-- 8. Privileges (new tables are not auto-exposed: grant explicitly, minimum required)
-- ---------------------------------------------------------------------------------------------------------------------
revoke all on table public.module_runs, public.scenario_attempts, public.wallet_ledger_entries, public.scenario_scores
  from public, anon, authenticated, service_role;

grant usage on schema public to authenticated, service_role;
grant select on table public.module_runs, public.scenario_attempts, public.wallet_ledger_entries, public.scenario_scores
  to authenticated, service_role;
-- The Phase 4 state machine advances attempts (decision, justification, state) through the trusted server. The
-- update trigger keeps those fields write-once and blocks COMPLETED outside complete_scenario_attempt.
grant update (state, decision_id, decision_committed_at, justification, justification_submitted_at)
  on table public.scenario_attempts to service_role;

revoke all on function public.start_module_run(uuid, text, text, bigint) from public, anon, authenticated;
revoke all on function public.create_scenario_attempt(uuid, text, text) from public, anon, authenticated;
revoke all on function public.record_training_payment(uuid, uuid, bigint, text) from public, anon, authenticated;
revoke all on function public.complete_scenario_attempt(
  uuid, uuid, boolean, smallint, smallint, smallint, smallint, text, text[], text[], text, text
) from public, anon, authenticated;

grant execute on function public.start_module_run(uuid, text, text, bigint) to service_role;
grant execute on function public.create_scenario_attempt(uuid, text, text) to service_role;
grant execute on function public.record_training_payment(uuid, uuid, bigint, text) to service_role;
grant execute on function public.complete_scenario_attempt(
  uuid, uuid, boolean, smallint, smallint, smallint, smallint, text, text[], text[], text, text
) to service_role;

revoke all on function public.module_runs_before_update() from public, anon, authenticated;
revoke all on function public.scenario_attempts_before_update() from public, anon, authenticated;
revoke all on function public.wallet_ledger_before_update() from public, anon, authenticated;
