const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
require('../dist/data.js');const Core=require('../dist/core.js'),{StudyClient,validate}=require('../dist/study-client.js'),Admin=require('../dist/admin-core.js');
const config={schemaVersion:2,budget:600,price:true,position:false,labels:true,upf:true,markupPercent:25,layoutMode:'targets-eye',placementRule:'upf-or-high'};
const fixture=()=>({id:crypto.randomUUID(),revision:0,completed_at:null,config,products:CAMPUS_DATA.products,catalog_version:CAMPUS_DATA.version,layout_version:Core.LAYOUT_VERSION,rules_version:Core.RULES_VERSION});
const current=(quantity=1,events=[])=>({cart:quantity?{cola:quantity}:{},events});
const event=()=>({id:crypto.randomUUID(),type:'product_detail_opened',productId:'cola',time:new Date().toISOString()});

test('study restore requires matching catalog content and all rendering versions',()=>{
 const t=fixture();assert.equal(validate(t,CAMPUS_DATA.products,Core),t);
 for(const bad of [{...t,products:null},{...t,products:[...t.products.slice(1)]},{...t,layout_version:'other'},{...t,rules_version:'other'}])assert.throws(()=>validate(bad,CAMPUS_DATA.products,Core),/catalogVersionMismatch/);
});
test('autosave retries the identical request after a lost response, then saves newest edits',async()=>{
 const calls=[];let attempts=0;const backend={async saveStudy(r){calls.push(structuredClone(r));if(attempts++===0)throw new Error('networkError');return {...fixture(),id:r.p_task_id,revision:r.p_revision+1,basket:r.p_basket};}};
 const c=new StudyClient(backend,fixture());try{c.queue(current(1,[event()]),'zh');await assert.rejects(c.flush(),/networkError/);c.queue(current(2),'en');await c.flush();assert.deepEqual(calls[0],calls[1]);assert.equal(calls[2].p_basket[0].quantity,2);assert.equal(calls[2].p_revision,1);}finally{c.dispose();}
});
test('edits arriving during an inflight save are serialized with the updated revision',async()=>{
 let release;const calls=[];const backend={async saveStudy(r){calls.push(r);if(calls.length===1)await new Promise(res=>release=res);return {...fixture(),id:r.p_task_id,revision:r.p_revision+1,basket:r.p_basket};}};
 const c=new StudyClient(backend,fixture());try{c.queue(current(1),'en');const done=c.flush();c.queue(current(2),'ur');release();await done;assert.equal(calls.length,2);assert.equal(calls[1].p_revision,1);assert.equal(calls[1].p_basket[0].quantity,2);}finally{c.dispose();}
});
test('event batches respect the server limit and acknowledgments avoid repeated events',async()=>{
 const calls=[],events=Array.from({length:113},event);const backend={async saveStudy(r){calls.push(r);return {...fixture(),id:r.p_task_id,revision:r.p_revision+1};}};
 const c=new StudyClient(backend,fixture());try{c.queue(current(1,events),'en');await c.flush();assert.deepEqual(calls.map(c=>c.p_events.length),[50,50,13]);c.queue(current(2,events),'en');await c.flush();assert.equal(calls.at(-1).p_events.length,0);assert.equal(new Set(calls.flatMap(c=>c.p_events.map(e=>e.id))).size,113);}finally{c.dispose();}
});
test('stale device conflict halts automatic retries instead of overwriting server basket',async()=>{
 let calls=0;const c=new StudyClient({async saveStudy(){calls++;throw new Error('taskConflict');}},fixture());try{c.queue(current(),'en');await assert.rejects(c.flush(),/taskConflict/);c.queue(current(2),'en');await assert.rejects(c.flush(),/taskConflict/);assert.equal(calls,1);assert.equal(c.blocked,true);}finally{c.dispose();}
});
test('checkout flushes drafts first; a lost completion response is retried as the original completion',async()=>{
 const calls=[];let fail=true;const backend={async saveStudy(r){calls.push(structuredClone(r));if(r.p_complete&&fail){fail=false;throw new Error('networkError');}return {...fixture(),id:r.p_task_id,revision:r.p_revision+1,basket:r.p_basket,completed_at:r.p_complete?'2026-10-24T12:00:00Z':null};}};
 const c=new StudyClient(backend,fixture());try{await assert.rejects(c.complete(current(),'zh'),/networkError/);assert.ok(c.completionRequest);await c.complete(current(2),'ur');assert.equal(calls.length,3);assert.equal(calls[0].p_complete,false);assert.deepEqual(calls[1],calls[2]);assert.ok(c.task.completed_at);assert.equal(c.completionRequest,null);}finally{c.dispose();}
});
test('CSV has stable headers when empty, preserves Chinese/Urdu and mitigates formula injection',()=>{
 const csv=Admin.csv([{participant_id:'样例 اردو',university:'=HYPERLINK("bad")',energy_kcal:0,upf_energy_share:null}],'participants');assert.ok(csv.startsWith('\uFEFF'));assert.ok(csv.includes('样例 اردو'));assert.ok(csv.includes("'=HYPERLINK"));assert.ok(csv.includes('"0"'));assert.equal(Admin.cell(null),'""');assert.equal(Admin.cell('a,b\nc'),'"a,b\nc"');assert.equal(Admin.cell('  +formula'),'"\'  +formula"');assert.equal(Admin.csv([],'purchases').split('\r\n').length,2);
 const headers=Admin.columns('participants');for(const privateField of ['dob','email','phone','user_id','name'])assert.ok(!headers.includes(privateField));assert.ok(Admin.dictionary().includes('pending_review'));
});
test('all administrator UI keys and static labels have Chinese, English and Urdu translations',()=>{
 require('../dist/admin-text.js');const text=CAMPUS_ADMIN_TEXT,keys=Object.keys(text.en).sort();for(const lang of ['zh','en','ur']){assert.deepEqual(Object.keys(text[lang]).sort(),keys);assert.ok(Object.values(text[lang]).every(s=>typeof s==='string'&&s.length>0));}
 const html=fs.readFileSync(path.join(__dirname,'../dist/admin.html'),'utf8');for(const m of html.matchAll(/data-text="([^"]+)"/g))assert.ok(text.en[m[1]],m[1]);
});
test('Pages config validates study IDs; existing admins can sign in while registration is disabled',async()=>{
 const {makeConfig}=require('../tools/prepare-github-pages.cjs');assert.equal(makeConfig({STUDY_ID:'almab-factorial-test-v1'}).studyId,'almab-factorial-test-v1');assert.throws(()=>makeConfig({STUDY_ID:'../unsafe'}),/STUDY_ID/);
 const Backend=require('../dist/backend.js');let request;
 const b=new Backend({supabaseUrl:'https://example.supabase.co',supabasePublishableKey:'sb_publishable_TEST_PUBLIC',enrollmentEnabled:false},async(url,options)=>{request={url,body:JSON.parse(options.body)};return new Response('{}');},null);
 await b.send('email','team@example.org',false);assert.equal(request.body.create_user,false);assert.equal(request.url,'https://example.supabase.co/auth/v1/otp');await assert.rejects(b.send('email','team@example.org'),/notConfigured/);
});
