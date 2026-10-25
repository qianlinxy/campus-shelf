-- Additive: old fixed-pilot profiles and receipts are retained, never reclassified.
-- New studies are CLOSED. The seeded catalog and rules are synthetic test fixtures.
begin;
create table private.studies (
 id text primary key check(id ~ '^[a-z0-9][a-z0-9_-]{2,63}$'),
 enrollment_open boolean not null default false,
 tasks_open boolean not null default false,
 protocol_version text not null,
 consent_version text not null default '',
 catalog_version text not null,
 rules_version text not null default 'prototype-traffic-lights-v1',
 layout_version text not null default 'physical-rack-v2',
 base_config jsonb not null,
 catalog_snapshot jsonb not null,
 synthetic boolean not null default true,
 created_at timestamptz not null default now()
);
insert into private.studies(id,protocol_version,catalog_version,base_config,catalog_snapshot)
select 'almab-factorial-test-v1','candidate-protocol-v1', 'synthetic-pakistan-catalog-v3',
 '{"schemaVersion":2,"budget":600,"markupPercent":25,"placementRule":"upf-or-high","controlLayout":"targets-eye"}',
 jsonb_agg(product order by (product->>'catalogOrder')::int)
from private.catalog where version='synthetic-pakistan-catalog-v3';

create table private.study_admins (
 user_id uuid primary key references auth.users(id), can_export boolean not null default false,
 created_at timestamptz not null default now()
);
-- The randomization sequence is inaccessible to students and to the monitoring RPC.
-- Concealed permuted blocks of 16, each containing two of each of the 8 conditions.
create table private.randomization_slots (
 study_id text not null references private.studies(id), ordinal integer not null,
 condition integer not null check(condition between 0 and 7),
 primary key(study_id,ordinal)
);
create table private.allocations (
 id uuid primary key default gen_random_uuid(), study_id text not null references private.studies(id),
 participant_id uuid not null references public.participant_profiles(participant_id),
 ordinal integer not null, condition integer not null check(condition between 0 and 7),
 config jsonb not null, assigned_at timestamptz not null default now(),
 unique(study_id,participant_id), unique(study_id,ordinal),
 foreign key(study_id,ordinal) references private.randomization_slots(study_id,ordinal)
);
create table private.study_tasks (
 id uuid primary key default gen_random_uuid(), allocation_id uuid not null unique references private.allocations(id),
 basket jsonb not null default '[]', revision integer not null default 0,
 started_at timestamptz not null default now(), saved_at timestamptz,
 completed_at timestamptz, result jsonb, language text not null default 'en' check(language in ('zh','en','ur')),
 last_request_id uuid, check((completed_at is null)=(result is null))
);
create table private.study_events (
 id uuid primary key, task_id uuid not null references private.study_tasks(id),
 event_type text not null, client_time timestamptz, details jsonb not null,
 received_at timestamptz not null default now()
);
create index study_events_task_idx on private.study_events(task_id);
create table private.export_sessions (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id),
 study_id text not null references private.studies(id), dataset text not null,
 filters jsonb not null, cutoff timestamptz not null default now()
);

create function private.freeze_study_definition() returns trigger language plpgsql set search_path='' as $$
begin
 if exists(select 1 from private.allocations where study_id=old.id)
 and (to_jsonb(new)-'enrollment_open'-'tasks_open') is distinct from (to_jsonb(old)-'enrollment_open'-'tasks_open')
 then raise exception 'study_definition_locked'; end if;
 return new;
end; $$;
create trigger freeze_study_definition before update on private.studies for each row execute function private.freeze_study_definition();

