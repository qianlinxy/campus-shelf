const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {PGlite}=require('@electric-sql/pglite');
const historicalProducts=require('./fixtures/catalog-v3.json');

test('PostgreSQL migrations enforce consent, own-row access and server-side basket validation',async t=>{
 const db=new PGlite();
 try{
  await db.exec(`create role anon; create role authenticated; create schema auth;
   create table auth.users(id uuid primary key,email_confirmed_at timestamptz,phone_confirmed_at timestamptz);
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   grant usage on schema auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;`);
  for(const name of ['001_enrollment.sql','002_synthetic_catalog.sql','003_anthropometry_and_questionnaire.sql','004_physical_shelf_upf_markup.sql','005_fifty_product_catalog.sql'])await db.exec(fs.readFileSync(path.join(__dirname,'../supabase/migrations',name),'utf8'));
  const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222',task='33333333-3333-4333-8333-333333333333';
  const login=async(id,role='authenticated')=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role '+role);};
  const owner=()=>db.exec('reset role');
  const register=(code=null)=>db.query("select public.register_participant((current_date-interval '22 years')::date,'prefer_not_to_say','Synthetic University','pilot-v1',171.2,65.4,78.5,$1::text) as p",[code]);
  const submit=(basket,id=task,language='ur',version='synthetic-pakistan-catalog-v3')=>db.query('select public.submit_pilot_task($1,$2::jsonb,$3,$4) as r',[id,JSON.stringify(basket),language,version]);
  await db.query('insert into auth.users(id) values($1),($2)',[a,b]);
  await login(a);
  await t.test('unverified contacts cannot create profiles',async()=>assert.rejects(register(),/verified_contact_required/));
  await owner();await db.exec('update auth.users set email_confirmed_at=now()');await login(a);
  await t.test('enrollment is closed by default',async()=>assert.rejects(register(),/enrollment_closed/));
  await owner();await db.exec("update private.pilot_settings set enrollment_open=true,consent_version='pilot-v1'");await login(a);
  await t.test('consent version and age are validated on the server',async()=>{
   await assert.rejects(db.query("select public.register_participant(current_date,'female','Synthetic University','pilot-v1',171.2,65.4,78.5,null)"),/ineligible_age/);
   await assert.rejects(db.query("select public.register_participant((current_date-interval '22 years')::date,'female','Synthetic University','wrong',171.2,65.4,78.5,null)"),/enrollment_closed/);
  });
  let profileA;
  await t.test('valid profile stores full DOB with pseudonymous ID and no contact/name',async()=>{
   profileA=(await register('SYNTHETIC-001')).rows[0].p;assert.equal(profileA.height_cm,171.2);assert.equal(profileA.weight_kg,65.4);assert.equal(profileA.waist_cm,78.5);assert.equal(profileA.questionnaire_code,'SYNTHETIC-001');assert.equal(profileA.questionnaire_link_status,'pending_review');assert.ok(profileA.anthropometry_entered_at);assert.ok(profileA.participant_id);assert.match(profileA.dob,/^\d{4}-\d{2}-\d{2}$/);assert.equal(profileA.pilot_config.budget,600);
   assert.equal((await register()).rows[0].p.participant_id,profileA.participant_id);
   const columns=(await db.query("select column_name from information_schema.columns where table_name='participant_profiles'")).rows.map(r=>r.column_name);
   assert.ok(!columns.some(c=>['name','email','phone'].includes(c)));
  });
  let first;
  const basket=[{id:'water',quantity:1},{id:'cola',quantity:1}];
  await t.test('server computes totals from its catalog and permits idempotent retry',async()=>{
   first=(await submit(basket)).rows[0].r;assert.equal(first.result.amountMinor,16000);assert.equal(first.result.energy,138.6);
   assert.equal(first.result.assignment,'fixed-pilot-not-randomized');assert.deepEqual((await submit(basket)).rows[0].r,first);
   await assert.rejects(submit([{id:'water',quantity:2}]),/session_conflict/);
  });
  let counter=40;const unique=()=>`00000000-0000-4000-8000-${String(counter++).padStart(12,'0')}`;
  await t.test('versioned catalogs retain the old 24 rows and expose 50 foods to new registrations',async()=>{
   assert.equal(profileA.catalog_version,'synthetic-pakistan-catalog-v3');
   await owner();const counts=(await db.query('select version,count(*)::int as n from private.catalog group by version order by version')).rows;
   assert.deepEqual(counts,[{version:'synthetic-pakistan-catalog-v2',n:24},{version:'synthetic-pakistan-catalog-v3',n:50}]);
   const data=(await db.query("select product from private.catalog where version='synthetic-pakistan-catalog-v3' order by (product->>'catalogOrder')::int")).rows.map(r=>r.product);assert.deepEqual(data,historicalProducts);
   const versions=(await db.query("select version,product->>'price' as price from private.catalog where id='water' order by version")).rows;assert.equal(versions.length,2);assert.ok(versions.every(v=>v.price==='60'));
   await login(a);const r=(await submit([{id:'orangefizz',quantity:1},{id:'orange',quantity:1}],unique())).rows[0].r;assert.equal(r.result.amountMinor,19000);assert.equal(r.result.layoutVersion,'physical-rack-v2');
  });
  await t.test('rejects overspending, arbitrary prices, duplicates and invalid quantities',async()=>{
   for(const [basket,error]of [ [[{id:'water',quantity:11}],'budget_exceeded'],[[{id:'water',quantity:-1}],'invalid_item'],[[{id:'water',quantity:1.5}],'invalid_item'],[[{id:'water',quantity:'1'}],'invalid_item'],[[{id:'water',quantity:1,price:0}],'invalid_item'],[[{id:'water',quantity:1},{id:'water',quantity:1}],'duplicate_item'],[[{id:'invented',quantity:1}],'unknown_product'] ])await assert.rejects(submit(basket,unique()),new RegExp(error));
   await assert.rejects(submit([],unique(),'xx'),/invalid_task_metadata/);await assert.rejects(submit([],unique(),'en','other-version'),/invalid_task_metadata/);
  });
  await t.test('completed empty basket is recorded separately with undefined energy share',async()=>{
   const r=(await submit([],unique())).rows[0].r;assert.equal(r.result.amountMinor,0);assert.equal(r.result.upfShare,null);
  });
  await t.test('unknown processing prevents a misleading UPF share',async()=>{
   const r=(await submit([{id:'sandwich',quantity:1}],unique())).rows[0].r;assert.equal(r.result.unknownEnergy,270);assert.equal(r.result.upfShare,null);
  });
  await login(b);
  await t.test('questionnaire IDs cannot be claimed by two participants',async()=>assert.rejects(register('SYNTHETIC-001'),/questionnaire_code_unavailable/));
  await t.test('body measurement validation is enforced at the database API',async()=>{
   const base="select public.register_participant((current_date-interval '22 years')::date,'female','Synthetic University','pilot-v1',$1::numeric,$2::numeric,$3::numeric,null)";
   for(const [values,error]of [[[null,65.4,78.5],'invalid_height'],[[1.71,65.4,78.5],'invalid_height'],[[171.2,401,78.5],'invalid_weight'],[[171.2,65.4,78.55],'invalid_waist']])await assert.rejects(db.query(base,values),new RegExp(error));
   await assert.rejects(db.exec("select public.register_participant((current_date-interval '22 years')::date,'female','Synthetic University','pilot-v1')"),/permission denied/);
  });
  let profileB=(await register()).rows[0].p;assert.equal(profileB.questionnaire_code,null);assert.equal(profileB.questionnaire_link_status,'not_provided');
  await t.test('RLS restricts reads to the current participant',async()=>{
   assert.notEqual(profileB.participant_id,profileA.participant_id);const rows=(await db.query('select participant_id from public.participant_profiles')).rows;
   assert.deepEqual(rows,[{participant_id:profileB.participant_id}]);
   await assert.rejects(submit(basket),/session_conflict/);
  });
  await t.test('participants cannot overwrite profiles, open enrollment or read task tables',async()=>{
   await assert.rejects(db.exec("update public.participant_profiles set gender='male'"),/permission denied/);
   await assert.rejects(db.exec('select * from private.pilot_tasks'),/permission denied/);
   await assert.rejects(db.exec('update private.pilot_settings set enrollment_open=true'),/permission denied/);
  });
  await t.test('new server pricing matches NOVA4-only 20/25/30 markup and labels do not affect totals',async()=>{
   for(const rate of [20,25,30])for(const labels of [true,false]){
    await owner();await db.query("update public.participant_profiles set pilot_config=pilot_config||jsonb_build_object('price',true,'markupPercent',$1::int,'labels',$2::boolean,'upf',$2::boolean) where user_id=$3",[rate,labels,b]);await login(b);
    const r=(await submit([{id:'cola',quantity:1},{id:'water',quantity:1},{id:'nuts',quantity:1}],unique())).rows[0].r;
    assert.equal(r.result.amountMinor,34000+rate*100);assert.equal(r.result.layoutVersion,'physical-rack-v2');assert.equal(r.result.facingsPerSku,2);
   }
   await assert.rejects(submit([{id:'cola',quantity:5}],unique()),/budget_exceeded/);
  });
  await login('','anon');
  await t.test('unauthenticated clients cannot read demographics or invoke registration',async()=>{
   await assert.rejects(db.exec('select * from public.participant_profiles'),/permission denied/);
   await assert.rejects(register(),/permission denied/);await assert.rejects(db.exec('select public.get_my_profile()'),/permission denied/);
  });
  await owner();await db.exec('update private.pilot_settings set enrollment_open=false');await login(a);
  await t.test('closing enrollment prevents new submissions while preserving an earlier retry',async()=>{
   await assert.rejects(submit([],unique()),/enrollment_closed/);assert.deepEqual((await submit(basket)).rows[0].r,first);
  });
 }finally{await db.close();}
});

