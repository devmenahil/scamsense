-- ScamSense Step 11 — Module rewards: badges, certificates, certificate email requests, private certificate PDFs.
--
-- How rewards are created (idempotent by construction):
--   • complete_scenario_attempt (unchanged) sets module_runs.completed_at exactly once, when both ORIGINAL attempts of
--     the module are COMPLETED. The module_runs_before_update trigger already makes that write-once.
--   • NEW: an AFTER UPDATE trigger on module_runs fires on that single null → not-null transition and calls
--     award_module_rewards(run), which inserts ONE badge and ONE certificate (unique per run and per user+module,
--     `on conflict do nothing`). Replays never complete a run, so they can never award anything.
--   • The module score is frozen on the badge row: the sum of the two original attempts' immutable scenario_scores.
--   • Runs completed before this migration are backfilled at the end of this file.
--   • ensure_module_rewards(user, module_key) (service_role) is a safe repair path; it is a no-op once awarded.
--
-- Certificate email (optional, via the existing Zapier Catch Hook → Gmail Zap):
--   • certificate_email_requests: one row per intentional send. PROCESSING → SUBMITTED (Zapier accepted the webhook) or
--     FAILED. "SUBMITTED" is NOT proof that Gmail delivered the message; no delivery confirmation exists.
--   • begin_certificate_email_request(...) deduplicates network retries (idempotency key), concurrent clicks
--     (in-flight request), accidental double sends (same address within 30 s), and rate-limits (5 per certificate per
--     hour, 15 per user per hour).
--   • The PDF is uploaded by the server to the PRIVATE storage bucket `certificate-pdfs` and shared with Zapier only as
--     a short-lived signed URL. There are no storage policies for browser roles: only the service role can read it.
--
-- Writes happen only through service_role functions (src/lib/supabase/admin.ts). Browser roles can SELECT own rows.
-- Run once: Supabase Dashboard → SQL Editor → paste this whole file → Run. Requires all earlier migrations.

-- ---------------------------------------------------------------------------------------------------------------------
-- 1. badges — one per completed module run
-- ---------------------------------------------------------------------------------------------------------------------
create table if not exists public.badges (
  id              uuid        primary key default gen_random_uuid(),
  user_id         uuid        not null references auth.users (id) on delete cascade,
  module_run_id   uuid        not null,
  module_key      text        not null,
  badge_key       text        not null,
  module_score    smallint    not null,
  max_score       smallint    not null,
  awarded_at      timestamptz not null,
  created_at      timestamptz not null default now(),

  constraint badges_run_fk
    foreign key (module_run_id, user_id, module_key)
    references public.module_runs (id, user_id, module_key) on delete cascade,
  constraint badges_badge_key_check check (
    (module_key, badge_key) in (
      ('spot-the-trap', 'scam-spotter'),
      ('trust-under-pressure', 'fraud-detective'),
      ('outsmart-the-scam', 'scamsense-guardian')
    )),
  constraint badges_score_check check (max_score = 200 and module_score between 0 and max_score),
  constraint badges_run_key unique (module_run_id),
  constraint badges_user_module_key unique (user_id, module_key)
);

comment on table public.badges is
  'One ScamSense learning badge per completed module (Scam Spotter, Fraud Detective, ScamSense Guardian). Not issued '
  'or accredited by PayPal. module_score is frozen from the two original attempts.';

-- ---------------------------------------------------------------------------------------------------------------------
-- 2. certificates — one per completed module run; the code never changes
-- ---------------------------------------------------------------------------------------------------------------------
create table if not exists public.certificates (
  id                uuid        primary key default gen_random_uuid(),
  user_id           uuid        not null references auth.users (id) on delete cascade,
  module_run_id     uuid        not null,
  module_key        text        not null,
  certificate_code  text        not null,
  recipient_name    text        not null,
  module_title      text        not null,
  completed_at      timestamptz not null,
  issued_at         timestamptz not null default now(),

  constraint certificates_run_fk
    foreign key (module_run_id, user_id, module_key)
    references public.module_runs (id, user_id, module_key) on delete cascade,
  constraint certificates_code_format check (certificate_code ~ '^SS[1-3]-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$'),
  constraint certificates_recipient_name_check check (char_length(recipient_name) between 1 and 60),
  constraint certificates_module_title_check check (char_length(module_title) between 1 and 80),
  constraint certificates_code_key unique (certificate_code),
  constraint certificates_run_key unique (module_run_id),
  constraint certificates_user_module_key unique (user_id, module_key),
  constraint certificates_id_user_key unique (id, user_id)
);

comment on table public.certificates is
  'ScamSense Certificate of Completion (educational simulation). Shown on screen; never directly downloadable (R25). '
  'recipient_name and module_title are snapshots taken at completion.';

