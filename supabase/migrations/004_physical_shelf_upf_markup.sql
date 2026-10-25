-- New registrations use the physical rack protocol; historical profiles retain their original config.
begin;
update private.pilot_settings set config='{"schemaVersion":2,"budget":600,"price":false,"position":true,"labels":true,"upf":true,"markupPercent":25,"layoutMode":"alternatives-eye","placementRule":"upf-or-high"}'::jsonb where id=true;

create function private.product_price_minor(p jsonb,c jsonb) returns bigint
language plpgsql immutable set search_path='' as $$
declare multiplier numeric:=1; rate numeric;
begin
 if c->>'schemaVersion'='2' then
  rate:=(c->>'markupPercent')::numeric;
  if rate is null or rate not in (20,25,30) then raise exception 'invalid_price_protocol'; end if;
  if (c->>'price')::boolean and (p->>'nova')::int=4 then multiplier:=1+rate/100; end if;
 else
  -- Never reinterpret a legacy discount task as a new markup task.
  if (c->>'price')::boolean and (p->>'eligible')::boolean then multiplier:=1-(c->>'discountPercent')::numeric/100; end if;
 end if;
 return round((p->>'price')::numeric*100*multiplier);
end;
$$;
revoke all on function private.product_price_minor(jsonb,jsonb) from public,anon,authenticated;

create or replace function public.submit_pilot_task(p_session_id uuid,p_basket jsonb,p_language text,p_catalog_version text)
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
  price_minor:=private.product_price_minor(product,p.pilot_config);
  amount_minor:=amount_minor+price_minor*qty;
  item_energy:=(product->>'kcal')::numeric*(product->>'size')::numeric/100*qty;
  energy:=energy+item_energy;
  if (product->>'nova')::int=4 then upf_energy:=upf_energy+item_energy; end if;
  if product->>'nova' is null then unknown_energy:=unknown_energy+item_energy; end if;
 end loop;
 if amount_minor>(p.pilot_config->>'budget')::bigint*100 then raise exception 'budget_exceeded'; end if;
 result:=jsonb_build_object('amountMinor',amount_minor,'energy',energy,'upfEnergy',upf_energy,'unknownEnergy',unknown_energy,
  'upfShare',case when energy>0 and unknown_energy=0 then upf_energy/energy else null end,'config',p.pilot_config,'syntheticProducts',true,'assignment','fixed-pilot-not-randomized','layoutVersion',case when p.pilot_config->>'schemaVersion'='2' then 'physical-rack-v1' else 'legacy' end,'facingsPerSku',case when p.pilot_config->>'schemaVersion'='2' then 2 else null end);
 insert into private.pilot_tasks(session_id,participant_id,basket,language,catalog_version,result)
 values(p_session_id,p.participant_id,p_basket,p_language,p_catalog_version,result) returning submitted_at into submitted;
 return jsonb_build_object('session_id',p_session_id,'submitted_at',submitted,'result',result);
