-- =====================================================================================================================
-- ScamSense — Step 6: immersive scenario engine (state machine, event log, replay-safe transitions)
--
-- Changes
--   1. scenario_attempts: the 13-state Step 6 state machine (src/lib/domain/scenarioStateMachine.ts). Old states are
--      mapped: EXPLORING → ACTIVE, AWAITING_JUSTIFICATION → EXPLANATION_REQUIRED, EVALUATING → FINALIZED.
--      New columns: pending_decision_id (DECISION_SELECTED, not yet locked) and finalized_at.
--   2. The update trigger now ALSO rejects any (from → to) state change that isn't in the machine's transition list,
--      so even the trusted server can't skip the explanation, fake a payment state, or jump to the end.
--   3. scenario_attempt_events: append-only log of every accepted event (investigation actions, decisions,
--      checkout cancellations/retries, …) per attempt — replays have their own log because they have their own id.
--   4. apply_attempt_event(): the single trusted-writer entry point for state changes (row lock, optimistic state
--      check, write-once fields, event row) — executable by service_role only.
--   5. complete_scenario_attempt(): now requires RECOVERY_AVAILABLE (the end of the results pipeline) instead of
--      EVALUATING, and logs a COMPLETE event. Everything else about it is unchanged.
--
-- The state list and transitions mirror the TypeScript machine; scenarioStateMachineMigration.test.ts fails if they
-- drift. Never edit this file once applied — add a new migration.
--
-- Run once: Supabase Dashboard → SQL Editor → paste this whole file → Run. Requires the three earlier migrations.
-- =====================================================================================================================

-- ---------------------------------------------------------------------------------------------------------------------
-- 1. scenario_attempts: new states and columns
-- ---------------------------------------------------------------------------------------------------------------------
alter table public.scenario_attempts drop constraint if exists scenario_attempts_state_check;

alter table public.scenario_attempts add column if not exists pending_decision_id text;
alter table public.scenario_attempts add column if not exists finalized_at timestamptz;

-- The old trigger allows these updates (no COMPLETED rows are touched); the new trigger is installed afterwards.
update public.scenario_attempts
  set state = case state
      when 'EXPLORING' then 'ACTIVE'
      when 'AWAITING_JUSTIFICATION' then 'EXPLANATION_REQUIRED'
      when 'EVALUATING' then 'FINALIZED'
      else state
    end,
    finalized_at = case when state = 'EVALUATING' then coalesce(justification_submitted_at, now()) else finalized_at end
  where state in ('EXPLORING', 'AWAITING_JUSTIFICATION', 'EVALUATING');

alter table public.scenario_attempts add
  constraint scenario_attempts_state_check
    check (state in ('INTRO', 'ACTIVE', 'INVESTIGATING', 'DECISION_SELECTED', 'EXPLANATION_REQUIRED',
                     'PAYMENT_PENDING', 'PAYMENT_COMPLETED', 'PAYMENT_CANCELLED', 'FINALIZED',
                     'FEEDBACK_AVAILABLE', 'REVIEW_AVAILABLE', 'RECOVERY_AVAILABLE', 'COMPLETED'));

alter table public.scenario_attempts add
  constraint scenario_attempts_decision_id_format_check
    check ((decision_id is null or decision_id ~ '^[a-z0-9_]{1,64}$')
       and (pending_decision_id is null or pending_decision_id ~ '^[a-z0-9_]{1,64}$'));

-- Shape of each state (new and updated rows; NOT VALID so rows written by the Phase 3 integration tests are kept).
alter table public.scenario_attempts add
  constraint scenario_attempts_state_shape_check
    check (
      (state = 'DECISION_SELECTED') = (pending_decision_id is not null)
      and (state not in ('INTRO', 'ACTIVE', 'INVESTIGATING', 'DECISION_SELECTED')
           or (decision_id is null and justification is null))
      and (state in ('INTRO', 'ACTIVE', 'INVESTIGATING', 'DECISION_SELECTED') or decision_id is not null)
      and (state in ('INTRO', 'ACTIVE', 'INVESTIGATING', 'DECISION_SELECTED', 'EXPLANATION_REQUIRED')
           or justification is not null)
      and ((finalized_at is not null) = (state in ('FINALIZED', 'FEEDBACK_AVAILABLE', 'REVIEW_AVAILABLE',
                                                    'RECOVERY_AVAILABLE', 'COMPLETED')))
    ) not valid;