-- Badges and certificates are final.
create or replace function public.module_rewards_immutable()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'module_reward_final' using errcode = 'P0001';
end;
$$;

drop trigger if exists badges_immutable on public.badges;
create trigger badges_immutable before update on public.badges
  for each row execute function public.module_rewards_immutable();
drop trigger if exists certificates_immutable on public.certificates;
create trigger certificates_immutable before update on public.certificates
  for each row execute function public.module_rewards_immutable();

-- ---------------------------------------------------------------------------------------------------------------------
-- 3. certificate_email_requests — one row per intentional send through Zapier
-- ---------------------------------------------------------------------------------------------------------------------
create table if not exists public.certificate_email_requests (
  id               uuid        primary key default gen_random_uuid(),
  certificate_id   uuid        not null,
  user_id          uuid        not null references auth.users (id) on delete cascade,
  recipient_email  text        not null,
  idempotency_key  uuid        not null,
  status           text        not null default 'PROCESSING',
  http_status      integer     null,
  error_code       text        null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  finished_at      timestamptz null,

  constraint certificate_email_requests_certificate_fk
    foreign key (certificate_id, user_id) references public.certificates (id, user_id) on delete cascade,
  constraint certificate_email_requests_status_check check (status in ('PROCESSING', 'SUBMITTED', 'FAILED')),
  constraint certificate_email_requests_email_check
    check (char_length(recipient_email) between 3 and 254 and recipient_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  constraint certificate_email_requests_error_check check (error_code is null or char_length(error_code) <= 40),
  constraint certificate_email_requests_finished_check check ((status = 'PROCESSING') = (finished_at is null)),
  constraint certificate_email_requests_idempotency_key unique (user_id, idempotency_key)
);

create index if not exists certificate_email_requests_certificate_idx
  on public.certificate_email_requests (certificate_id, created_at desc);
create index if not exists certificate_email_requests_user_idx
  on public.certificate_email_requests (user_id, created_at desc);

comment on table public.certificate_email_requests is
  'Optional certificate emails via Zapier. SUBMITTED = the Catch Hook accepted the request, not proof of delivery.';

-- Only PROCESSING → SUBMITTED | FAILED, once; identity fields are immutable.
create or replace function public.certificate_email_requests_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.status <> 'PROCESSING' then
    raise exception 'email_request_final' using errcode = 'P0001';
  end if;
  if (to_jsonb(new) - 'status' - 'http_status' - 'error_code' - 'updated_at' - 'finished_at')
     is distinct from (to_jsonb(old) - 'status' - 'http_status' - 'error_code' - 'updated_at' - 'finished_at') then
    raise exception 'email_request_immutable' using errcode = 'P0001';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists certificate_email_requests_guard on public.certificate_email_requests;
create trigger certificate_email_requests_guard before update on public.certificate_email_requests
  for each row execute function public.certificate_email_requests_guard();

-- ---------------------------------------------------------------------------------------------------------------------
-- 4. Awarding
-- ---------------------------------------------------------------------------------------------------------------------

-- Random, non-guessable code: SS<module order>-XXXX-XXXX-XXXX (48 random bits from gen_random_uuid's random part).
create or replace function public.new_certificate_code(p_module_key text)
returns text language plpgsql volatile set search_path = '' as $$
declare
  v_hex text := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
  v_order text := case p_module_key
    when 'spot-the-trap' then '1' when 'trust-under-pressure' then '2' when 'outsmart-the-scam' then '3' end;
begin
  return 'SS' || v_order || '-' || substr(v_hex, 1, 4) || '-' || substr(v_hex, 5, 4) || '-' || substr(v_hex, 9, 4);
end;
$$;

-- Awards the badge and certificate of a COMPLETED run. Idempotent: existing rows are never touched.
create or replace function public.award_module_rewards(p_module_run_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_run public.module_runs;
  v_original_count integer;
  v_score integer;
  v_name text;
  v_title text;
  v_badge_key text;
  v_try integer := 0;
begin
  select * into v_run from public.module_runs where id = p_module_run_id;
  if not found or v_run.completed_at is null then
    raise exception 'module_not_completed' using errcode = 'P0001';
  end if;

  -- Both ORIGINAL attempts must be complete and scored (replays never count).
  select count(distinct a.scenario_key), coalesce(sum(s.total_points), 0)
    into v_original_count, v_score
  from public.scenario_attempts a
  join public.scenario_scores s on s.attempt_id = a.id
  where a.module_run_id = v_run.id and a.attempt_number = 1 and a.state = 'COMPLETED' and not s.is_replay;
  if v_original_count < 2 then
    raise exception 'module_not_completed' using errcode = 'P0001';
  end if;

  v_badge_key := case v_run.module_key
    when 'spot-the-trap' then 'scam-spotter'
    when 'trust-under-pressure' then 'fraud-detective'
    when 'outsmart-the-scam' then 'scamsense-guardian' end;
  v_title := case v_run.module_key
    when 'spot-the-trap' then 'Spot the Trap'
    when 'trust-under-pressure' then 'Trust Under Pressure'
    when 'outsmart-the-scam' then 'Outsmart the Scam' end;

  insert into public.badges (user_id, module_run_id, module_key, badge_key, module_score, max_score, awarded_at)
  values (v_run.user_id, v_run.id, v_run.module_key, v_badge_key, v_score, 200, v_run.completed_at)
  on conflict do nothing;

  if not exists (select 1 from public.certificates where module_run_id = v_run.id) then
    select left(btrim(display_name), 60) into v_name from public.profiles where user_id = v_run.user_id;
    v_name := coalesce(nullif(v_name, ''), 'ScamSense learner');
    loop
      v_try := v_try + 1;
      begin
        insert into public.certificates
          (user_id, module_run_id, module_key, certificate_code, recipient_name, module_title, completed_at)
        values
          (v_run.user_id, v_run.id, v_run.module_key, public.new_certificate_code(v_run.module_key), v_name, v_title,
           v_run.completed_at)
        on conflict (module_run_id) do nothing;
        exit;
      exception when unique_violation then
        -- Only a certificate_code collision can get here (the run conflict is handled above); try a new code.
        if v_try >= 5 then
          raise;
        end if;
      end;
    end loop;
  end if;

  return jsonb_build_object('module_run_id', v_run.id, 'awarded', true);
end;
$$;

-- Fires once per run: on the single null → not-null completion write made by complete_scenario_attempt.
create or replace function public.module_runs_award_rewards()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.completed_at is null and new.completed_at is not null then
    perform public.award_module_rewards(new.id);
  end if;
  return null;
end;
$$;

drop trigger if exists module_runs_award_rewards on public.module_runs;
create trigger module_runs_award_rewards
  after update of completed_at on public.module_runs
  for each row execute function public.module_runs_award_rewards();

-- Repair path for the server (service_role): awards a completed run's rewards if they are somehow missing.
create or replace function public.ensure_module_rewards(p_user_id uuid, p_module_key text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_run public.module_runs;
begin
  select * into v_run from public.module_runs where user_id = p_user_id and module_key = p_module_key;
  if not found or v_run.completed_at is null then
    return 'not_completed';
  end if;
  if exists (select 1 from public.badges where module_run_id = v_run.id)
     and exists (select 1 from public.certificates where module_run_id = v_run.id) then
    return 'awarded';
  end if;
  perform public.award_module_rewards(v_run.id);
  return 'awarded';
end;
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 5. Certificate email requests
-- ---------------------------------------------------------------------------------------------------------------------

-- Returns {outcome, request}. outcome: created | existing (same idempotency key) | in_flight (another request for this
-- certificate is still being sent) | duplicate (same address submitted < 30 s ago) | rate_limited.
create or replace function public.begin_certificate_email_request(
  p_user_id uuid,
  p_certificate_id uuid,
  p_recipient_email text,
  p_idempotency_key uuid
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_cert public.certificates;
  v_row public.certificate_email_requests;
  v_email text := lower(btrim(p_recipient_email));
begin
  select * into v_cert from public.certificates
  where id = p_certificate_id and user_id = p_user_id for update;   -- serializes requests per certificate
  if not found then
    raise exception 'certificate_not_found' using errcode = 'P0001';
  end if;

  select * into v_row from public.certificate_email_requests
  where user_id = p_user_id and idempotency_key = p_idempotency_key;
  if found then
    if v_row.certificate_id <> p_certificate_id then
      raise exception 'idempotency_key_reused' using errcode = 'P0001';
    end if;
    return jsonb_build_object('outcome', 'existing', 'request', to_jsonb(v_row));
  end if;

  select * into v_row from public.certificate_email_requests
  where certificate_id = p_certificate_id and status = 'PROCESSING' and created_at > now() - interval '2 minutes'
  order by created_at desc limit 1;
  if found then
    return jsonb_build_object('outcome', 'in_flight', 'request', to_jsonb(v_row));
  end if;

  select * into v_row from public.certificate_email_requests
  where certificate_id = p_certificate_id and status = 'SUBMITTED' and recipient_email = v_email
    and created_at > now() - interval '30 seconds'
  order by created_at desc limit 1;
  if found then
    return jsonb_build_object('outcome', 'duplicate', 'request', to_jsonb(v_row));
  end if;

  if (select count(*) from public.certificate_email_requests
      where certificate_id = p_certificate_id and created_at > now() - interval '1 hour') >= 5
     or (select count(*) from public.certificate_email_requests
         where user_id = p_user_id and created_at > now() - interval '1 hour') >= 15 then
    return jsonb_build_object('outcome', 'rate_limited', 'request', null);
  end if;

  -- A PROCESSING row older than 2 minutes was abandoned (e.g. the server stopped mid-request): close it as failed.
  update public.certificate_email_requests
    set status = 'FAILED', error_code = 'abandoned', finished_at = now()
    where certificate_id = p_certificate_id and status = 'PROCESSING';

  insert into public.certificate_email_requests (certificate_id, user_id, recipient_email, idempotency_key)
  values (p_certificate_id, p_user_id, v_email, p_idempotency_key)
  returning * into v_row;
  return jsonb_build_object('outcome', 'created', 'request', to_jsonb(v_row));
end;
$$;

create or replace function public.finish_certificate_email_request(
  p_user_id uuid,
  p_request_id uuid,
  p_status text,
  p_http_status integer,
  p_error_code text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_row public.certificate_email_requests;
begin
  if p_status not in ('SUBMITTED', 'FAILED') then
    raise exception 'invalid_email_status' using errcode = 'P0001';
  end if;
  select * into v_row from public.certificate_email_requests
  where id = p_request_id and user_id = p_user_id for update;
  if not found then
    raise exception 'email_request_not_found' using errcode = 'P0001';
  end if;
  if v_row.status <> 'PROCESSING' then
    return to_jsonb(v_row);   -- already finished: idempotent
  end if;
  update public.certificate_email_requests
    set status = p_status, http_status = p_http_status, error_code = left(p_error_code, 40), finished_at = now()
    where id = p_request_id
    returning * into v_row;
  return to_jsonb(v_row);
end;
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 6. Private storage bucket for generated certificate PDFs (read only through short-lived signed URLs)
-- ---------------------------------------------------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('certificate-pdfs', 'certificate-pdfs', false, 2097152, array['application/pdf'])
on conflict (id) do update set public = false, file_size_limit = 2097152, allowed_mime_types = array['application/pdf'];
-- No storage.objects policies are created for this bucket: anon/authenticated cannot list, read, or write it.

-- ---------------------------------------------------------------------------------------------------------------------
-- 7. Row Level Security and privileges
-- ---------------------------------------------------------------------------------------------------------------------
alter table public.badges enable row level security;
alter table public.certificates enable row level security;
alter table public.certificate_email_requests enable row level security;

drop policy if exists "badges_select_own" on public.badges;
create policy "badges_select_own" on public.badges
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "certificates_select_own" on public.certificates;
create policy "certificates_select_own" on public.certificates
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "certificate_email_requests_select_own" on public.certificate_email_requests;
create policy "certificate_email_requests_select_own" on public.certificate_email_requests
  for select to authenticated using ((select auth.uid()) = user_id);

revoke all on table public.badges from public, anon, authenticated, service_role;
revoke all on table public.certificates from public, anon, authenticated, service_role;
revoke all on table public.certificate_email_requests from public, anon, authenticated, service_role;
grant select on table public.badges to authenticated, service_role;
grant select on table public.certificates to authenticated, service_role;
grant select on table public.certificate_email_requests to authenticated, service_role;

revoke all on function public.module_rewards_immutable() from public, anon, authenticated;
revoke all on function public.certificate_email_requests_guard() from public, anon, authenticated;
revoke all on function public.new_certificate_code(text) from public, anon, authenticated;
revoke all on function public.award_module_rewards(uuid) from public, anon, authenticated, service_role;
revoke all on function public.module_runs_award_rewards() from public, anon, authenticated;
revoke all on function public.ensure_module_rewards(uuid, text) from public, anon, authenticated;
revoke all on function public.begin_certificate_email_request(uuid, uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.finish_certificate_email_request(uuid, uuid, text, integer, text)
  from public, anon, authenticated;
grant execute on function public.ensure_module_rewards(uuid, text) to service_role;
grant execute on function public.begin_certificate_email_request(uuid, uuid, text, uuid) to service_role;
grant execute on function public.finish_certificate_email_request(uuid, uuid, text, integer, text) to service_role;

-- ---------------------------------------------------------------------------------------------------------------------
-- 8. Backfill: modules completed before this migration get their badge and certificate now (idempotent)
-- ---------------------------------------------------------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in select id from public.module_runs where completed_at is not null loop
    perform public.award_module_rewards(r.id);
  end loop;
end;
$$;
