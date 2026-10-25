const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {PGlite}=require('@electric-sql/pglite');
require('../dist/data.js');const Core=require('../dist/core.js');
for(const provider of ['supabase','cloudbase'])test(provider+' factorial study: real PostgreSQL allocation, drafts, completion, permissions and export',async t=>{
 const db=new PGlite();const study='almab-factorial-test-v4';let seq=100;
 const uuid=()=>`00000000-0000-4000-8000-${String(seq++).padStart(12,'0')}`;
 const owner=()=>db.exec('reset role');
 const login=async(id,role='authenticated')=>{await owner();await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:id,role,is_anonymous:role==='anon'})]);await db.exec('set role '+role);};
 const start=async()=> (await db.query('select public.get_or_start_study_task($1) as t',[study])).rows[0].t;
 const save=async(task,basket,complete=false,events=[],request=uuid(),revision=task.revision)=> (await db.query('select public.save_study_task($1,$2,$3,$4::jsonb,$5,$6::jsonb,$7) as t',[task.id,revision,request,JSON.stringify(basket),'ur',JSON.stringify(events),complete])).rows[0].t;
 try{
  if(provider==='cloudbase'){
   await db.exec(`create role anon;create role authenticated;create schema auth;
    create table auth.users(id varchar(64) primary key,email text,email_verified boolean default false,is_anonymous boolean default false,user_metadata jsonb default '{}');
    create function auth.jwt() returns jsonb language sql stable as $$select nullif(current_setting('request.jwt.claims',true),'')::jsonb$$;
    create function auth.uid() returns text language sql stable as $$select auth.jwt()->>'sub'$$;
    grant usage on schema auth to authenticated,anon;grant execute on function auth.uid(),auth.jwt() to authenticated,anon;`);
   const sql=fs.readFileSync(path.join(__dirname,'../cloudbase/01_install.sql'),'utf8');assert.equal(sql,require('../tools/build-cloudbase.cjs').build());await db.exec(sql);
   await t.test('unverified and anonymous contacts fail closed; user metadata cannot claim verification',async()=>{
    await db.exec(`insert into auth.users(id,email,user_metadata) values('unverified-user','synthetic@example.org','{"email_verified":true}');`);
    await login('unverified-user');await assert.rejects(db.query("select public.register_participant((current_date-interval '22 years')::date,'female','Synthetic University','test',170,60,80,null)"),/verified_contact_required/);
    await owner();assert.equal((await db.query(`select private.cloudbase_verified_contact('{"email":"synthetic@example.org","email_verified":true,"is_anonymous":true}') as v`)).rows[0].v,false);
    await assert.rejects(db.exec(sql),/fresh_environment_required/);await db.exec('rollback');
   });
  }else{
  await db.exec(`create role anon;create role authenticated;create schema auth;
   create table auth.users(id uuid primary key,email_confirmed_at timestamptz,phone_confirmed_at timestamptz);
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;`);
  for(const file of fs.readdirSync(path.join(__dirname,'../supabase/migrations')).filter(x=>x.endsWith('.sql')).sort())await db.exec(fs.readFileSync(path.join(__dirname,'../supabase/migrations',file),'utf8'));
  }
  await db.exec("update private.pilot_settings set enrollment_open=true,consent_version='study-test-v1'");
  const people=[];
  for(let i=0;i<16;i++){
   const id=provider==='cloudbase'?'tcb-non-uuid-user-'+i:uuid();await owner();await db.query(provider==='cloudbase'?"insert into auth.users(id,email,email_verified) values($1,'synthetic@example.org',true)":'insert into auth.users(id,email_confirmed_at) values($1,now())',[id]);await login(id);
   const p=(await db.query("select public.register_participant((current_date-interval '22 years')::date,'female','Synthetic University','study-test-v1',170,60,80,null) as p")).rows[0].p;
   if(i===0){await t.test('new study closed by default',()=>assert.rejects(start(),/study_closed/));await owner();await db.exec("update private.studies set enrollment_open=true,tasks_open=true,consent_version='study-test-v1'");await login(id);}
   const task=await start();people.push({id,p,task});assert.equal((await start()).id,task.id);
  }
  await t.test('sixteen assignments contain exactly two of each of eight conditions',async()=>{
   assert.deepEqual(people.map(x=>x.task.condition_code).sort(),Array.from({length:8},(_,i)=>i.toString(2).padStart(3,'0')).flatMap(x=>[x,x]));
   for(const {task} of people){const bits=task.condition_code;assert.equal(+task.config.price,+bits[0]);assert.equal(+task.config.position,+bits[1]);assert.equal(+task.config.labels,+bits[2]);assert.equal(task.config.upf,task.config.labels);assert.deepEqual(task.products,CAMPUS_DATA.products);}
  });
  await t.test('server accepts all 75 unique SKUs and preserves the earlier frozen 50-SKU study',async()=>{
   await owner();const large=structuredClone(CAMPUS_DATA.products);large.forEach(p=>p.price=.01);
   const basket=large.map(p=>({id:p.id,quantity:1}));const result=(await db.query('select private.study_basket_result($1::jsonb,$2::jsonb,$3::jsonb) as r',[JSON.stringify(basket),JSON.stringify({...people[0].task.config,budget:5000}),JSON.stringify(large)])).rows[0].r;
   assert.equal(result.items.length,75);assert.equal(result.items.find(x=>x.product_id==='icecream-cup').size,80);
   const old=(await db.query("select catalog_snapshot,layout_version from private.studies where id='almab-factorial-test-v2'")).rows[0];
   assert.deepEqual(old.catalog_snapshot,require('./fixtures/catalog-v4.json'));assert.equal(old.layout_version,'physical-rack-v3');
   await login(people[0].id);
  });
  await t.test('study definition freezes after allocation; pause switches remain writable',async()=>{
   await owner();await assert.rejects(db.exec("update private.studies set base_config=base_config||'{\"markupPercent\":30}'"),/study_definition_locked/);
   await db.exec('update private.studies set enrollment_open=false');await login(people[0].id);assert.equal((await start()).id,people[0].task.id);
   await owner();await db.exec('update private.studies set enrollment_open=true');
  });
  const a=people[0],b=people[1];await login(a.id);let task=a.task;let first;
  await t.test('draft save/reload and lost-response retry preserve revision and sanitized logs',async()=>{
   const request=uuid(),eventId=uuid();const events=[{id:eventId,type:'quantity_changed',time:'2026-10-24T12:30:00.000Z',productId:'cola',quantity:1,delta:1,email:'PRIVATE',dob:'PRIVATE',height:170,query:'PRIVATE'}];
   first=await save(task,[{id:'cola',quantity:1}],false,events,request);
   assert.equal(first.revision,1);assert.deepEqual(first.basket,[{id:'cola',quantity:1}]);assert.equal(first.completed_at,null);
   assert.deepEqual(await save(task,[{id:'cola',quantity:1}],false,events,request),first);assert.deepEqual(await start(),first);
   await assert.rejects(save(task,[]),/task_conflict/);task=first;
   await owner();const rows=(await db.query('select * from private.study_events where task_id=$1',[task.id])).rows;assert.equal(rows.length,1);assert.deepEqual(rows[0].details,{product_id:'cola',quantity:1,delta:1});assert.ok(!JSON.stringify(rows).includes('PRIVATE'));
   await login(a.id);
  });
  await t.test('other accounts cannot read/save this task or see assignments and sequence',async()=>{
   await login(b.id);await assert.rejects(save(task,[]),/task_unavailable/);
   for(const table of ['allocations','randomization_slots','study_tasks','study_events','study_admins','export_sessions'])await assert.rejects(db.exec('select * from private.'+table),/permission denied/);
   await assert.rejects(db.query('select public.admin_study_overview($1)',[study]),/admin_required/);
   await login(a.id);
  });
  await t.test('browser price overrides, extra fields, unknown foods and overspending rejected',async()=>{
   for(const [basket,error]of [[[{id:'cola',quantity:1,price:0}],'invalid_item'],[[{id:'cola',quantity:0}],'invalid_item'],[[{id:'water',quantity:99}],'budget_exceeded'],[[{id:'invented',quantity:1}],'unknown_product'],[[{id:'water',quantity:1},{id:'water',quantity:1}],'duplicate_item']])await assert.rejects(save(task,basket),new RegExp(error));
  });
  let complete;
  await t.test('completed outcomes computed from frozen server catalog; cannot restart/overwrite',async()=>{
   complete=await save(task,[{id:'cola',quantity:1},{id:'water',quantity:1}],true);
   const total=Core.totals({cola:1,water:1},CAMPUS_DATA.products,task.config);assert.equal(complete.result.amountMinor,total.amountMinor);assert.equal(complete.result.energy,total.energy);assert.ok(complete.completed_at);assert.equal(complete.result.items.length,2);
   assert.equal((await start()).id,complete.id);assert.deepEqual((await start()).basket,complete.basket);
   assert.deepEqual(await save(complete,complete.basket,true),complete);await assert.rejects(save(complete,[],true),/task_completed/);await assert.rejects(save(complete,complete.basket),/task_completed/);
  });
  await t.test('completed empty basket differs from uncompleted task',async()=>{
   await login(b.id);b.task=await save(b.task,[],true);assert.equal(b.task.result.energy,0);assert.equal(b.task.result.upfShare,null);assert.ok(b.task.completed_at);
   await login(people[2].id);assert.equal((await start()).result,null);
  });
  await t.test('every condition uses exact frontend price math with no cross-factor price effects',async()=>{
   for(const person of people.slice(2,10)){await login(person.id);const r=await save(person.task,[{id:'cola',quantity:1}],true);assert.equal(r.result.amountMinor,Core.priceMinor(CAMPUS_DATA.products.find(x=>x.id==='cola'),person.task.config));person.task=r;}
  });
  await t.test('piece-based toffee quantities reach server receipts without becoming packets',async()=>{
   const person=people[10];await login(person.id);const r=await save(person.task,[{id:'toffee-piece',quantity:2}],true);const item=r.result.items[0];
   assert.equal(item.quantity,2);assert.equal(item.sale_unit,'piece');assert.equal(item.pieces_per_unit,1);assert.equal(item.size,5);assert.equal(item.energy_kcal,41);assert.equal(r.result.amountMinor,person.task.config.price?2500:2000);
   await owner();const preserved=(await db.query("select product from private.catalog where version='synthetic-pakistan-catalog-v3' order by (product->>'catalogOrder')::int")).rows.map(r=>r.product);assert.deepEqual(preserved,require('./fixtures/catalog-v3.json'));
   const current=(await db.query("select product from private.catalog where version='synthetic-pakistan-catalog-v5' order by (product->>'catalogOrder')::int")).rows.map(r=>r.product);assert.deepEqual(current,CAMPUS_DATA.products);await login(person.id);
  });
  await t.test('admin permission is server-side, export permission independent, no contact/DOB leaked',async()=>{
   await owner();await db.query('insert into private.study_admins(user_id) values($1)',[a.id]);await login(a.id);
   let overview=(await db.query('select public.admin_study_overview($1) as r',[study])).rows[0].r;
   assert.equal(overview.total,16);assert.equal(overview.groups.length,8);assert.equal(overview.groups.reduce((n,g)=>n+g.allocated,0),16);assert.equal(overview.can_export,false);
   assert.ok(!overview.rows.some(r=>'dob' in r||'user_id' in r||'email' in r||'phone' in r||'ordinal' in r));
   const detail=(await db.query('select public.admin_study_task_detail($1) as r',[complete.id])).rows[0].r;assert.equal(detail.items.length,2);assert.equal(detail.participant.participant_id,a.p.participant_id);assert.ok(!('dob' in detail.participant));
   await assert.rejects(db.query("select public.admin_start_export($1,'participants')",[study]),/admin_required/);
   await owner();await db.query('update private.study_admins set can_export=true where user_id=$1',[a.id]);await login(a.id);
  });
  await t.test('paged export includes all assigned students and null outcomes for unfinished tasks',async()=>{
   const e=(await db.query("select public.admin_start_export($1,'participants') as r",[study])).rows[0].r;let after='',rows=[];
   for(let i=0;i<10;i++){const p=(await db.query('select public.admin_export_page($1,$2,3) as r',[e.export_id,after])).rows[0].r;rows.push(...p.rows);if(!p.next)break;after=p.next;}
   assert.equal(rows.length,16);assert.equal(new Set(rows.map(r=>r.participant_id)).size,16);
   const empty=rows.find(r=>r.participant_id===b.p.participant_id);assert.equal(empty.status,'completed');assert.equal(empty.energy_kcal,0);assert.equal(empty.upf_energy_share,null);
   const missing=rows.find(r=>r.participant_id===people[15].p.participant_id);assert.equal(missing.status,'in_progress');assert.equal(missing.energy_kcal,null);
   for(const dataset of ['purchases','events','catalog']){const exportId=(await db.query('select public.admin_start_export($1,$2) as r',[study,dataset])).rows[0].r.export_id;const data=(await db.query('select public.admin_export_page($1) as r',[exportId])).rows[0].r.rows;if(dataset==='catalog')assert.equal(data.length,75);else assert.ok(data.length>0);}
   await login(b.id);await assert.rejects(db.query('select public.admin_export_page($1)',[e.export_id]),/admin_required/);await login(a.id);
  });
  await t.test('filters apply to all export pages and cutoff excludes later completions',async()=>{
   const f={condition:'000',status:'completed',university:'Synthetic',from:'2000-01-01',to:'2099-12-31'};
   const o=(await db.query('select public.admin_study_overview($1,$2::jsonb) as r',[study,JSON.stringify(f)])).rows[0].r;assert.ok(o.rows.every(r=>r.condition_code==='000'&&r.status==='completed'));
   await assert.rejects(db.query('select public.admin_study_overview($1,$2::jsonb)',[study,'{"condition":"999"}']),/invalid_filters/);
   const snapshot=(await db.query("select public.admin_start_export($1,'participants','{\"from\":\"\",\"to\":\"\"}') as r",[study])).rows[0].r;
   await login(people[15].id);await save(people[15].task,[],true);await login(a.id);
   const page=(await db.query('select public.admin_export_page($1) as r',[snapshot.export_id])).rows[0].r;
   const later=page.rows.find(r=>r.participant_id===people[15].p.participant_id);assert.equal(later.status,'in_progress');assert.equal(later.energy_kcal,null);assert.equal(later.completed_at,null);
  });
  await t.test('pause stops draft writes but retains completed receipts; anonymous cannot call RPCs',async()=>{
   await owner();await db.exec('update private.studies set tasks_open=false');await login(people[14].id);await assert.rejects(save(people[14].task,[]),/study_closed/);
   await login(a.id);assert.deepEqual(await save(complete,complete.basket,true),complete);
   await login('','anon');await assert.rejects(start(),/permission denied/);await assert.rejects(db.query('select public.admin_study_overview($1)',[study]),/permission denied/);
  });
 }finally{await db.close();}
});
