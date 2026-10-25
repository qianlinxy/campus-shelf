const test=require('node:test'),assert=require('node:assert/strict');
const A=require('../dist/auth-core.js'),Backend=require('../dist/backend.js'),{makeConfig}=require('../tools/prepare-github-pages.cjs');
const env='monetary-dinosaur-d0d39pf87e5f20',base='https://'+env+'.api.tcloudbasegateway.com';
const config={backendProvider:'cloudbase',cloudbaseEnvId:env,cloudbaseRegion:'ap-shanghai',cloudbasePublishableKey:'',enrollmentEnabled:true,studyId:'almab-factorial-test-v1',consentVersion:'test-v1',informationUrls:{zh:'https://example.org/zh',en:'https://example.org/en',ur:'https://example.org/ur'}};
const response=(data,status=200)=>new Response(JSON.stringify(data),{status});
const session={access_token:'access',refresh_token:'refresh',expires_in:7200};
const memory=()=>{const m=new Map();return {m,getItem:k=>m.get(k),setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};};
function mock(responses,cfg=config){const calls=[],storage=memory(),b=new Backend(cfg,async(url,opts)=>{calls.push({url,...opts,body:opts.body?JSON.parse(opts.body):null});const r=responses.shift();if(r instanceof Error)throw r;assert.ok(r,'Unexpected request '+url);return r;},storage);return {b,calls,storage};}
test('CloudBase configuration accepts only this gateway, Shanghai region and matching anon publish keys',()=>{
 const jwt=patch=>['e30',Buffer.from(JSON.stringify({role:'anon',sub:'anon',project_id:env,aud:env,...patch})).toString('base64url'),'signature'].join('.');
 assert.equal(A.configReady(config),true);assert.equal(A.enabled(config),true);
 for(const patch of [{cloudbaseEnvId:'https://evil.test'},{cloudbaseRegion:'ap-guangzhou'},{cloudbasePublishableKey:'sb_secret_x'},{cloudbasePublishableKey:jwt({role:'service_role'})},{cloudbasePublishableKey:jwt({aud:'other'})},{cloudbasePublishableKey:jwt({sub:'real-user'})}])assert.equal(A.configReady({...config,...patch}),false);
 assert.equal(A.configReady({...config,cloudbasePublishableKey:jwt({})}),true);
 assert.throws(()=>makeConfig({BACKEND_PROVIDER:'cloudbase',CLOUDBASE_ENV_ID:env,CLOUDBASE_PUBLISHABLE_KEY:jwt({role:'service_role'})}));
 assert.throws(()=>makeConfig({BACKEND_PROVIDER:'cloudbase',CLOUDBASE_ENV_ID:env,ENROLLMENT_ENABLED:'true'}));
 assert.equal(makeConfig({BACKEND_PROVIDER:'cloudbase',CLOUDBASE_ENV_ID:env}).enrollmentEnabled,false);
});
test('new student: send → verify → signup → research profile; no contact or verification ID persisted',async()=>{
 const {b,calls,storage}=mock([response({verification_id:'challenge-id',expires_in:600,is_user:false}),response({verification_token:'verified-contact'}),response(session),response(null)]);
 await b.send('email','synthetic@example.org');assert.equal(b.session,null);
 assert.deepEqual(calls[0].body,{email:'synthetic@example.org',target:'ANY'});
 assert.equal(calls[0].url,base+'/auth/v1/verification');
 await b.verify('email','synthetic@example.org','123456');
 assert.deepEqual(calls[1].body,{verification_id:'challenge-id',verification_code:'123456'});
 assert.equal(calls[1].url,base+'/auth/v1/verification/verify');
 assert.equal(calls[2].url,base+'/auth/v1/signup');assert.deepEqual(calls[2].body,{email:'synthetic@example.org',verification_token:'verified-contact'});
 assert.equal(calls[3].url,base+'/v1/rdb/rest/rpc/get_my_profile');assert.equal(calls[3].headers.Authorization,'Bearer access');assert.ok(!('apikey' in calls[3].headers));
 assert.doesNotMatch(JSON.stringify([...storage.m]),/synthetic@example.org|challenge-id|verified-contact/);assert.equal(b.pending,null);
});
test('returning student signs in instead of creating another account',async()=>{
 const {b,calls}=mock([response({verification_id:'v',expires_in:600,is_user:true}),response({verification_token:'v-token'}),response(session),response({participant_id:'research-id'})]);
 await b.send('email','synthetic@example.org');assert.equal((await b.verify('email','synthetic@example.org','123456')).participant_id,'research-id');
 assert.equal(calls[2].url,base+'/auth/v1/signin');assert.deepEqual(calls[2].body,{verification_token:'v-token'});
});
test('admin login is existing users only even with registration disabled or missing is_user',async()=>{
 const {b,calls}=mock([response({verification_id:'v',expires_in:600}),response({verification_token:'v-token'}),response(session),response(null)],{...config,enrollmentEnabled:false});
 await b.send('email','synthetic@example.org',false);assert.equal(calls[0].body.target,'USER');
 await b.verify('email','synthetic@example.org','123456');assert.equal(calls[2].url,base+'/auth/v1/signin');assert.ok(!calls.some(x=>x.url.endsWith('/signup')));
});
test('code cannot verify a different contact, expired challenge or unrequested challenge',async()=>{
 const {b,calls}=mock([response({verification_id:'v',expires_in:600})]);
 await assert.rejects(b.verify('email','synthetic@example.org','123456'),/invalidOtp/);await b.send('email','synthetic@example.org');
 await assert.rejects(b.verify('email','changed@example.org','123456'),/invalidOtp/);b.pending.until=0;
 await assert.rejects(b.verify('email','synthetic@example.org','123456'),/invalidOtp/);assert.equal(calls.length,1);
});
test('verification token alone never creates a login session',async()=>{
 const {b}=mock([response({verification_id:'v',expires_in:600}),response({verification_token:'v-token'}),response({error:'invalid_status'},400)]);
 await b.send('email','synthetic@example.org');await assert.rejects(b.verify('email','synthetic@example.org','123456'),/serviceError/);assert.equal(b.session,null);
});
test('provider errors are sanitized, including CAPTCHA; no retry bypass or signup fallback',async()=>{
 for(const [error,expected] of [['captcha_required','captchaRequired'],['invalid_verification_code','invalidOtp'],['rate_limit_exceeded','rateLimited']]){
  const {b,calls}=mock([response({error,error_description:'PRIVATE_CONTACT'},400)]);
  await assert.rejects(b.send('email','synthetic@example.org'),e=>e.message===expected);assert.equal(calls.length,1);assert.equal(b.session,null);
 }
});
test('refresh rotates tokens once and logout uses CloudBase endpoint; storage cleared on failure',async()=>{
 const {b,calls,storage}=mock([response({...session,access_token:'new',refresh_token:'rotated'}),new Error('offline')]);
 b.remember({...session,expires_at:1});assert.deepEqual(await Promise.all([b.token(),b.token()]),['new','new']);
 assert.equal(calls[0].url,base+'/auth/v1/token');assert.deepEqual(calls[0].body,{grant_type:'refresh_token',refresh_token:'refresh'});
 await assert.rejects(b.signOut(),/networkError/);assert.equal(calls[1].url,base+'/auth/v1/user/signout');assert.equal(calls[1].headers.Authorization,'Bearer new');assert.equal(b.session,null);assert.equal(storage.m.size,0);
});
test('CloudBase session storage is isolated from Supabase and +92 SMS remains disabled',async()=>{
 const {b,calls,storage}=mock([]);storage.setItem('campus-auth:undefined',JSON.stringify(session));assert.equal(b.session,null);
 await assert.rejects(b.send('phone','+923001234567'),/smsUnavailable/);assert.equal(calls.length,0);
});
test('all study/admin operations use authenticated CloudBase RPC, retaining their argument contracts',async()=>{
 const {b,calls}=mock(Array.from({length:8},()=>response({})));b.remember(session);
 await b.saveProfile({p_gender:'female'});await b.getStudy(config.studyId);await b.saveStudy({p_revision:0});await b.overview(config.studyId);await b.taskDetail('task');await b.startExport(config.studyId,'participants');await b.exportPage('export');await b.submit({id:'old-task',basket:[],language:'ur',catalogVersion:'old'});
 assert.ok(calls.every(x=>x.url.startsWith(base+'/v1/rdb/rest/rpc/')&&x.headers.Authorization==='Bearer access'));
 assert.equal(calls[3].body.p_limit,50);assert.equal(calls[6].body.p_limit,200);
});