end;
$$;
-- Add display metadata without changing historical prices, nutrients or NOVA.
update private.catalog set product=product||'{"catalogOrder":0,"popularityRank":17,"popularitySource":"synthetic-demonstration"}'::jsonb where id='water' and version='synthetic-pakistan-catalog-v2';
update private.catalog set product=product||'{"catalogOrder":1,"popularityRank":2,"popularitySource":"synthetic-demonstration"}'::jsonb where id='cola' and version='synthetic-pakistan-catalog-v2';
update private.catalog set product=product||'{"catalogOrder":2,"popularityRank":18,"popularitySource":"synthetic-demonstration"}'::jsonb where id='banana' and version='synthetic-pakistan-catalog-v2';
update private.catalog set product=product||'{"catalogOrder":3,"popularityRank":1,"popularitySource":"synthetic-demonstration"}'::jsonb where id='chips' and version='synthetic-pakistan-catalog-v2';
update private.catalog set product=product||'{"catalogOrder":4,"popularityRank":13,"popularitySource":"synthetic-demonstration"}'::jsonb where id='milk' and version='synthetic-pakistan-catalog-v2';
update private.catalog set product=product||'{"catalogOrder":5,"popularityRank":3,"popularitySource":"synthetic-demonstration"}'::jsonb where id='biscuits' and version='synthetic-pakistan-catalog-v2';
update private.catalog set product=product||'{"catalogOrder":6,"popularityRank":22,"popularitySource":"synthetic-demonstration"}'::jsonb where id='apple' and version='synthetic-pakistan-catalog-v2';
update private.catalog set product=product||'{"catalogOrder":7,"popularityRank":19,"popularitySource":"synthetic-demonstration"}'::jsonb where id='yogurt' and version='synthetic-pakistan-catalog-v2';
update private.catalog set product=product||'{"catalogOrder":8,"popularityRank":16,"popularitySource":"synthetic-demonstration"}'::jsonb where id='nuts' and version='synthetic-pakistan-catalog-v2';
update private.catalog set product=product||'{"catalogOrder":9,"popularityRank":5,"popularitySource":"synthetic-demonstration"}'::jsonb where id='noodles' and version='synthetic-pakistan-catalog-v2';
update private.catalog set product=product||'{"catalogOrder":10,"popularityRank":14,"popularitySource":"synthetic-demonstration"}'::jsonb where id='lassi' and version='synthetic-pakistan-catalog-v2';
update private.catalog set product=product||'{"catalogOrder":11,"popularityRank":21,"popularitySource":"synthetic-demonstration"}'::jsonb where id='dates' and version='synthetic-pakistan-catalog-v2';
update private.catalog set product=product||'{"catalogOrder":12,"popularityRank":8,"popularitySource":"synthetic-demonstration"}'::jsonb where id='juice' and version='synthetic-pakistan-catalog-v2';
update private.catalog set product=product||'{"catalogOrder":13,"popularityRank":24,"popularitySource":"synthetic-demonstration"}'::jsonb where id='cheese' and version='synthetic-pakistan-catalog-v2';
update private.catalog set product=product||'{"catalogOrder":14,"popularityRank":11,"popularitySource":"synthetic-demonstration"}'::jsonb where id='sandwich' and version='synthetic-pakistan-catalog-v2';
update private.catalog set product=product||'{"catalogOrder":15,"popularityRank":4,"popularitySource":"synthetic-demonstration"}'::jsonb where id='sooper' and version='synthetic-pakistan-catalog-v2';
update private.catalog set product=product||'{"catalogOrder":16,"popularityRank":6,"popularitySource":"synthetic-demonstration"}'::jsonb where id='cocomo' and version='synthetic-pakistan-catalog-v2';
update private.catalog set product=product||'{"catalogOrder":17,"popularityRank":7,"popularitySource":"synthetic-demonstration"}'::jsonb where id='slanty' and version='synthetic-pakistan-catalog-v2';
update private.catalog set product=product||'{"catalogOrder":18,"popularityRank":12,"popularitySource":"synthetic-demonstration"}'::jsonb where id='nimko' and version='synthetic-pakistan-catalog-v2';
update private.catalog set product=product||'{"catalogOrder":19,"popularityRank":23,"popularitySource":"synthetic-demonstration"}'::jsonb where id='chana' and version='synthetic-pakistan-catalog-v2';
update private.catalog set product=product||'{"catalogOrder":20,"popularityRank":10,"popularitySource":"synthetic-demonstration"}'::jsonb where id='samosa' and version='synthetic-pakistan-catalog-v2';
update private.catalog set product=product||'{"catalogOrder":21,"popularityRank":20,"popularitySource":"synthetic-demonstration"}'::jsonb where id='chaat' and version='synthetic-pakistan-catalog-v2';
update private.catalog set product=product||'{"catalogOrder":22,"popularityRank":9,"popularitySource":"synthetic-demonstration"}'::jsonb where id='chilimili' and version='synthetic-pakistan-catalog-v2';
update private.catalog set product=product||'{"catalogOrder":23,"popularityRank":15,"popularitySource":"synthetic-demonstration"}'::jsonb where id='rusk' and version='synthetic-pakistan-catalog-v2';
commit;