test('v0.2 upgrade preserves old identities and tasks and requires missing measurements once',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`create role anon;create role authenticated;create schema auth;
   create table auth.users(id uuid primary key,email_confirmed_at timestamptz,phone_confirmed_at timestamptz);
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;`);
  for(const file of ['001_enrollment.sql','002_synthetic_catalog.sql'])await db.exec(fs.readFileSync(path.join(__dirname,'../supabase/migrations',file),'utf8'));
  const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',oldTask='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',newTask='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  await db.query('insert into auth.users(id,email_confirmed_at) values($1,now())',[id]);
  await db.exec("update private.pilot_settings set enrollment_open=true,consent_version='original-v1'");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role authenticated');
  const old=(await db.query("select public.register_participant((current_date-interval '22 years')::date,'female','Synthetic University','original-v1') as p")).rows[0].p;
  await db.query("select public.submit_pilot_task($1,'[]','en','synthetic-pakistan-catalog-v2')",[oldTask]);
  await db.exec('reset role');await db.exec(fs.readFileSync(path.join(__dirname,'../supabase/migrations/003_anthropometry_and_questionnaire.sql'),'utf8'));
  await db.exec("update private.pilot_settings set consent_version='body-link-v2'");await db.exec('set role authenticated');
  const missing=(await db.query('select public.get_my_profile() as p')).rows[0].p;
  assert.equal(missing.participant_id,old.participant_id);assert.equal(missing.height_cm,null);
  await assert.rejects(db.query("select public.submit_pilot_task($1,'[]','en','synthetic-pakistan-catalog-v2')",[newTask]),/profile_incomplete/);
  const sql="select public.register_participant((current_date-interval '22 years')::date,'female','Synthetic University',$1,171.2,65.4,78.5,null) as p";
  await assert.rejects(db.query(sql,['original-v1']),/enrollment_closed/);
  const complete=(await db.query(sql,['body-link-v2'])).rows[0].p;
  assert.equal(complete.participant_id,old.participant_id);assert.equal(complete.dob,old.dob);assert.deepEqual(complete.pilot_config,old.pilot_config);assert.equal(complete.height_cm,171.2);
  await db.query("select public.submit_pilot_task($1,'[]','ur','synthetic-pakistan-catalog-v2')",[newTask]);
  const replay=(await db.query("select public.submit_pilot_task($1,'[]','en','synthetic-pakistan-catalog-v2') as p",[oldTask])).rows[0].p;
  assert.equal(replay.session_id,oldTask);
  const again=(await db.query("select public.register_participant((current_date-interval '22 years')::date,'female','Synthetic University','body-link-v2',180,70,85,'different-code') as p")).rows[0].p;
  assert.equal(again.height_cm,171.2);assert.equal(again.questionnaire_code,null);
  await db.exec('reset role');const counts=(await db.query('select count(*)::int as n from private.pilot_tasks')).rows[0].n;assert.equal(counts,2);
  await db.exec(fs.readFileSync(path.join(__dirname,'../supabase/migrations/004_physical_shelf_upf_markup.sql'),'utf8'));
  const preserved=(await db.query('select public.get_my_profile() as p')).rows[0].p;assert.equal(preserved.pilot_config.schemaVersion,undefined);assert.equal(preserved.participant_id,old.participant_id);
  await db.exec("update public.participant_profiles set pilot_config=pilot_config||'{\"price\":true}'::jsonb");await db.exec('set role authenticated');
  const legacyPrice=(await db.query("select public.submit_pilot_task('dddddddd-dddd-4ddd-8ddd-dddddddddddd','[{\"id\":\"water\",\"quantity\":1},{\"id\":\"cola\",\"quantity\":1}]','en','synthetic-pakistan-catalog-v2') as p")).rows[0].p;
  assert.equal(legacyPrice.result.amountMinor,14800);assert.equal(legacyPrice.result.layoutVersion,'legacy');
  await db.exec('reset role');await db.exec(fs.readFileSync(path.join(__dirname,'../supabase/migrations/005_fifty_product_catalog.sql'),'utf8'));await db.exec('set role authenticated');
  const oldProfile=(await db.query('select public.get_my_profile() as p')).rows[0].p;assert.equal(oldProfile.catalog_version,'synthetic-pakistan-catalog-v2');assert.equal(oldProfile.participant_id,old.participant_id);
  const oldReceipt=(await db.query("select public.submit_pilot_task('dddddddd-dddd-4ddd-8ddd-dddddddddddd','[{\"id\":\"water\",\"quantity\":1},{\"id\":\"cola\",\"quantity\":1}]','en','synthetic-pakistan-catalog-v2') as p")).rows[0].p;assert.deepEqual(oldReceipt,legacyPrice);
  await assert.rejects(db.query("select public.submit_pilot_task('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','[{\"id\":\"orangefizz\",\"quantity\":1}]','en','synthetic-pakistan-catalog-v2')"),/unknown_product/);
 }finally{await db.close();}
});
