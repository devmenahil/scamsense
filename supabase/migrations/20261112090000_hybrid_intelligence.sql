-- =====================================================================================================================
-- ScamSense — Step 8: hybrid scenario routing, Gemini personalization, and Gemini reasoning evaluation
--
-- Changes (additive; no existing row, attempt, score, payment, or ledger entry is modified)
--   1. profiles: "Other" financial activity; custom_occupation / custom_activity descriptions (custom_goal exists).
--      A description is only stored while its "Other" option is selected. "Required when Other" is enforced by the
--      API (Zod) so legacy profiles that chose "Other" before Step 8 are not locked out of their account.
--   2. profile_interpretations: cache of VALIDATED Gemini interpretations of custom text, keyed by a SHA-256
--      fingerprint of the normalized text (+ classifier version). Raw text is never stored here.
--   3. module_scenario_orders: the persisted routed order of a module's two scenarios, written once per
--      (user, module). Never updated, so a profile edit can't reorder a started module.
--   4. scenario_personalizations + attempt_personalizations: validated narrative slot values per (user, scenario),
--      generated once and linked to every attempt that shows them (replays reuse them; a refresh never regenerates).
--      Attempts created before Step 8 have no link and keep the authored defaults they were shown.
--   5. attempt_evaluations: one evaluation per attempt (original and every replay separately), with a claim/lock so
--      duplicate requests can't evaluate twice, and record_attempt_evaluation() which — in ONE transaction — stores
--      the evaluation, moves FINALIZED → FEEDBACK_AVAILABLE → REVIEW_AVAILABLE → RECOVERY_AVAILABLE and calls
--      complete_scenario_attempt (deterministic score, payment classification, module completion).
--
-- Trust model unchanged: users may only SELECT their own rows; every write goes through service_role (the server's
-- trusted writer) with the user id from the verified session.
--
-- Never edit this file once applied — add a new migration.
-- Run once: Supabase Dashboard → SQL Editor → paste this whole file → Run. Requires the five earlier migrations.
-- =====================================================================================================================

-- ---------------------------------------------------------------------------------------------------------------------
-- 1. profiles: "Other" activity + custom descriptions
-- ---------------------------------------------------------------------------------------------------------------------
alter table public.profiles add column if not exists custom_occupation text;
alter table public.profiles add column if not exists custom_activity text;

alter table public.profiles drop constraint if exists profiles_financial_activities_check;
alter table public.profiles add
  constraint profiles_financial_activities_check
    check (
      cardinality(financial_activities) <= 11
      and financial_activities <@ array['online_shopping', 'online_selling', 'freelance_payments', 'sending_invoices', 'receiving_invoices', 'job_applications', 'business_purchases', 'subscription_payments', 'investments', 'digital_wallet_usage', 'other']::text[]
    );

alter table public.profiles drop constraint if exists profiles_custom_occupation_check;
alter table public.profiles add
  constraint profiles_custom_occupation_check
    check (custom_occupation is null
           or (occupation = 'other' and char_length(custom_occupation) between 1 and 80));

alter table public.profiles drop constraint if exists profiles_custom_activity_check;
alter table public.profiles add
  constraint profiles_custom_activity_check
    check (custom_activity is null
           or ('other' = any (financial_activities) and char_length(custom_activity) between 1 and 160));

