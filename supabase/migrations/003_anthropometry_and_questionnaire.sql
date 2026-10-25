-- Additive upgrade from v0.2. Existing participant IDs and shopping data remain.
-- Nullable columns represent historical records not yet asked these questions.
begin;
alter table public.participant_profiles
 add column height_cm numeric,
 add column weight_kg numeric,
 add column waist_cm numeric,
 add column anthropometry_entered_at timestamptz,
 add column questionnaire_code text,
 add constraint height_entry_check check(height_cm between 50 and 250 and height_cm=round(height_cm,1)),
 add constraint weight_entry_check check(weight_kg between 20 and 400 and weight_kg=round(weight_kg,1)),
 add constraint waist_entry_check check(waist_cm between 30 and 250 and waist_cm=round(waist_cm,1)),
 add constraint measurements_together_check check(
  (height_cm is null and weight_kg is null and waist_cm is null and anthropometry_entered_at is null)
  or (height_cm is not null and weight_kg is not null and waist_cm is not null and anthropometry_entered_at is not null)),
 add constraint questionnaire_code_check check(questionnaire_code is null or
  (char_length(questionnaire_code) between 1 and 80 and questionnaire_code=btrim(questionnaire_code) and questionnaire_code !~ '[[:cntrl:]]'));
create unique index participant_questionnaire_code_unique on public.participant_profiles(questionnaire_code) where questionnaire_code is not null;

create or replace function public.get_my_profile() returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('participant_id',p.participant_id,'dob',p.dob,'gender',p.gender,'university',p.university,
  'height_cm',p.height_cm,'weight_kg',p.weight_kg,'waist_cm',p.waist_cm,'anthropometry_entered_at',p.anthropometry_entered_at,
  'questionnaire_code',p.questionnaire_code,'questionnaire_link_status',case when p.questionnaire_code is null then 'not_provided' else 'pending_review' end,
  'pilot_config',p.pilot_config,'catalog_version',p.catalog_version)
 from public.participant_profiles p where p.user_id=auth.uid();
$$;

create function public.register_participant(p_dob date,p_gender text,p_university text,p_consent_version text,
 p_height_cm numeric,p_weight_kg numeric,p_waist_cm numeric,p_questionnaire_code text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_user uuid:=auth.uid(); v_settings private.pilot_settings; v_today date:=(now() at time zone 'Asia/Karachi')::date;
 v_age int; v_existing public.participant_profiles; v_code text:=nullif(btrim(p_questionnaire_code),'');
begin
 -- Lock by verified auth identity to serialize repeat registrations by one user.
 perform 1 from auth.users u where u.id=v_user and (u.email_confirmed_at is not null or u.phone_confirmed_at is not null) for update;
 if v_user is null or not found then raise exception 'verified_contact_required'; end if;
 select * into v_existing from public.participant_profiles where user_id=v_user for update;
 if found and v_existing.height_cm is not null and v_existing.weight_kg is not null and v_existing.waist_cm is not null then return public.get_my_profile(); end if;
 select * into strict v_settings from private.pilot_settings where id=true;
 if not v_settings.enrollment_open or v_settings.consent_version='' or p_consent_version is distinct from v_settings.consent_version then raise exception 'enrollment_closed'; end if;
 v_age:=extract(year from age(v_today,p_dob));
 if p_dob is null or p_dob>v_today or v_age not between 18 and 26 then raise exception 'ineligible_age'; end if;
 if p_gender is null or p_gender not in ('female','male','other','prefer_not_to_say') then raise exception 'invalid_gender'; end if;
 if p_university is null or char_length(btrim(p_university)) not between 2 and 160 then raise exception 'invalid_university'; end if;
 -- Broad input-quality bounds only; these are not clinical thresholds.
 if p_height_cm is null or not(p_height_cm between 50 and 250) or p_height_cm<>round(p_height_cm,1) then raise exception 'invalid_height'; end if;
 if p_weight_kg is null or not(p_weight_kg between 20 and 400) or p_weight_kg<>round(p_weight_kg,1) then raise exception 'invalid_weight'; end if;
 if p_waist_cm is null or not(p_waist_cm between 30 and 250) or p_waist_cm<>round(p_waist_cm,1) then raise exception 'invalid_waist'; end if;
 if v_code is not null and (char_length(v_code)>80 or v_code ~ '[[:cntrl:]]') then raise exception 'invalid_questionnaire_code'; end if;
 if v_existing.user_id is not null then
  -- Complete legacy records once; preserve original demographics, IDs and allocation.
  if v_existing.dob<>p_dob or v_existing.gender<>p_gender or v_existing.university<>btrim(p_university) then raise exception 'legacy_identity_mismatch'; end if;
  if v_existing.questionnaire_code is not null and v_code is distinct from v_existing.questionnaire_code then raise exception 'questionnaire_code_unavailable'; end if;
  update public.participant_profiles set height_cm=p_height_cm,weight_kg=p_weight_kg,waist_cm=p_waist_cm,
   anthropometry_entered_at=now(),questionnaire_code=v_code,consent_version=v_settings.consent_version,consented_at=now() where user_id=v_user;
 else
  insert into public.participant_profiles(user_id,dob,gender,university,consent_version,age_at_registration,pilot_config,catalog_version,
   height_cm,weight_kg,waist_cm,anthropometry_entered_at,questionnaire_code)
  values(v_user,p_dob,p_gender,btrim(p_university),v_settings.consent_version,v_age,v_settings.config,v_settings.catalog_version,
   p_height_cm,p_weight_kg,p_waist_cm,now(),v_code);
 end if;
 return public.get_my_profile();
exception when unique_violation then raise exception 'questionnaire_code_unavailable';
end;
$$;

-- Keep the old function for migration history but disable its incomplete-registration API.
revoke execute on function public.register_participant(date,text,text,text) from public,anon,authenticated;
revoke all on function public.register_participant(date,text,text,text,numeric,numeric,numeric,text) from public,anon;
grant execute on function public.register_participant(date,text,text,text,numeric,numeric,numeric,text) to authenticated;

create function private.require_complete_profile_for_task() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.participant_profiles p where p.participant_id=new.participant_id
  and p.height_cm is not null and p.weight_kg is not null and p.waist_cm is not null) then raise exception 'profile_incomplete'; end if;
 return new;
end;
$$;
revoke all on function private.require_complete_profile_for_task() from public,anon,authenticated;
create trigger pilot_task_requires_measurements before insert on private.pilot_tasks
for each row execute function private.require_complete_profile_for_task();
commit;
