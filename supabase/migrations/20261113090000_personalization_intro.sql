-- =====================================================================================================================
-- ScamSense — Step 8 follow-up (owner decision 13): Gemini-personalized neutral introductions
--
-- Changes (additive; nothing existing is modified or deleted)
--   1. scenario_personalizations.intro_line: the VALIDATED Gemini introduction stored with the narrative instance
--      (null = the authored intro is shown). Refresh, resume, and replays reuse it like the slots.
--   2. complete_scenario_personalization(): gains p_intro_line (last, default null). The previous 10-argument version
--      is dropped so PostgREST calls stay unambiguous; callers that omit p_intro_line keep working.
--
-- Never edit this file once applied — add a new migration.
-- Run once: Supabase Dashboard → SQL Editor → paste this whole file → Run. Requires 20261112090000_hybrid_intelligence.sql.
-- =====================================================================================================================

alter table public.scenario_personalizations add column if not exists intro_line text;

alter table public.scenario_personalizations drop constraint if exists scenario_personalizations_intro_check;
alter table public.scenario_personalizations add
  constraint scenario_personalizations_intro_check
    check (intro_line is null or (char_length(intro_line) between 15 and 120 and source = 'gemini'));

drop function if exists public.complete_scenario_personalization(
  uuid, uuid, text, jsonb, text, text, text, integer, integer, integer);

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
  p_latency_ms integer,
  p_intro_line text default null
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
        intro_line = case when p_source = 'gemini' then p_intro_line end,
        fallback_reason = p_fallback_reason, model = p_model, prompt_version = p_prompt_version,
        input_tokens = p_input_tokens, output_tokens = p_output_tokens, latency_ms = p_latency_ms,
        updated_at = now()
    where id = p_personalization_id
    returning * into v_row;
  return v_row;
end;
$$;

revoke all on function public.complete_scenario_personalization(
  uuid, uuid, text, jsonb, text, text, text, integer, integer, integer, text) from public, anon, authenticated;
grant execute on function public.complete_scenario_personalization(
  uuid, uuid, text, jsonb, text, text, text, integer, integer, integer, text) to service_role;