-- Same row-maintenance rules as before, plus: custom descriptions are trimmed, blank → null, and cleared when their
-- "Other" option is no longer selected.
create or replace function public.profiles_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.display_name := btrim(new.display_name);
  new.custom_goal := nullif(btrim(new.custom_goal), '');
  new.custom_occupation := nullif(btrim(new.custom_occupation), '');
  new.custom_activity := nullif(btrim(new.custom_activity), '');
  new.financial_activities := coalesce(
    array(select distinct a from unnest(new.financial_activities) as a where a is not null order by a),
    '{}'
  );
  if new.occupation is distinct from 'other' then
    new.custom_occupation := null;
  end if;
  if not ('other' = any (new.financial_activities)) then
    new.custom_activity := null;
  end if;
  new.income_bracket_label := case new.income_bracket
      when 'prefer_not_to_say' then 'Prefer not to say'
      when 'under_1000' then 'Under US$1,000 a month'
      when '1000_2499' then 'US$1,000–2,499 a month'
      when '2500_4999' then 'US$2,500–4,999 a month'
      when '5000_9999' then 'US$5,000–9,999 a month'
      when '10000_plus' then 'US$10,000 or more a month'
      else null
    end;

  if tg_op = 'UPDATE' then
    new.user_id := old.user_id;
    new.age_confirmed := old.age_confirmed;
    new.age_confirmed_at := old.age_confirmed_at;
    new.created_at := old.created_at;
    if old.onboarding_completed then
      new.onboarding_completed := true;
      new.onboarding_completed_at := old.onboarding_completed_at;
    end if;
  end if;

  if new.onboarding_completed and new.onboarding_completed_at is null then
    new.onboarding_completed_at := now();
  end if;
  new.updated_at := now();
  return new;
end;
$$;

grant update (custom_occupation, custom_activity) on table public.profiles to authenticated;

-- ---------------------------------------------------------------------------------------------------------------------
-- 2. profile_interpretations — validated interpretation cache (no raw text)
-- ---------------------------------------------------------------------------------------------------------------------
create table if not exists public.profile_interpretations (
  id                  uuid        primary key default gen_random_uuid(),
  user_id             uuid        not null references auth.users (id) on delete cascade,
  fingerprint         text        not null,
  classifier_version  text        not null,
  status              text        not null,
  source              text        not null,
  activity_tags       text[]      not null default '{}',
  context_tags        text[]      not null default '{}',
  context_summary     text,
  model               text,
  input_tokens        integer,
  output_tokens       integer,
  created_at          timestamptz not null default now(),

  constraint profile_interpretations_user_fingerprint_key unique (user_id, fingerprint),
  constraint profile_interpretations_fingerprint_check check (fingerprint ~ '^[0-9a-f]{64}$'),
  constraint profile_interpretations_status_check check (status in ('mapped', 'partial', 'unmapped')),
  constraint profile_interpretations_source_check check (source = 'gemini'),
  constraint profile_interpretations_tags_check
    check (cardinality(activity_tags) <= 6 and cardinality(context_tags) <= 3
       and activity_tags <@ array['online_shopping', 'online_selling', 'freelancing', 'sending_invoices', 'receiving_invoices', 'paying_invoices', 'job_seeking', 'subscriptions', 'business_purchasing', 'digital_wallet_usage', 'account_security', 'investments']::text[]
       and context_tags <@ array['student', 'employed_professional', 'freelancer', 'business_owner', 'self_employed', 'job_seeker', 'retired', 'general_consumer']::text[]),
  constraint profile_interpretations_summary_check
    check (context_summary is null or char_length(context_summary) between 1 and 120)
);

-- ---------------------------------------------------------------------------------------------------------------------
-- 3. module_scenario_orders — routed order, written once per (user, module)
-- ---------------------------------------------------------------------------------------------------------------------
create table if not exists public.module_scenario_orders (
  user_id                    uuid        not null references auth.users (id) on delete cascade,
  module_key                 text        not null,
  scenario_order             text[]      not null,
  scores                     jsonb       not null,
  routing_source             text        not null,
  interpretation_fingerprint text,
  routing_version            text        not null,
  created_at                 timestamptz not null default now(),

  primary key (user_id, module_key),
  constraint module_scenario_orders_module_check
    check (module_key in ('spot-the-trap', 'trust-under-pressure', 'outsmart-the-scam')),
  -- Exactly the module's own two scenarios, each once.
  constraint module_scenario_orders_order_check
    check (
      (module_key = 'spot-the-trap' and scenario_order in (array['m1-s1', 'm1-s2'], array['m1-s2', 'm1-s1']))
      or (module_key = 'trust-under-pressure' and scenario_order in (array['m2-s1', 'm2-s2'], array['m2-s2', 'm2-s1']))
      or (module_key = 'outsmart-the-scam' and scenario_order in (array['m3-s1', 'm3-s2'], array['m3-s2', 'm3-s1']))
    ),
  constraint module_scenario_orders_source_check
    check (routing_source in ('predefined', 'custom_exact', 'custom_gemini', 'custom_neutral', 'custom_fallback',
                              'legacy_initialization'))
);