create function private.study_task_json(p_task uuid) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('id',t.id,'study_id',a.study_id,'participant_id',a.participant_id,
 'config',a.config,'condition_code',lpad(a.condition::bit(3)::text,3,'0'),
 'catalog_version',s.catalog_version,'protocol_version',s.protocol_version,'rules_version',s.rules_version,
 'layout_version',s.layout_version,'synthetic',s.synthetic,'products',s.catalog_snapshot,
 'basket',t.basket,'revision',t.revision,'started_at',t.started_at,'saved_at',t.saved_at,
 'completed_at',t.completed_at,'result',t.result,'language',t.language)
 from private.study_tasks t join private.allocations a on a.id=t.allocation_id join private.studies s on s.id=a.study_id where t.id=p_task;
$$;

create function public.get_or_start_study_task(p_study_id text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p public.participant_profiles; s private.studies; a private.allocations; v_task uuid; n integer; c integer; cfg jsonb;
begin
 select * into p from public.participant_profiles where user_id=auth.uid();
 if p.user_id is null or p.height_cm is null or p.weight_kg is null or p.waist_cm is null then raise exception 'profile_incomplete'; end if;
 -- One study-row lock serializes allocation, including two devices starting together.
 select * into s from private.studies where id=p_study_id for update;
 if not found then raise exception 'study_unavailable'; end if;
 select * into a from private.allocations where study_id=s.id and participant_id=p.participant_id;
 if a.id is not null then
  select id into strict v_task from private.study_tasks where allocation_id=a.id;
  return private.study_task_json(v_task);
 end if;
 if not s.enrollment_open or not s.tasks_open then raise exception 'study_closed'; end if;
 if p.consent_version is distinct from s.consent_version or s.consent_version='' then raise exception 'study_consent_mismatch'; end if;
 if p.catalog_version is distinct from s.catalog_version then raise exception 'catalog_version_mismatch'; end if;
 if s.base_config->>'controlLayout' not in ('targets-eye','category','popularity')
 or (s.base_config->>'budget')::integer not between 100 and 5000
 or (s.base_config->>'markupPercent')::integer not in (20,25,30)
 or s.base_config->>'placementRule' not in ('upf','upf-or-high')
 or jsonb_array_length(s.catalog_snapshot)<>50 then raise exception 'invalid_study_definition'; end if;
 select coalesce(max(ordinal),0)+1 into n from private.allocations where study_id=s.id;
 if not exists(select 1 from private.randomization_slots where study_id=s.id and ordinal=n) then
  insert into private.randomization_slots(study_id,ordinal,condition)
  select s.id,n-1+row_number() over(order by gen_random_uuid()),k%8 from generate_series(0,15) k;
 end if;
 select condition into strict c from private.randomization_slots where study_id=s.id and ordinal=n;
 cfg:=(s.base_config-'controlLayout')||jsonb_build_object('price',(c&4)<>0,'position',(c&2)<>0,
  'layoutMode',case when (c&2)<>0 then 'alternatives-eye' else s.base_config->>'controlLayout' end,
  'labels',(c&1)<>0,'upf',(c&1)<>0);
 insert into private.allocations(study_id,participant_id,ordinal,condition,config) values(s.id,p.participant_id,n,c,cfg) returning * into a;
 insert into private.study_tasks(allocation_id) values(a.id) returning id into v_task;
 return private.study_task_json(v_task);
end; $$;

-- All outcome calculations use the immutable study catalog, not browser values.
create function private.study_basket_result(p_basket jsonb,p_config jsonb,p_catalog jsonb) returns jsonb
language plpgsql set search_path='' as $$
declare item jsonb; product jsonb; qty integer; unit_price bigint; amount bigint:=0; energy numeric:=0;
 upf_energy numeric:=0; unknown_energy numeric:=0; item_energy numeric; ids text[]:='{}'; items jsonb:='[]'; count_units integer:=0;
begin
 if p_basket is null or jsonb_typeof(p_basket)<>'array' or jsonb_array_length(p_basket)>50 then raise exception 'invalid_basket'; end if;
 for item in select value from jsonb_array_elements(p_basket) loop
  if jsonb_typeof(item)<>'object' or jsonb_typeof(item->'id') is distinct from 'string'
   or jsonb_typeof(item->'quantity') is distinct from 'number' or (item->>'quantity') !~ '^[1-9][0-9]?$'
   or (select count(*) from jsonb_object_keys(item))<>2 then raise exception 'invalid_item'; end if;
  if item->>'id'=any(ids) then raise exception 'duplicate_item'; end if;
  ids:=array_append(ids,item->>'id'); qty:=(item->>'quantity')::int;
  select value into product from jsonb_array_elements(p_catalog) where value->>'id'=item->>'id';
  if product is null then raise exception 'unknown_product'; end if;
  unit_price:=private.product_price_minor(product,p_config); amount:=amount+unit_price*qty; count_units:=count_units+qty;
  item_energy:=(product->>'kcal')::numeric*(product->>'size')::numeric/100*qty; energy:=energy+item_energy;
  if product->>'nova'='4' then upf_energy:=upf_energy+item_energy; end if;
  if product->>'nova' is null then unknown_energy:=unknown_energy+item_energy; end if;
  items:=items||jsonb_build_array(jsonb_build_object('product_id',product->>'id','quantity',qty,
   'base_price_pkr',(product->>'price')::numeric,'unit_price_pkr',unit_price/100.0,'line_total_pkr',unit_price*qty/100.0,
   'size',(product->>'size')::numeric,'unit',product->>'unit','nova',product->'nova','energy_kcal',item_energy,
   'fat_g',(product->>'fat')::numeric*(product->>'size')::numeric/100*qty,
   'sugars_g',(product->>'sugar')::numeric*(product->>'size')::numeric/100*qty,
   'salt_g',(product->>'salt')::numeric*(product->>'size')::numeric/100*qty));
 end loop;
 if amount>(p_config->>'budget')::bigint*100 then raise exception 'budget_exceeded'; end if;
 return jsonb_build_object('amountMinor',amount,'energy',energy,'upfEnergy',upf_energy,'unknownEnergy',unknown_energy,
 'upfShare',case when energy>0 and unknown_energy=0 then upf_energy/energy else null end,'count',count_units,'items',items);
end; $$;

-- Logs have an explicit field whitelist: no free text, contact, DOB or body measures.
create function private.append_study_events(p_task uuid,p_events jsonb,p_catalog jsonb) returns integer
language plpgsql set search_path='' as $$
declare e jsonb; d jsonb; inserted integer:=0; n integer; typ text;
begin
 if p_events is null or jsonb_typeof(p_events)<>'array' or jsonb_array_length(p_events)>50 then raise exception 'invalid_events'; end if;
 if (select count(*) from private.study_events where task_id=p_task)+jsonb_array_length(p_events)>10000 then return 0; end if;
 for e in select value from jsonb_array_elements(p_events) loop
  typ:=e->>'type';
  if typ is null or typ not in ('page_loaded','quantity_changed','quantity_rejected','basket_cleared','product_detail_opened','product_visible',
   'shelf_panned','rack_view_changed','camera_navigation_changed','category_changed','language_changed','checkout_opened','label_help_opened','page_hidden') then continue; end if;
  if coalesce(e->>'id','') !~ '^[0-9a-f-]{36}$' then continue; end if;
  d:='{}';
  if exists(select 1 from jsonb_array_elements(p_catalog) p where p->>'id'=e->>'productId') then d:=d||jsonb_build_object('product_id',e->>'productId'); end if;
  if jsonb_typeof(e->'quantity')='number' and (e->>'quantity') ~ '^([0-9]|[1-9][0-9])$' then d:=d||jsonb_build_object('quantity',e->'quantity'); end if;
  if e->>'delta' in ('-1','1') then d:=d||jsonb_build_object('delta',(e->>'delta')::integer); end if;
  if jsonb_typeof(e->'fraction')='number' and (e->>'fraction')::numeric between 0 and 1 then d:=d||jsonb_build_object('fraction',e->'fraction'); end if;
  if e->>'rackView' in ('overview','close') then d:=d||jsonb_build_object('rack_view',e->>'rackView'); end if;
  if e->>'view' in ('overview','close') then d:=d||jsonb_build_object('rack_view',e->>'view'); end if;
  if e->>'mode' in ('drag','follow') then d:=d||jsonb_build_object('navigation',e->>'mode'); end if;
  if e->>'language' in ('zh','en','ur') then d:=d||jsonb_build_object('language',e->>'language'); end if;
  if e->>'category' in ('all','drinks','snacks','fresh','meals') then d:=d||jsonb_build_object('category',e->>'category'); end if;
  if (e->>'tier') ~ '^[0-3]$' then d:=d||jsonb_build_object('tier',(e->>'tier')::integer); end if;
  if (e->>'column') ~ '^[0-9]{1,2}$' then d:=d||jsonb_build_object('column',(e->>'column')::integer); end if;
  if coalesce(e->'viewport'->>'width','') ~ '^[0-9]{2,5}$' and coalesce(e->'viewport'->>'height','') ~ '^[0-9]{2,5}$' then
   d:=d||jsonb_build_object('viewport_width',(e->'viewport'->>'width')::integer,'viewport_height',(e->'viewport'->>'height')::integer);
  end if;
  insert into private.study_events(id,task_id,event_type,client_time,details)
  values((e->>'id')::uuid,p_task,typ,case when e->>'time' ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$' then (e->>'time')::timestamptz else null end,d)
  on conflict(id) do nothing; get diagnostics n=row_count; inserted:=inserted+n;
 end loop;
 return inserted;
end; $$;

create function public.save_study_task(p_task_id uuid,p_revision integer,p_request_id uuid,p_basket jsonb,p_language text,p_events jsonb,p_complete boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare t private.study_tasks; a private.allocations; s private.studies; r jsonb;
begin
 select t0.* into t from private.study_tasks t0 join private.allocations a0 on a0.id=t0.allocation_id
 join public.participant_profiles p on p.participant_id=a0.participant_id where t0.id=p_task_id and p.user_id=auth.uid() for update of t0;
 if not found then raise exception 'task_unavailable'; end if;
 -- An identical request after a lost response is safe; never overwrites newer work.
 if p_request_id is not null and t.last_request_id=p_request_id then return private.study_task_json(t.id); end if;
 if t.completed_at is not null then
  if p_complete and t.basket=p_basket then return private.study_task_json(t.id); end if;
  raise exception 'task_completed';
 end if;
 if p_request_id is null or p_revision is null or p_revision<>t.revision then raise exception 'task_conflict'; end if;
 if p_complete is null or p_language is null or p_language not in ('zh','en','ur') then raise exception 'invalid_task_metadata'; end if;
 select * into strict a from private.allocations where id=t.allocation_id;
 select * into strict s from private.studies where id=a.study_id;
 if not s.tasks_open then raise exception 'study_closed'; end if;
 r:=private.study_basket_result(p_basket,a.config,s.catalog_snapshot);
 perform private.append_study_events(t.id,p_events,s.catalog_snapshot);
 update private.study_tasks set basket=p_basket,revision=revision+1,language=p_language,saved_at=clock_timestamp(),last_request_id=p_request_id,
 completed_at=case when p_complete then clock_timestamp() else null end,
 result=case when p_complete then r||jsonb_build_object('config',a.config,'assignment','server-randomized-factorial',
 'catalogVersion',s.catalog_version,'rulesVersion',s.rules_version,'layoutVersion',s.layout_version,'syntheticProducts',s.synthetic) else null end where id=t.id;
 return private.study_task_json(t.id);
end; $$;

create function private.require_study_admin(p_export boolean default false) returns void
language plpgsql stable set search_path='' as $$
begin
 if not exists(select 1 from private.study_admins where user_id=auth.uid() and (not p_export or can_export)) then raise exception 'admin_required'; end if;
end; $$;

-- No DOB, contact, auth-user UUID or randomization sequence in this analysis view.
create view private.study_analysis as
select a.id::text as row_id,a.study_id,a.participant_id,t.id as task_id,lpad(a.condition::bit(3)::text,3,'0') as condition_code,
 (a.condition&4)/4 as price_factor,(a.condition&2)/2 as position_factor,a.condition&1 as label_factor,
 (a.config->>'markupPercent')::integer as markup_percent,a.config->>'layoutMode' as layout_mode,a.config->>'placementRule' as placement_rule,
 (a.config->>'budget')::integer as budget_pkr,a.assigned_at,t.started_at,t.saved_at,t.completed_at,
 p.age_at_registration,p.gender,p.university,p.height_cm,p.weight_kg,p.waist_cm,p.anthropometry_entered_at,p.questionnaire_code,
 case when p.questionnaire_code is null then 'not_provided' else 'pending_review' end as questionnaire_link_status,
 p.consent_version,p.consented_at,s.protocol_version,s.catalog_version,s.rules_version,s.layout_version,s.synthetic,
 t.language,case when t.completed_at is null then 'in_progress' else 'completed' end as status,
 (t.result->>'amountMinor')::numeric/100 as amount_pkr,(t.result->>'energy')::numeric as energy_kcal,
 (t.result->>'upfEnergy')::numeric as upf_energy_kcal,(t.result->>'unknownEnergy')::numeric as unknown_energy_kcal,
 (t.result->>'upfShare')::numeric as upf_energy_share,(t.result->>'count')::integer as quantity
from private.allocations a join private.study_tasks t on t.allocation_id=a.id
join public.participant_profiles p on p.participant_id=a.participant_id join private.studies s on s.id=a.study_id;

create function private.validate_study_filters(p jsonb) returns void language plpgsql immutable set search_path='' as $$
begin
 if p is null or jsonb_typeof(p)<>'object' then raise exception 'invalid_filters'; end if;
 if exists(select 1 from jsonb_object_keys(p) k where k not in ('condition','status','university','from','to'))
 or coalesce(p->>'condition','') !~ '^([01]{3})?$' or coalesce(p->>'status','') not in ('','in_progress','completed')
 or char_length(coalesce(p->>'university',''))>160
 or coalesce(p->>'from','') !~ '^(\d{4}-\d{2}-\d{2})?$' or coalesce(p->>'to','') !~ '^(\d{4}-\d{2}-\d{2})?$'
 then raise exception 'invalid_filters'; end if;
 if nullif(p->>'from','')::date>nullif(p->>'to','')::date then raise exception 'invalid_filters'; end if;
end; $$;

create function public.admin_study_overview(p_study_id text,p_filters jsonb default '{}',p_after text default '',p_limit integer default 50)
returns jsonb language plpgsql security definer set search_path='' as $$
declare rows_json jsonb; groups_json jsonb; n bigint; s private.studies;
begin
 perform private.require_study_admin();
 perform private.validate_study_filters(p_filters);
 if p_limit is null or p_limit not between 1 and 100 or p_filters is null or jsonb_typeof(p_filters)<>'object' then raise exception 'invalid_page'; end if;
 select * into s from private.studies where id=p_study_id; if not found then raise exception 'study_unavailable'; end if;
 select jsonb_agg(jsonb_build_object('condition_code',lpad(g::bit(3)::text,3,'0'),'allocated',coalesce(a.n,0),'completed',coalesce(a.c,0)) order by g)
 into groups_json from generate_series(0,7) g left join
 (select condition,count(*) n,count(t.completed_at) c from private.allocations a join private.study_tasks t on t.allocation_id=a.id where study_id=p_study_id group by condition) a on a.condition=g;
 select count(*) into n from private.study_analysis r where r.study_id=p_study_id
 and (coalesce(p_filters->>'condition','')='' or r.condition_code=p_filters->>'condition')
 and (coalesce(p_filters->>'status','')='' or r.status=p_filters->>'status')
 and (coalesce(p_filters->>'university','')='' or position(lower(p_filters->>'university') in lower(r.university))>0)
 and (nullif(p_filters->>'from','') is null or (r.assigned_at at time zone 'UTC')::date>=nullif(p_filters->>'from','')::date)
 and (nullif(p_filters->>'to','') is null or (r.assigned_at at time zone 'UTC')::date<=nullif(p_filters->>'to','')::date);
 select coalesce(jsonb_agg(x.row order by x.row_id),'[]') into rows_json from (
 select r.row_id,to_jsonb(r) as row from private.study_analysis r where r.study_id=p_study_id and r.row_id>coalesce(p_after,'')
 and (coalesce(p_filters->>'condition','')='' or r.condition_code=p_filters->>'condition')
 and (coalesce(p_filters->>'status','')='' or r.status=p_filters->>'status')
 and (coalesce(p_filters->>'university','')='' or position(lower(p_filters->>'university') in lower(r.university))>0)
 and (nullif(p_filters->>'from','') is null or (r.assigned_at at time zone 'UTC')::date>=nullif(p_filters->>'from','')::date)
 and (nullif(p_filters->>'to','') is null or (r.assigned_at at time zone 'UTC')::date<=nullif(p_filters->>'to','')::date)
 order by r.row_id limit p_limit) x;
 return jsonb_build_object('study_id',s.id,'protocol_version',s.protocol_version,'catalog_version',s.catalog_version,'rules_version',s.rules_version,'layout_version',s.layout_version,'base_config',s.base_config,'randomization','concealed permuted blocks of 16; 1:1:1:1:1:1:1:1','synthetic',s.synthetic,'enrollment_open',s.enrollment_open,
 'tasks_open',s.tasks_open,'can_export',(select can_export from private.study_admins where user_id=auth.uid()),'groups',groups_json,'rows',rows_json,'total',n);
end; $$;

create function public.admin_study_task_detail(p_task_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare output jsonb;
begin
 perform private.require_study_admin();
 select jsonb_build_object('participant',to_jsonb(r),'config',a.config,'items',coalesce(t.result->'items','[]'),
 'products',s.catalog_snapshot) into output from private.study_analysis r
 join private.study_tasks t on t.id=r.task_id join private.allocations a on a.id=t.allocation_id
 join private.studies s on s.id=r.study_id where r.task_id=p_task_id;
 if output is null then raise exception 'task_unavailable'; end if;
 return output;
end; $$;

create function public.admin_start_export(p_study_id text,p_dataset text,p_filters jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare e private.export_sessions;
begin
 perform private.require_study_admin(true);
 perform private.validate_study_filters(p_filters);
 if p_dataset is null or p_dataset not in ('participants','purchases','events','catalog') or p_filters is null or jsonb_typeof(p_filters)<>'object' then raise exception 'invalid_export'; end if;
 insert into private.export_sessions(user_id,study_id,dataset,filters) values(auth.uid(),p_study_id,p_dataset,p_filters) returning * into e;
 return jsonb_build_object('export_id',e.id,'cutoff',e.cutoff,'dataset',e.dataset,'study_id',e.study_id);
end; $$;

create function public.admin_export_page(p_export_id uuid,p_after text default '',p_limit integer default 200) returns jsonb
language plpgsql security definer set search_path='' as $$
declare e private.export_sessions; output jsonb; next_key text;
begin
 perform private.require_study_admin(true);
 select * into e from private.export_sessions where id=p_export_id and user_id=auth.uid() and cutoff>now()-interval '1 hour';
 if not found or p_limit is null or p_limit not between 1 and 500 then raise exception 'invalid_export'; end if;
 with eligible as (
  select r.* from private.study_analysis r where r.study_id=e.study_id and r.assigned_at<=e.cutoff
  and (coalesce(e.filters->>'condition','')='' or r.condition_code=e.filters->>'condition')
  and (coalesce(e.filters->>'university','')='' or position(lower(e.filters->>'university') in lower(r.university))>0)
  and (nullif(e.filters->>'from','') is null or (r.assigned_at at time zone 'UTC')::date>=nullif(e.filters->>'from','')::date)
  and (nullif(e.filters->>'to','') is null or (r.assigned_at at time zone 'UTC')::date<=nullif(e.filters->>'to','')::date)
  and (coalesce(e.filters->>'status','')='' or (case when r.completed_at<=e.cutoff then 'completed' else 'in_progress' end)=e.filters->>'status')
 ), data as (
  select r.row_id as key,to_jsonb(r)||jsonb_build_object('status',case when r.completed_at<=e.cutoff then 'completed' else 'in_progress' end,
   'completed_at',case when r.completed_at<=e.cutoff then r.completed_at end,
   'saved_at',case when r.saved_at<=e.cutoff then r.saved_at end,
   'amount_pkr',case when r.completed_at<=e.cutoff then r.amount_pkr end,'energy_kcal',case when r.completed_at<=e.cutoff then r.energy_kcal end,
   'upf_energy_kcal',case when r.completed_at<=e.cutoff then r.upf_energy_kcal end,'unknown_energy_kcal',case when r.completed_at<=e.cutoff then r.unknown_energy_kcal end,
   'upf_energy_share',case when r.completed_at<=e.cutoff then r.upf_energy_share end,'quantity',case when r.completed_at<=e.cutoff then r.quantity end) as row
  from eligible r where e.dataset='participants'
  union all
  select r.task_id::text||':'||(item->>'product_id'),item||jsonb_build_object('study_id',r.study_id,'participant_id',r.participant_id,'task_id',r.task_id,
   'condition_code',r.condition_code,'price_factor',r.price_factor,'position_factor',r.position_factor,'label_factor',r.label_factor,'catalog_version',r.catalog_version,'completed_at',r.completed_at)
  from eligible r join private.study_tasks t on t.id=r.task_id cross join lateral jsonb_array_elements(t.result->'items') item
  where e.dataset='purchases' and r.completed_at<=e.cutoff
  union all
  select v.id::text,to_jsonb(v)||jsonb_build_object('study_id',r.study_id,'participant_id',r.participant_id,'condition_code',r.condition_code)
  from eligible r join private.study_events v on v.task_id=r.task_id where e.dataset='events' and v.received_at<=e.cutoff
  union all
  select p->>'id',p||jsonb_build_object('study_id',s.id,'catalog_version',s.catalog_version,'rules_version',s.rules_version,'layout_version',s.layout_version,'protocol_version',s.protocol_version)
  from private.studies s cross join lateral jsonb_array_elements(s.catalog_snapshot) p where e.dataset='catalog' and s.id=e.study_id
 ), page as (select * from data where key>coalesce(p_after,'') order by key limit p_limit)
 select coalesce(jsonb_agg(row order by key),'[]'),max(key) into output,next_key from page;
 return jsonb_build_object('rows',output,'next',next_key,'cutoff',e.cutoff);
end; $$;

-- Explicit grants: no direct table access and no browser-supplied admin role.
revoke all on all tables in schema private from public,anon,authenticated;
revoke all on all functions in schema private from public,anon,authenticated;
revoke all on function public.get_or_start_study_task(text) from public,anon;
revoke all on function public.save_study_task(uuid,integer,uuid,jsonb,text,jsonb,boolean) from public,anon;
revoke all on function public.admin_study_overview(text,jsonb,text,integer) from public,anon;
revoke all on function public.admin_study_task_detail(uuid) from public,anon;
revoke all on function public.admin_start_export(text,text,jsonb) from public,anon;
revoke all on function public.admin_export_page(uuid,text,integer) from public,anon;
grant execute on function public.get_or_start_study_task(text),public.save_study_task(uuid,integer,uuid,jsonb,text,jsonb,boolean),
 public.admin_study_overview(text,jsonb,text,integer),public.admin_study_task_detail(uuid),public.admin_start_export(text,text,jsonb),public.admin_export_page(uuid,text,integer) to authenticated;
commit;
