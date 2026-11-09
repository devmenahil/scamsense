-- =====================================================================================================================
-- ScamSense — Phase 2 (Step 4): user profiles
--
-- Creates public.profiles (one row per Supabase Auth user), its Row Level Security policies, minimum Data API
-- privileges, and the trigger that creates the profile row when an account is registered.
--
-- Project settings this migration is written for: Data API ON, "automatically expose new tables" OFF, automatic RLS
-- ON. Because new tables are not exposed automatically, the GRANTs below are what make `profiles` reachable through
-- the Data API — and only for the signed-in `authenticated` role, only for the caller's own row (RLS), and only for
-- the columns a user may legitimately change.
--
-- Credentials: emails and passwords live ONLY in Supabase Auth (auth.users). This table never stores either.
--
-- The check constraints mirror src/content/profileOptions.ts, src/content/countries.ts and the enabled currency
-- allowlist in src/lib/domain/currency.ts. src/lib/profile/migration.test.ts fails if they drift apart; changing a
-- list requires a NEW migration (never edit this file once applied).
--
-- Run once: Supabase Dashboard → SQL Editor → paste this whole file → Run. (Or `supabase db push` with the CLI.)
-- =====================================================================================================================

-- ---------------------------------------------------------------------------------------------------------------------
-- 1. Table
-- ---------------------------------------------------------------------------------------------------------------------
create table if not exists public.profiles (
  user_id                 uuid primary key references auth.users (id) on delete cascade,
  display_name            text        not null,
  age_confirmed           boolean     not null,
  age_confirmed_at        timestamptz not null default now(),
  age_bracket             text,
  occupation              text,
  country                 text,
  financial_activities    text[]      not null default '{}',
  payment_experience      text,
  income_bracket          text,
  income_bracket_label    text,
  financial_goal          text,
  custom_goal             text,
  goal_amount_minor       bigint,
  preferred_currency      text        not null default 'USD',
  onboarding_completed    boolean     not null default false,
  onboarding_completed_at timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),

  constraint profiles_display_name_check
    check (char_length(btrim(display_name)) between 1 and 60),
  -- Registration requires the 18+ attestation (R2); a row cannot exist without it.
  constraint profiles_age_confirmed_check
    check (age_confirmed = true),
  constraint profiles_age_bracket_check
    check (age_bracket is null or age_bracket in ('18_24', '25_34', '35_44', '45_54', '55_64', '65_plus')),
  constraint profiles_occupation_check
    check (occupation is null or occupation in ('student', 'employed_professional', 'freelancer', 'business_owner', 'self_employed', 'job_seeker', 'retired', 'other')),
  constraint profiles_country_check
    check (country is null or country in (
      'AD', 'AE', 'AF', 'AG', 'AI', 'AL', 'AM', 'AO', 'AQ', 'AR', 'AS', 'AT',
      'AU', 'AW', 'AX', 'AZ', 'BA', 'BB', 'BD', 'BE', 'BF', 'BG', 'BH', 'BI',
      'BJ', 'BL', 'BM', 'BN', 'BO', 'BQ', 'BR', 'BS', 'BT', 'BV', 'BW', 'BY',
      'BZ', 'CA', 'CC', 'CD', 'CF', 'CG', 'CH', 'CI', 'CK', 'CL', 'CM', 'CN',
      'CO', 'CR', 'CU', 'CV', 'CW', 'CX', 'CY', 'CZ', 'DE', 'DJ', 'DK', 'DM',
      'DO', 'DZ', 'EC', 'EE', 'EG', 'EH', 'ER', 'ES', 'ET', 'FI', 'FJ', 'FK',
      'FM', 'FO', 'FR', 'GA', 'GB', 'GD', 'GE', 'GF', 'GG', 'GH', 'GI', 'GL',
      'GM', 'GN', 'GP', 'GQ', 'GR', 'GS', 'GT', 'GU', 'GW', 'GY', 'HK', 'HM',
      'HN', 'HR', 'HT', 'HU', 'ID', 'IE', 'IL', 'IM', 'IN', 'IO', 'IQ', 'IR',
      'IS', 'IT', 'JE', 'JM', 'JO', 'JP', 'KE', 'KG', 'KH', 'KI', 'KM', 'KN',
      'KP', 'KR', 'KW', 'KY', 'KZ', 'LA', 'LB', 'LC', 'LI', 'LK', 'LR', 'LS',
      'LT', 'LU', 'LV', 'LY', 'MA', 'MC', 'MD', 'ME', 'MF', 'MG', 'MH', 'MK',
      'ML', 'MM', 'MN', 'MO', 'MP', 'MQ', 'MR', 'MS', 'MT', 'MU', 'MV', 'MW',
      'MX', 'MY', 'MZ', 'NA', 'NC', 'NE', 'NF', 'NG', 'NI', 'NL', 'NO', 'NP',
      'NR', 'NU', 'NZ', 'OM', 'PA', 'PE', 'PF', 'PG', 'PH', 'PK', 'PL', 'PM',
      'PN', 'PR', 'PS', 'PT', 'PW', 'PY', 'QA', 'RE', 'RO', 'RS', 'RU', 'RW',
      'SA', 'SB', 'SC', 'SD', 'SE', 'SG', 'SH', 'SI', 'SJ', 'SK', 'SL', 'SM',
      'SN', 'SO', 'SR', 'SS', 'ST', 'SV', 'SX', 'SY', 'SZ', 'TC', 'TD', 'TF',
      'TG', 'TH', 'TJ', 'TK', 'TL', 'TM', 'TN', 'TO', 'TR', 'TT', 'TV', 'TW',
      'TZ', 'UA', 'UG', 'UM', 'US', 'UY', 'UZ', 'VA', 'VC', 'VE', 'VG', 'VI',
      'VN', 'VU', 'WF', 'WS', 'YE', 'YT', 'ZA', 'ZM', 'ZW'
    )),
  constraint profiles_financial_activities_check
    check (
      cardinality(financial_activities) <= 10
      and financial_activities <@ array['online_shopping', 'online_selling', 'freelance_payments', 'sending_invoices', 'receiving_invoices', 'job_applications', 'business_purchases', 'subscription_payments', 'investments', 'digital_wallet_usage']::text[]
    ),
  constraint profiles_payment_experience_check
    check (payment_experience is null or payment_experience in ('new', 'occasional', 'frequent')),
  constraint profiles_income_bracket_check
    check (income_bracket is null or income_bracket in ('prefer_not_to_say', 'under_1000', '1000_2499', '2500_4999', '5000_9999', '10000_plus')),
  constraint profiles_financial_goal_check
    check (financial_goal is null or financial_goal in ('buying_laptop', 'vacation_travel', 'building_savings', 'education', 'business_growth', 'paying_off_debt', 'other')),
  constraint profiles_custom_goal_check
    check (custom_goal is null or char_length(custom_goal) <= 120),
  -- Integer minor units only (R38); upper bound = 10,000,000 major units at 2 decimals.
  constraint profiles_goal_amount_minor_check
    check (goal_amount_minor is null or (goal_amount_minor > 0 and goal_amount_minor <= 1000000000)),
  -- Conservative PayPal Sandbox allowlist (src/lib/domain/currency.ts). USD is the default.
  constraint profiles_preferred_currency_check
    check (preferred_currency in ('USD', 'AUD', 'CAD', 'EUR', 'GBP')),
  -- A profile can only be marked onboarded once every required field is present.
  constraint profiles_onboarding_required_fields_check
    check (
      onboarding_completed = false
      or (
        occupation is not null
        and country is not null
        and cardinality(financial_activities) >= 1
        and payment_experience is not null
        and financial_goal is not null
      )
    )
);