create or replace function public.module_scenario_orders_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'scenario_order_immutable' using errcode = 'P0001';
end;
$$;

drop trigger if exists module_scenario_orders_no_update on public.module_scenario_orders;
create trigger module_scenario_orders_no_update
  before update on public.module_scenario_orders
  for each row execute function public.module_scenario_orders_immutable();

-- ---------------------------------------------------------------------------------------------------------------------
-- 4. Personalized scenario instances
-- ---------------------------------------------------------------------------------------------------------------------
create table if not exists public.scenario_personalizations (
  id               uuid        primary key default gen_random_uuid(),
  user_id          uuid        not null references auth.users (id) on delete cascade,
  scenario_key     text        not null,
  content_version  text        not null,
  status           text        not null default 'pending',
  -- 'gemini' = validated Gemini slots; 'fallback' = authored defaults (Gemini unavailable or output rejected)
  source           text,
  slots            jsonb       not null default '{}',
  fallback_reason  text,
  model            text,
  prompt_version   text,
  input_tokens     integer,
  output_tokens    integer,
  latency_ms       integer,
  claimed_at       timestamptz not null default now(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint scenario_personalizations_id_user_key unique (id, user_id),
  constraint scenario_personalizations_scenario_check
    check (scenario_key in ('m1-s1', 'm1-s2', 'm2-s1', 'm2-s2', 'm3-s1', 'm3-s2')),
  constraint scenario_personalizations_status_check check (status in ('pending', 'ready')),
  constraint scenario_personalizations_source_check
    check ((status = 'pending' and source is null) or (status = 'ready' and source in ('gemini', 'fallback'))),
  constraint scenario_personalizations_slots_check
    check (jsonb_typeof(slots) = 'object' and pg_column_size(slots) <= 8000)
);

-- One generation in flight per (user, scenario); at most one Gemini instance per content version.
create unique index if not exists scenario_personalizations_one_pending_idx
  on public.scenario_personalizations (user_id, scenario_key) where status = 'pending';
create unique index if not exists scenario_personalizations_one_gemini_idx
  on public.scenario_personalizations (user_id, scenario_key, content_version)
  where status = 'ready' and source = 'gemini';

create table if not exists public.attempt_personalizations (
  attempt_id          uuid        primary key,
  user_id             uuid        not null,
  module_run_id       uuid        not null,
  personalization_id  uuid        not null,
  created_at          timestamptz not null default now(),

  constraint attempt_personalizations_attempt_fk
    foreign key (attempt_id, user_id, module_run_id)
    references public.scenario_attempts (id, user_id, module_run_id) on delete cascade,
  constraint attempt_personalizations_personalization_fk
    foreign key (personalization_id, user_id)
    references public.scenario_personalizations (id, user_id) on delete cascade
);

-- Claims the generation of a personalization (or returns the reusable one). Serialized per (user, scenario).
create or replace function public.claim_scenario_personalization(
  p_user_id uuid,
  p_scenario_key text,
  p_content_version text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.scenario_personalizations;
begin
  perform pg_advisory_xact_lock(hashtext('personalization:' || p_user_id::text || ':' || p_scenario_key));

  select * into v_row from public.scenario_personalizations
  where user_id = p_user_id and scenario_key = p_scenario_key and content_version = p_content_version
    and status = 'ready' and source = 'gemini';
  if found then
    return jsonb_build_object('status', 'ready', 'id', v_row.id);
  end if;

  select * into v_row from public.scenario_personalizations
  where user_id = p_user_id and scenario_key = p_scenario_key and status = 'pending';
  if found then
    if v_row.claimed_at > now() - interval '45 seconds' then
      return jsonb_build_object('status', 'busy', 'id', v_row.id);
    end if;
    -- A generation that never finished (crash, lost connection): take it over.
    update public.scenario_personalizations
      set claimed_at = now(), content_version = p_content_version, updated_at = now()
      where id = v_row.id
      returning * into v_row;
    return jsonb_build_object('status', 'claimed', 'id', v_row.id);
  end if;

  insert into public.scenario_personalizations (user_id, scenario_key, content_version)
  values (p_user_id, p_scenario_key, p_content_version)
  returning * into v_row;
  return jsonb_build_object('status', 'claimed', 'id', v_row.id);
end;
$$;

create or replace function public.complete_scenario_personalization(
  p_user_id uuid,
  p_personalization_id uuid,
  p_source text,
  p_slots jsonb,
  p_fallback_reason text,
  p_model text,
  p_prompt_version text,
  p_input_tokens integer,
  p_output_tokens integer,
  p_latency_ms integer
)
returns public.scenario_personalizations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.scenario_personalizations;
begin
  select * into v_row from public.scenario_personalizations
  where id = p_personalization_id and user_id = p_user_id for update;
  if not found then
    raise exception 'personalization_not_found' using errcode = 'P0001';
  end if;
  if v_row.status = 'ready' then
    return v_row; -- idempotent
  end if;
  update public.scenario_personalizations
    set status = 'ready', source = p_source, slots = coalesce(p_slots, '{}'),
        fallback_reason = p_fallback_reason, model = p_model, prompt_version = p_prompt_version,
        input_tokens = p_input_tokens, output_tokens = p_output_tokens, latency_ms = p_latency_ms,
        updated_at = now()
    where id = p_personalization_id
    returning * into v_row;
  return v_row;
end;
$$;

-- Links an attempt to the personalization it shows. Only before the player has seen the environment (INTRO/ACTIVE
-- without recorded actions): the narrative of an attempt never changes once it is visible. Idempotent.
create or replace function public.link_attempt_personalization(
  p_user_id uuid,
  p_attempt_id uuid,
  p_personalization_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt public.scenario_attempts;
  v_existing uuid;
  v_row public.scenario_personalizations;
begin
  select * into v_attempt from public.scenario_attempts
  where id = p_attempt_id and user_id = p_user_id for update;
  if not found then
    raise exception 'attempt_not_found' using errcode = 'P0001';
  end if;
  select personalization_id into v_existing from public.attempt_personalizations where attempt_id = p_attempt_id;
  if found then
    return v_existing;
  end if;
  if v_attempt.state <> 'INTRO' then
    raise exception 'personalization_too_late' using errcode = 'P0001';
  end if;
  select * into v_row from public.scenario_personalizations
  where id = p_personalization_id and user_id = p_user_id;
  if not found or v_row.status <> 'ready' or v_row.scenario_key <> v_attempt.scenario_key then
    raise exception 'personalization_mismatch' using errcode = 'P0001';
  end if;
  insert into public.attempt_personalizations (attempt_id, user_id, module_run_id, personalization_id)
  values (p_attempt_id, p_user_id, v_attempt.module_run_id, p_personalization_id);
  return p_personalization_id;
end;
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 5. attempt_evaluations — Gemini reasoning evaluation (one per attempt; replays separately)
-- ---------------------------------------------------------------------------------------------------------------------
create table if not exists public.attempt_evaluations (
  attempt_id                 uuid        primary key,
  user_id                    uuid        not null,
  module_run_id              uuid        not null,
  scenario_key               text        not null,
  is_practice                boolean     not null,
  status                     text        not null default 'pending',
  source                     text,
  model                      text,
  prompt_version             text,
  decision_correct           boolean,
  decision_assessment        text,
  recognized_evidence_ids    text[]      not null default '{}',
  missed_evidence_ids        text[]      not null default '{}',
  unsupported_assumptions    text[]      not null default '{}',
  reasoning_explanation      text,
  verification_feedback      text,
  payment_behavior_feedback  text,
  improvement_advice         text,
  educational_takeaway       text,
  humorous_comment           text,
  evaluation_confidence      text,
  failure_count              integer     not null default 0,
  last_failure_reason        text,
  input_tokens               integer,
  output_tokens              integer,
  latency_ms                 integer,
  claimed_at                 timestamptz not null default now(),
  completed_at               timestamptz,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now(),

  constraint attempt_evaluations_attempt_fk
    foreign key (attempt_id, user_id, module_run_id)
    references public.scenario_attempts (id, user_id, module_run_id) on delete cascade,
  constraint attempt_evaluations_status_check check (status in ('pending', 'failed', 'complete')),
  constraint attempt_evaluations_source_check
    check ((status = 'complete') = (source is not null) and (source is null or source in ('gemini', 'fallback'))),
  constraint attempt_evaluations_assessment_check
    check (decision_assessment is null or decision_assessment in (
      'correct_strong_reasoning', 'correct_weak_reasoning', 'correct_unrelated_reasoning',
      'incorrect_thoughtful_investigation', 'incorrect_unsupported_reasoning')),
  constraint attempt_evaluations_confidence_check
    check (evaluation_confidence is null or evaluation_confidence in ('low', 'medium', 'high')),
  constraint attempt_evaluations_complete_shape_check
    check (status <> 'complete' or (completed_at is not null and reasoning_explanation is not null
                                    and educational_takeaway is not null and humorous_comment is not null
                                    and decision_correct is not null)),
  constraint attempt_evaluations_text_check
    check (coalesce(char_length(reasoning_explanation), 0) <= 1200
       and coalesce(char_length(verification_feedback), 0) <= 600
       and coalesce(char_length(payment_behavior_feedback), 0) <= 600
       and coalesce(char_length(improvement_advice), 0) <= 600
       and coalesce(char_length(educational_takeaway), 0) <= 300
       and coalesce(char_length(humorous_comment), 0) <= 220
       and cardinality(unsupported_assumptions) <= 3)
);

-- Claims the evaluation of a finalized attempt: 'claimed' (go ahead), 'busy' (another request is evaluating), or
-- 'complete' (already evaluated: read the stored result). A failed or stale claim can be taken again (retry).
create or replace function public.claim_attempt_evaluation(p_user_id uuid, p_attempt_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt public.scenario_attempts;
  v_eval public.attempt_evaluations;
begin
  select * into v_attempt from public.scenario_attempts
  where id = p_attempt_id and user_id = p_user_id for update;
  if not found then
    raise exception 'attempt_not_found' using errcode = 'P0001';
  end if;
  select * into v_eval from public.attempt_evaluations where attempt_id = p_attempt_id for update;
  if found and v_eval.status = 'complete' then
    return 'complete';
  end if;
  if v_attempt.state not in ('FINALIZED', 'FEEDBACK_AVAILABLE', 'REVIEW_AVAILABLE', 'RECOVERY_AVAILABLE') then
    raise exception 'attempt_not_finalized' using errcode = 'P0001';
  end if;
  if found then
    if v_eval.status = 'pending' and v_eval.claimed_at > now() - interval '60 seconds' then
      return 'busy';
    end if;
    update public.attempt_evaluations
      set status = 'pending', claimed_at = now(), updated_at = now()
      where attempt_id = p_attempt_id;
    return 'claimed';
  end if;
  insert into public.attempt_evaluations (attempt_id, user_id, module_run_id, scenario_key, is_practice)
  values (p_attempt_id, p_user_id, v_attempt.module_run_id, v_attempt.scenario_key, v_attempt.is_replay);
  return 'claimed';
end;
$$;

create or replace function public.fail_attempt_evaluation(p_user_id uuid, p_attempt_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.attempt_evaluations
    set status = 'failed', failure_count = failure_count + 1, last_failure_reason = left(p_reason, 40),
        updated_at = now()
    where attempt_id = p_attempt_id and user_id = p_user_id and status = 'pending';
end;
$$;

-- Stores the evaluation and completes the attempt in ONE transaction. Points come from the server's deterministic
-- scorer (src/lib/domain/scoring.ts), never from Gemini; complete_scenario_attempt re-checks ranges and writes the
-- immutable score, classifies the payment, and completes the module when both first attempts are done.
create or replace function public.record_attempt_evaluation(
  p_user_id uuid,
  p_attempt_id uuid,
  p_source text,
  p_model text,
  p_prompt_version text,
  p_decision_correct boolean,
  p_decision_assessment text,
  p_recognized_evidence_ids text[],
  p_missed_evidence_ids text[],
  p_unsupported_assumptions text[],
  p_reasoning_explanation text,
  p_verification_feedback text,
  p_payment_behavior_feedback text,
  p_improvement_advice text,
  p_educational_takeaway text,
  p_humorous_comment text,
  p_evaluation_confidence text,
  p_input_tokens integer,
  p_output_tokens integer,
  p_latency_ms integer,
  p_decision_points smallint,
  p_reasoning_points smallint,
  p_verification_points smallint,
  p_payment_safety_points smallint,
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
  v_eval public.attempt_evaluations;
  v_result jsonb;
begin
  select * into v_attempt from public.scenario_attempts
  where id = p_attempt_id and user_id = p_user_id for update;
  if not found then
    raise exception 'attempt_not_found' using errcode = 'P0001';
  end if;
  select * into v_eval from public.attempt_evaluations where attempt_id = p_attempt_id for update;
  if not found then
    raise exception 'evaluation_not_claimed' using errcode = 'P0001';
  end if;
  if v_eval.status = 'complete' then
    return jsonb_build_object('attempt_id', p_attempt_id, 'already_complete', true);
  end if;

  update public.attempt_evaluations
    set status = 'complete', source = p_source, model = p_model, prompt_version = p_prompt_version,
        decision_correct = p_decision_correct, decision_assessment = p_decision_assessment,
        recognized_evidence_ids = coalesce(p_recognized_evidence_ids, '{}'),
        missed_evidence_ids = coalesce(p_missed_evidence_ids, '{}'),
        unsupported_assumptions = coalesce(p_unsupported_assumptions, '{}'),
        reasoning_explanation = p_reasoning_explanation, verification_feedback = p_verification_feedback,
        payment_behavior_feedback = p_payment_behavior_feedback, improvement_advice = p_improvement_advice,
        educational_takeaway = p_educational_takeaway, humorous_comment = p_humorous_comment,
        evaluation_confidence = p_evaluation_confidence, input_tokens = p_input_tokens,
        output_tokens = p_output_tokens, latency_ms = p_latency_ms, completed_at = now(), updated_at = now()
    where attempt_id = p_attempt_id;

  -- FINALIZED → FEEDBACK_AVAILABLE → REVIEW_AVAILABLE → RECOVERY_AVAILABLE (each a logged, legal transition).
  -- The review (evidence) and recovery (Playbook section ids) content is authored and static, so both are
  -- available as soon as feedback is; Step 9 builds their screens.
  if v_attempt.state = 'FINALIZED' then
    perform public.apply_attempt_event(p_user_id, p_attempt_id, 'FINALIZED', 'FEEDBACK_AVAILABLE', 'FEEDBACK_READY',
                                       null, null, null);
    v_attempt.state := 'FEEDBACK_AVAILABLE';
  end if;
  if v_attempt.state = 'FEEDBACK_AVAILABLE' then
    perform public.apply_attempt_event(p_user_id, p_attempt_id, 'FEEDBACK_AVAILABLE', 'REVIEW_AVAILABLE',
                                       'REVIEW_READY', null, null, null);
    v_attempt.state := 'REVIEW_AVAILABLE';
  end if;
  if v_attempt.state = 'REVIEW_AVAILABLE' then
    perform public.apply_attempt_event(p_user_id, p_attempt_id, 'REVIEW_AVAILABLE', 'RECOVERY_AVAILABLE',
                                       'RECOVERY_READY', null, null, null);
  end if;

  v_result := public.complete_scenario_attempt(
    p_user_id, p_attempt_id, p_decision_correct, p_decision_points, p_reasoning_points, p_verification_points,
    p_payment_safety_points, p_source, p_recognized_evidence_ids, p_verification_action_ids, p_scoring_version,
    p_payment_classification);
  return v_result || jsonb_build_object('already_complete', false);
end;
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 6. Row Level Security and privileges
-- ---------------------------------------------------------------------------------------------------------------------
alter table public.profile_interpretations enable row level security;
alter table public.module_scenario_orders enable row level security;
alter table public.scenario_personalizations enable row level security;
alter table public.attempt_personalizations enable row level security;
alter table public.attempt_evaluations enable row level security;

drop policy if exists "profile_interpretations_select_own" on public.profile_interpretations;
create policy "profile_interpretations_select_own" on public.profile_interpretations
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "module_scenario_orders_select_own" on public.module_scenario_orders;
create policy "module_scenario_orders_select_own" on public.module_scenario_orders
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "scenario_personalizations_select_own" on public.scenario_personalizations;
create policy "scenario_personalizations_select_own" on public.scenario_personalizations
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "attempt_personalizations_select_own" on public.attempt_personalizations;
create policy "attempt_personalizations_select_own" on public.attempt_personalizations
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "attempt_evaluations_select_own" on public.attempt_evaluations;
create policy "attempt_evaluations_select_own" on public.attempt_evaluations
  for select to authenticated using ((select auth.uid()) = user_id);

revoke all on table public.profile_interpretations from public, anon, authenticated, service_role;
revoke all on table public.module_scenario_orders from public, anon, authenticated, service_role;
revoke all on table public.scenario_personalizations from public, anon, authenticated, service_role;
revoke all on table public.attempt_personalizations from public, anon, authenticated, service_role;
revoke all on table public.attempt_evaluations from public, anon, authenticated, service_role;

grant select on table public.profile_interpretations to authenticated, service_role;
grant select on table public.module_scenario_orders to authenticated, service_role;
grant select on table public.scenario_personalizations to authenticated, service_role;
grant select on table public.attempt_personalizations to authenticated, service_role;
grant select on table public.attempt_evaluations to authenticated, service_role;
-- Insert-once caches written by the trusted server (no update/delete for anyone).
grant insert on table public.profile_interpretations to service_role;
grant insert on table public.module_scenario_orders to service_role;

revoke all on function public.module_scenario_orders_immutable() from public, anon, authenticated;
revoke all on function public.profiles_before_write() from public, anon, authenticated;

revoke all on function public.claim_scenario_personalization(uuid, text, text) from public, anon, authenticated;
revoke all on function public.complete_scenario_personalization(
  uuid, uuid, text, jsonb, text, text, text, integer, integer, integer) from public, anon, authenticated;
revoke all on function public.link_attempt_personalization(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.claim_attempt_evaluation(uuid, uuid) from public, anon, authenticated;
revoke all on function public.fail_attempt_evaluation(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.record_attempt_evaluation(
  uuid, uuid, text, text, text, boolean, text, text[], text[], text[], text, text, text, text, text, text, text,
  integer, integer, integer, smallint, smallint, smallint, smallint, text[], text, text) from public, anon, authenticated;

grant execute on function public.claim_scenario_personalization(uuid, text, text) to service_role;
grant execute on function public.complete_scenario_personalization(
  uuid, uuid, text, jsonb, text, text, text, integer, integer, integer) to service_role;
grant execute on function public.link_attempt_personalization(uuid, uuid, uuid) to service_role;
grant execute on function public.claim_attempt_evaluation(uuid, uuid) to service_role;
grant execute on function public.fail_attempt_evaluation(uuid, uuid, text) to service_role;
grant execute on function public.record_attempt_evaluation(
  uuid, uuid, text, text, text, boolean, text, text[], text[], text[], text, text, text, text, text, text, text,
  integer, integer, integer, smallint, smallint, smallint, smallint, text[], text, text) to service_role;