-- ---------------------------------------------------------------------------------------------------------------------
-- 2. Legal state transitions (mirror of STATE_TRANSITIONS in scenarioStateMachine.ts)
-- ---------------------------------------------------------------------------------------------------------------------
create or replace function public.scenario_state_transition_allowed(p_from text, p_to text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select (p_from, p_to) in (
    ('INTRO', 'ACTIVE'),
    ('ACTIVE', 'INVESTIGATING'),
    ('ACTIVE', 'DECISION_SELECTED'),
    ('INVESTIGATING', 'DECISION_SELECTED'),
    ('DECISION_SELECTED', 'ACTIVE'),
    ('DECISION_SELECTED', 'INVESTIGATING'),
    ('DECISION_SELECTED', 'EXPLANATION_REQUIRED'),
    ('EXPLANATION_REQUIRED', 'PAYMENT_PENDING'),
    ('EXPLANATION_REQUIRED', 'FINALIZED'),
    ('PAYMENT_PENDING', 'PAYMENT_COMPLETED'),
    ('PAYMENT_PENDING', 'PAYMENT_CANCELLED'),
    ('PAYMENT_CANCELLED', 'PAYMENT_PENDING'),
    ('PAYMENT_CANCELLED', 'FINALIZED'),
    ('PAYMENT_COMPLETED', 'FINALIZED'),
    ('FINALIZED', 'FEEDBACK_AVAILABLE'),
    ('FEEDBACK_AVAILABLE', 'REVIEW_AVAILABLE'),
    ('REVIEW_AVAILABLE', 'RECOVERY_AVAILABLE'),
    ('RECOVERY_AVAILABLE', 'COMPLETED')
  );
$$;

-- Same rules as before (identity immutable, decision/justification write-once, COMPLETED only through
-- complete_scenario_attempt) plus: every state change must be a legal transition.
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
         and new.justification_submitted_at is distinct from old.justification_submitted_at)
     or (old.finalized_at is not null and new.finalized_at is distinct from old.finalized_at) then
    raise exception 'attempt_decision_locked' using errcode = 'P0001';
  end if;
  if new.state is distinct from old.state
     and not public.scenario_state_transition_allowed(old.state, new.state) then
    raise exception 'invalid_state_transition' using errcode = 'P0001';
  end if;
  if new.state = 'COMPLETED' and coalesce(current_setting('scamsense.completing', true), '') <> 'on' then
    raise exception 'attempt_complete_via_function' using errcode = 'P0001';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 3. scenario_attempt_events — append-only event log per attempt
-- ---------------------------------------------------------------------------------------------------------------------
create table if not exists public.scenario_attempt_events (
  id             bigint      generated always as identity primary key,
  user_id        uuid        not null references auth.users (id) on delete cascade,
  attempt_id     uuid        not null,
  module_run_id  uuid        not null,
  event_type     text        not null,
  action_id      text,
  decision_id    text,
  from_state     text        not null,
  to_state       text        not null,
  created_at     timestamptz not null default now(),

  constraint scenario_attempt_events_attempt_fk
    foreign key (attempt_id, user_id, module_run_id)
    references public.scenario_attempts (id, user_id, module_run_id) on delete cascade,
  constraint scenario_attempt_events_type_check
    check (event_type in ('START', 'RECORD_ACTION', 'SELECT_DECISION', 'CLEAR_DECISION', 'CONFIRM_DECISION',
                          'SUBMIT_EXPLANATION', 'PAYMENT_CANCELLED', 'RETRY_PAYMENT', 'FINALIZE',
                          'PAYMENT_CAPTURED', 'PAYMENT_FAILED', 'FEEDBACK_READY', 'REVIEW_READY', 'RECOVERY_READY',
                          'COMPLETE')),
  constraint scenario_attempt_events_ids_check
    check ((action_id is null or action_id ~ '^[a-z0-9_]{1,64}$')
       and (decision_id is null or decision_id ~ '^[a-z0-9_]{1,64}$')),
  constraint scenario_attempt_events_action_shape_check
    check ((event_type = 'RECORD_ACTION') = (action_id is not null))
);

create index if not exists scenario_attempt_events_attempt_idx on public.scenario_attempt_events (attempt_id, id);

create or replace function public.scenario_attempt_events_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'event_log_append_only' using errcode = 'P0001';
end;
$$;

drop trigger if exists scenario_attempt_events_no_update on public.scenario_attempt_events;
create trigger scenario_attempt_events_no_update
  before update on public.scenario_attempt_events
  for each row execute function public.scenario_attempt_events_immutable();

