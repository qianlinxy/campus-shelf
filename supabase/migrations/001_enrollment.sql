-- Run once in a new Supabase project. Enrollment stays CLOSED until configured.
-- Contacts stay in auth.users; no name, email or phone column in research tables.
begin;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table private.pilot_settings (
 id boolean primary key default true check(id),
 enrollment_open boolean not null default false,
 consent_version text not null default '',
 catalog_version text not null default 'synthetic-pakistan-catalog-v2',
 config jsonb not null default '{"budget":600,"price":false,"position":false,"labels":true,"upf":true,"discountPercent":20}'::jsonb
);
insert into private.pilot_settings(id) values(true);

create table private.catalog (
 id text primary key,
 version text not null,
 product jsonb not null
);

create table public.participant_profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 participant_id uuid not null unique default gen_random_uuid(),
 dob date not null,
 gender text not null check(gender in ('female','male','other','prefer_not_to_say')),
 university text not null check(char_length(university) between 2 and 160),
 consent_version text not null,
 consented_at timestamptz not null default now(),
 registered_at timestamptz not null default now(),
 age_at_registration smallint not null check(age_at_registration between 18 and 26),
 pilot_config jsonb not null,
 catalog_version text not null
);
alter table public.participant_profiles enable row level security;
revoke all on public.participant_profiles from public, anon, authenticated;
grant select on public.participant_profiles to authenticated;
create policy own_profile_read on public.participant_profiles for select to authenticated using((select auth.uid())=user_id);
-- No client INSERT/UPDATE/DELETE grants or policies. Use the validated RPC below.

create table private.pilot_tasks (
 session_id uuid primary key,
 participant_id uuid not null references public.participant_profiles(participant_id) on delete cascade,
 basket jsonb not null,
 language text not null check(language in ('zh','en','ur')),
 catalog_version text not null,
 result jsonb not null,
 submitted_at timestamptz not null default now()
);

create function public.get_my_profile() returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('participant_id',p.participant_id,'dob',p.dob,'gender',p.gender,'university',p.university,'pilot_config',p.pilot_config,'catalog_version',p.catalog_version)
 from public.participant_profiles p where p.user_id=auth.uid();
$$;