comment on table public.profiles is
  'ScamSense learner profile, 1:1 with auth.users. No credentials or email addresses are stored here.';

-- ---------------------------------------------------------------------------------------------------------------------
-- 2. Row-maintenance trigger (BEFORE INSERT/UPDATE)
--    * normalizes display name / custom goal whitespace and de-duplicates activities
--    * derives income_bracket_label from the stable identifier (never client-supplied)
--    * stamps onboarding_completed_at once, and never lets a completed onboarding flip back
--    * keeps identity/attestation columns immutable and maintains updated_at
-- ---------------------------------------------------------------------------------------------------------------------
create or replace function public.profiles_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.display_name := btrim(new.display_name);
  new.custom_goal := nullif(btrim(new.custom_goal), '');
  new.financial_activities := coalesce(
    array(select distinct a from unnest(new.financial_activities) as a where a is not null order by a),
    '{}'
  );
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

drop trigger if exists profiles_before_write on public.profiles;
create trigger profiles_before_write
  before insert or update on public.profiles
  for each row execute function public.profiles_before_write();

-- ---------------------------------------------------------------------------------------------------------------------
-- 3. Create the profile when an account is registered (AFTER INSERT on auth.users)
--    Reads the sign-up metadata supplied by the ScamSense sign-up form. Registration is rejected at the database
--    level unless the 18+ confirmation is present, so the attestation cannot be bypassed by calling the Auth API
--    directly. SECURITY DEFINER is required to write into public.profiles from the auth schema trigger; the function
--    pins search_path and only ever inserts the row for NEW.id.
--    Note: users added manually in the dashboard ("Add user") have no metadata and will be rejected. Create test
--    accounts through the ScamSense sign-up page instead.
-- ---------------------------------------------------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_name text := btrim(coalesce(meta ->> 'display_name', ''));
  v_bracket text := nullif(btrim(coalesce(meta ->> 'age_bracket', '')), '');
begin
  if coalesce(meta ->> 'age_confirmed', '') <> 'true' then
    raise exception 'ScamSense registration requires confirming you are at least 18 years old'
      using errcode = 'check_violation';
  end if;
  if char_length(v_name) not between 1 and 60 then
    raise exception 'ScamSense registration requires a display name of 1-60 characters'
      using errcode = 'check_violation';
  end if;

  insert into public.profiles (user_id, display_name, age_confirmed, age_bracket)
  values (new.id, v_name, true, v_bracket);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Trigger functions are never callable through the Data API.
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.profiles_before_write() from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------------------
-- 4. Row Level Security: a user can only ever see or change their own row
-- ---------------------------------------------------------------------------------------------------------------------
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- No INSERT policy (rows are created only by handle_new_user) and no DELETE policy (rows are removed only by the
-- ON DELETE CASCADE when the auth user is deleted).

-- ---------------------------------------------------------------------------------------------------------------------
-- 5. Data API privileges (minimum required). New tables are NOT auto-exposed, so grant explicitly.
-- ---------------------------------------------------------------------------------------------------------------------
revoke all on table public.profiles from public, anon, authenticated;

grant usage on schema public to authenticated;
grant select on table public.profiles to authenticated;
-- Column-level UPDATE: identity, attestation, derived and timestamp columns are not client-writable.
grant update (
  display_name,
  age_bracket,
  occupation,
  country,
  financial_activities,
  payment_experience,
  income_bracket,
  financial_goal,
  custom_goal,
  goal_amount_minor,
  preferred_currency,
  onboarding_completed
) on table public.profiles to authenticated;