-- ---------------------------------------------------------------------------------------------------------------------
-- 4. apply_attempt_event — the trusted server's only way to change an attempt's state
--
-- The TypeScript state machine decides p_to_state and validates action/decision IDs against the scenario content;
-- this function re-checks ownership, the current state (optimistic concurrency), the legal transition (trigger),
-- write-once fields, and the event cap, then writes the state and the event row in one transaction.
-- ---------------------------------------------------------------------------------------------------------------------
create or replace function public.apply_attempt_event(
  p_user_id uuid,
  p_attempt_id uuid,
  p_from_state text,
  p_to_state text,
  p_event_type text,
  p_action_id text,
  p_decision_id text,
  p_justification text
)
returns public.scenario_attempts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt public.scenario_attempts;
begin
  select * into v_attempt from public.scenario_attempts
  where id = p_attempt_id and user_id = p_user_id for update;
  if not found then
    raise exception 'attempt_not_found' using errcode = 'P0001';
  end if;
  if v_attempt.state <> p_from_state then
    raise exception 'attempt_state_conflict' using errcode = 'P0001';
  end if;
  if p_event_type = 'COMPLETE' or p_to_state = 'COMPLETED' then
    raise exception 'attempt_complete_via_function' using errcode = 'P0001';
  end if;
  if (select count(*) from public.scenario_attempt_events where attempt_id = p_attempt_id) >= 500 then
    raise exception 'attempt_event_limit' using errcode = 'P0001';
  end if;

  if p_event_type = 'RECORD_ACTION' then
    if p_action_id is null then
      raise exception 'action_required' using errcode = 'P0001';
    end if;
    if exists (select 1 from public.scenario_attempt_events
               where attempt_id = p_attempt_id and event_type = 'RECORD_ACTION' and action_id = p_action_id) then
      return v_attempt; -- each action is recorded once; repeats change nothing
    end if;
  elsif p_event_type = 'SELECT_DECISION' then
    if p_decision_id is null then
      raise exception 'decision_required' using errcode = 'P0001';
    end if;
    v_attempt.pending_decision_id := p_decision_id;
  elsif p_event_type = 'CLEAR_DECISION' then
    v_attempt.pending_decision_id := null;
  elsif p_event_type = 'CONFIRM_DECISION' then
    if v_attempt.pending_decision_id is null or v_attempt.pending_decision_id is distinct from p_decision_id then
      raise exception 'decision_mismatch' using errcode = 'P0001';
    end if;
    v_attempt.decision_id := v_attempt.pending_decision_id;
    v_attempt.decision_committed_at := now();
    v_attempt.pending_decision_id := null;
  elsif p_event_type = 'SUBMIT_EXPLANATION' then
    if p_justification is null then
      raise exception 'justification_required' using errcode = 'P0001';
    end if;
    v_attempt.justification := p_justification;
    v_attempt.justification_submitted_at := now();
  end if;

  if p_to_state = 'FINALIZED' then
    v_attempt.finalized_at := now();
  end if;

  update public.scenario_attempts
    set state = p_to_state,
        pending_decision_id = v_attempt.pending_decision_id,
        decision_id = v_attempt.decision_id,
        decision_committed_at = v_attempt.decision_committed_at,
        justification = v_attempt.justification,
        justification_submitted_at = v_attempt.justification_submitted_at,
        finalized_at = v_attempt.finalized_at
    where id = p_attempt_id
    returning * into v_attempt;

  insert into public.scenario_attempt_events
    (user_id, attempt_id, module_run_id, event_type, action_id, decision_id, from_state, to_state)
  values
    (p_user_id, p_attempt_id, v_attempt.module_run_id, p_event_type,
     case when p_event_type = 'RECORD_ACTION' then p_action_id end,
     case when p_event_type in ('SELECT_DECISION', 'CONFIRM_DECISION') then p_decision_id end,
     p_from_state, p_to_state);

  return v_attempt;
end;
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 5. complete_scenario_attempt — now completes from RECOVERY_AVAILABLE (end of the results pipeline)
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
    if v_has_payment and coalesce(p_payment_classification, '') not in ('spending', 'fraud_loss') then
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
-- 6. Row Level Security and privileges
-- ---------------------------------------------------------------------------------------------------------------------
alter table public.scenario_attempt_events enable row level security;

drop policy if exists "scenario_attempt_events_select_own" on public.scenario_attempt_events;
create policy "scenario_attempt_events_select_own" on public.scenario_attempt_events
  for select to authenticated using ((select auth.uid()) = user_id);

revoke all on table public.scenario_attempt_events from public, anon, authenticated, service_role;
grant select on table public.scenario_attempt_events to authenticated, service_role;

-- State changes go through apply_attempt_event only (the direct column grant from Phase 3 is withdrawn).
revoke update on table public.scenario_attempts from service_role;

revoke all on function public.apply_attempt_event(uuid, uuid, text, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.apply_attempt_event(uuid, uuid, text, text, text, text, text, text) to service_role;

revoke all on function public.scenario_state_transition_allowed(text, text) from public, anon, authenticated;
revoke all on function public.scenario_attempt_events_immutable() from public, anon, authenticated;
revoke all on function public.scenario_attempts_before_update() from public, anon, authenticated;

-- complete_scenario_attempt was replaced in place: keep it service_role only.
revoke all on function public.complete_scenario_attempt(
  uuid, uuid, boolean, smallint, smallint, smallint, smallint, text, text[], text[], text, text
) from public, anon, authenticated;
grant execute on function public.complete_scenario_attempt(
  uuid, uuid, boolean, smallint, smallint, smallint, smallint, text, text[], text[], text, text
) to service_role;