create function public.register_participant(p_dob date,p_gender text,p_university text,p_consent_version text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_user uuid:=auth.uid(); v_settings private.pilot_settings; v_today date:=(now() at time zone 'Asia/Karachi')::date; v_age int;
begin
 if v_user is null or not exists(select 1 from auth.users u where u.id=v_user and (u.email_confirmed_at is not null or u.phone_confirmed_at is not null)) then raise exception 'verified_contact_required'; end if;
 if exists(select 1 from public.participant_profiles where user_id=v_user) then return public.get_my_profile(); end if;
 select * into strict v_settings from private.pilot_settings where id=true;
 if not v_settings.enrollment_open or v_settings.consent_version='' or p_consent_version is distinct from v_settings.consent_version then raise exception 'enrollment_closed'; end if;
 v_age:=extract(year from age(v_today,p_dob));
 if p_dob is null or p_dob>v_today or v_age not between 18 and 26 then raise exception 'ineligible_age'; end if;
 if p_gender is null or p_gender not in ('female','male','other','prefer_not_to_say') then raise exception 'invalid_gender'; end if;
 if p_university is null or char_length(btrim(p_university)) not between 2 and 160 then raise exception 'invalid_university'; end if;
 insert into public.participant_profiles(user_id,dob,gender,university,consent_version,age_at_registration,pilot_config,catalog_version)
 values(v_user,p_dob,p_gender,btrim(p_university),v_settings.consent_version,v_age,v_settings.config,v_settings.catalog_version)
 on conflict(user_id) do nothing;
 return public.get_my_profile();
end;
$$;

create function public.submit_pilot_task(p_session_id uuid,p_basket jsonb,p_language text,p_catalog_version text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 p public.participant_profiles; s private.pilot_settings; existing private.pilot_tasks; row record;
 item jsonb; product jsonb; qty int; price_minor bigint; amount_minor bigint:=0;
 energy numeric:=0; upf_energy numeric:=0; unknown_energy numeric:=0; item_energy numeric;
 ids text[]:='{}'; result jsonb; submitted timestamptz;
begin
 select * into p from public.participant_profiles where user_id=auth.uid();
 if not found then raise exception 'profile_required'; end if;
 if p_session_id is null or p_basket is null or jsonb_typeof(p_basket)<>'array' or jsonb_array_length(p_basket)>100 then raise exception 'invalid_basket'; end if;
 if p_language is null or p_language not in ('zh','en','ur') or p_catalog_version is distinct from p.catalog_version then raise exception 'invalid_task_metadata'; end if;
 -- Serialize a retry for the same UUID; completed submissions are immutable.
 perform pg_advisory_xact_lock(hashtextextended(p_session_id::text,0));
 select * into existing from private.pilot_tasks where session_id=p_session_id;
 if found then
  if existing.participant_id<>p.participant_id or existing.basket<>p_basket then raise exception 'session_conflict'; end if;
  return jsonb_build_object('session_id',existing.session_id,'submitted_at',existing.submitted_at,'result',existing.result);
 end if;
 select * into strict s from private.pilot_settings where id=true;
 if not s.enrollment_open then raise exception 'enrollment_closed'; end if;
 for item in select value from jsonb_array_elements(p_basket) loop
  if jsonb_typeof(item)<>'object' or jsonb_typeof(item->'id') is distinct from 'string' or jsonb_typeof(item->'quantity') is distinct from 'number'
    or (select count(*) from jsonb_object_keys(item))<>2 or (item->>'quantity') !~ '^[1-9][0-9]?$' then raise exception 'invalid_item'; end if;
  qty:=(item->>'quantity')::int;
  if item->>'id'=any(ids) then raise exception 'duplicate_item'; end if;
  ids:=array_append(ids,item->>'id');
  select c.product into product from private.catalog c where c.id=item->>'id' and c.version=p.catalog_version;
  if not found then raise exception 'unknown_product'; end if;
  price_minor:=round((product->>'price')::numeric*100*case when (p.pilot_config->>'price')::boolean and (product->>'eligible')::boolean then 1-(p.pilot_config->>'discountPercent')::numeric/100 else 1 end);
  amount_minor:=amount_minor+price_minor*qty;
  item_energy:=(product->>'kcal')::numeric*(product->>'size')::numeric/100*qty;
  energy:=energy+item_energy;
  if (product->>'nova')::int=4 then upf_energy:=upf_energy+item_energy; end if;
  if product->>'nova' is null then unknown_energy:=unknown_energy+item_energy; end if;
 end loop;
 if amount_minor>(p.pilot_config->>'budget')::bigint*100 then raise exception 'budget_exceeded'; end if;
 result:=jsonb_build_object('amountMinor',amount_minor,'energy',energy,'upfEnergy',upf_energy,'unknownEnergy',unknown_energy,
  'upfShare',case when energy>0 and unknown_energy=0 then upf_energy/energy else null end,'config',p.pilot_config,'syntheticProducts',true,'assignment','fixed-pilot-not-randomized');
 insert into private.pilot_tasks(session_id,participant_id,basket,language,catalog_version,result)
 values(p_session_id,p.participant_id,p_basket,p_language,p_catalog_version,result) returning submitted_at into submitted;
 return jsonb_build_object('session_id',p_session_id,'submitted_at',submitted,'result',result);
end;
$$;

revoke all on function public.get_my_profile() from public,anon;
revoke all on function public.register_participant(date,text,text,text) from public,anon;
revoke all on function public.submit_pilot_task(uuid,jsonb,text,text) from public,anon;
grant execute on function public.get_my_profile() to authenticated;
grant execute on function public.register_participant(date,text,text,text) to authenticated;
grant execute on function public.submit_pilot_task(uuid,jsonb,text,text) to authenticated;
commit;
