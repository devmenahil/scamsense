-- ScamSense Step 9 — Your Recovery Playbook: one stored personalization per COMPLETED attempt.
--
-- The Playbook itself (policy facts, links, verification dates, steps, limitations) is versioned content in code
-- (src/content/playbook). This table only stores the short Gemini-written note and the step IDs it chose to emphasize,
-- so revisiting or refreshing the Playbook never calls Gemini again. Originals and replays have their own rows.
--
--   • attempt_recovery_playbooks: RLS read-own; no browser writes.
--   • claim_recovery_playbook(user, attempt) → 'ready' | 'busy' | 'claimed' (completed attempts only; a pending claim
--     older than 45 s can be taken over).
--   • complete_recovery_playbook(...): pending → ready, once (idempotent; a ready row never changes).
-- Writes happen only through these service_role functions (src/lib/supabase/admin.ts).

create table if not exists public.attempt_recovery_playbooks (
  attempt_id          uuid        primary key,
  user_id             uuid        not null,
  module_run_id       uuid        not null,
  scenario_key        text        not null,
  is_practice         boolean     not null,
  status              text        not null default 'pending',
  source              text        null,
  policy_ids          text[]      not null default '{}',
  note                text        null,
  emphasis_step_ids   text[]      not null default '{}',
  kb_version          text        null,
  prompt_version      text        null,
  model               text        null,
  fallback_reason     text        null,
  input_tokens        integer     null,
  output_tokens       integer     null,
  latency_ms          integer     null,
  claimed_at          timestamptz not null default now(),
  completed_at        timestamptz null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint attempt_recovery_playbooks_attempt_fk
    foreign key (attempt_id, user_id, module_run_id)
    references public.scenario_attempts (id, user_id, module_run_id) on delete cascade,
  constraint attempt_recovery_playbooks_status_check check (status in ('pending', 'ready')),
  constraint attempt_recovery_playbooks_source_check
    check ((status = 'ready') = (source is not null) and (source is null or source in ('gemini', 'fallback'))),
  constraint attempt_recovery_playbooks_note_check
    check ((source = 'gemini') = (note is not null) and coalesce(char_length(note), 0) <= 420),
  constraint attempt_recovery_playbooks_emphasis_check check (cardinality(emphasis_step_ids) <= 3),
  constraint attempt_recovery_playbooks_ready_check check (status <> 'ready' or completed_at is not null)
);

create index if not exists attempt_recovery_playbooks_user_idx on public.attempt_recovery_playbooks (user_id);

-- A ready row is final.
create or replace function public.attempt_recovery_playbooks_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.status = 'ready' then
    raise exception 'recovery_playbook_final' using errcode = 'P0001';
  end if;
  if new.attempt_id <> old.attempt_id or new.user_id <> old.user_id then
    raise exception 'recovery_playbook_identity' using errcode = 'P0001';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists attempt_recovery_playbooks_guard on public.attempt_recovery_playbooks;
create trigger attempt_recovery_playbooks_guard
  before update on public.attempt_recovery_playbooks
  for each row execute function public.attempt_recovery_playbooks_guard();

create or replace function public.claim_recovery_playbook(p_user_id uuid, p_attempt_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_attempt public.scenario_attempts;
  v_row public.attempt_recovery_playbooks;
begin
  select * into v_attempt from public.scenario_attempts
  where id = p_attempt_id and user_id = p_user_id for update;
  if not found then
    raise exception 'attempt_not_found' using errcode = 'P0001';
  end if;
  if v_attempt.state <> 'COMPLETED' then
    raise exception 'attempt_not_completed' using errcode = 'P0001';
  end if;

  select * into v_row from public.attempt_recovery_playbooks where attempt_id = p_attempt_id for update;
  if found then
    if v_row.status = 'ready' then
      return 'ready';
    end if;
    if v_row.claimed_at > now() - interval '45 seconds' then
      return 'busy';
    end if;
    update public.attempt_recovery_playbooks set claimed_at = now() where attempt_id = p_attempt_id;
    return 'claimed';
  end if;

  insert into public.attempt_recovery_playbooks (attempt_id, user_id, module_run_id, scenario_key, is_practice)
  values (p_attempt_id, p_user_id, v_attempt.module_run_id, v_attempt.scenario_key, v_attempt.is_replay);
  return 'claimed';
end;
$$;

create or replace function public.complete_recovery_playbook(
  p_user_id uuid,
  p_attempt_id uuid,
  p_source text,
  p_policy_ids text[],
  p_note text,
  p_emphasis_step_ids text[],
  p_kb_version text,
  p_prompt_version text,
  p_model text,
  p_fallback_reason text,
  p_input_tokens integer,
  p_output_tokens integer,
  p_latency_ms integer
)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_row public.attempt_recovery_playbooks;
begin
  select * into v_row from public.attempt_recovery_playbooks
  where attempt_id = p_attempt_id and user_id = p_user_id for update;
  if not found then
    raise exception 'recovery_playbook_not_claimed' using errcode = 'P0001';
  end if;
  if v_row.status = 'ready' then
    return 'ready';
  end if;
  update public.attempt_recovery_playbooks set
    status = 'ready',
    source = p_source,
    policy_ids = coalesce(p_policy_ids, '{}'),
    note = case when p_source = 'gemini' then p_note else null end,
    emphasis_step_ids = case when p_source = 'gemini' then coalesce(p_emphasis_step_ids, '{}') else '{}' end,
    kb_version = p_kb_version,
    prompt_version = p_prompt_version,
    model = p_model,
    fallback_reason = left(p_fallback_reason, 40),
    input_tokens = p_input_tokens,
    output_tokens = p_output_tokens,
    latency_ms = p_latency_ms,
    completed_at = now()
  where attempt_id = p_attempt_id;
  return 'ready';
end;
$$;

alter table public.attempt_recovery_playbooks enable row level security;

drop policy if exists "attempt_recovery_playbooks_select_own" on public.attempt_recovery_playbooks;
create policy "attempt_recovery_playbooks_select_own" on public.attempt_recovery_playbooks
  for select to authenticated using ((select auth.uid()) = user_id);

revoke all on table public.attempt_recovery_playbooks from anon, authenticated;
grant select on table public.attempt_recovery_playbooks to authenticated, service_role;

revoke all on function public.claim_recovery_playbook(uuid, uuid) from public, anon, authenticated;
revoke all on function public.complete_recovery_playbook(
  uuid, uuid, text, text[], text, text[], text, text, text, text, integer, integer, integer
) from public, anon, authenticated;
grant execute on function public.claim_recovery_playbook(uuid, uuid) to service_role;
grant execute on function public.complete_recovery_playbook(
  uuid, uuid, text, text[], text, text[], text, text, text, text, integer, integer, integer
) to service_role;
