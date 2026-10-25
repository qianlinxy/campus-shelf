const test=require('node:test'),assert=require('node:assert/strict');
const A=require('../dist/auth-core.js'),Backend=require('../dist/backend.js');
const {makeConfig}=require('../tools/prepare-github-pages.cjs');
const config={supabaseUrl:'https://example.supabase.co',supabasePublishableKey:'sb_publishable_TEST_PUBLIC',enrollmentEnabled:true,phoneAuthEnabled:true,consentVersion:'pilot-v1',informationUrls:{zh:'https://example.org/info-zh',en:'https://example.org/info-en',ur:'https://example.org/info-ur'}};
const memory=()=>{const m=new Map();return {getItem:k=>m.get(k),setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k),m};};
const response=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});

test('Pakistani mobile normalization accepts local, international and Urdu numerals; rejects other countries',()=>{
 for(const value of ['0300 1234567','+92 300-1234567','00923001234567','923001234567','۰۳۰۰۱۲۳۴۵۶۷','٠٣٠٠١٢٣٤٥٦٧'])assert.equal(A.phone(value),'+923001234567');
 for(const value of ['+12025550123','+9230012345678','0211234567','0300123456','0300abc4567'])assert.throws(()=>A.phone(value),/invalidPhone/);
});
test('age uses a valid full birth date and birthday boundary in Pakistan',()=>{
 assert.equal(A.age('2008-10-24','2026-10-23'),17);assert.equal(A.age('2008-10-24','2026-10-24'),18);
 assert.equal(A.age('2000-10-25','2026-10-24'),25);assert.equal(A.age('2000-10-24','2026-10-24'),26);
 assert.equal(A.age('2025-02-29','2026-10-24'),null);assert.equal(A.age('2027-01-01','2026-10-24'),null);
 assert.equal(A.age('2004-02-29','2026-02-28'),21);assert.equal(A.age('2004-02-29','2026-03-01'),22);
 assert.equal(A.pakistanToday(new Date('2026-10-23T20:00:00Z')),'2026-10-24');
});
test('demographics omit names and contacts, validate eligibility and consent',()=>{
 const input={dob:'2004-01-02',gender:'prefer_not_to_say',university:'  University of the Punjab  ',heightCm:'171.2',weightKg:'65.4',waistCm:'78.5',questionnaireCode:'',consent:true,consentVersion:'pilot-v1',name:'NEVER STORE',email:'NEVER STORE'};
 const body=A.profile(input,'2026-10-24');assert.deepEqual(Object.keys(body).sort(),['p_consent_version','p_dob','p_gender','p_height_cm','p_questionnaire_code','p_university','p_waist_cm','p_weight_kg']);assert.equal(body.p_university,'University of the Punjab');assert.equal(body.p_questionnaire_code,null);
 for(const [patch,error]of [[{dob:'2010-01-01'},'ageRange'],[{dob:'1990-01-01'},'ageRange'],[{gender:''},'invalidGender'],[{university:' '},'invalidUniversity'],[{consent:false},'consentRequired']])assert.throws(()=>A.profile({...input,...patch},'2026-10-24'),new RegExp(error));
});
test('configuration fails closed and rejects privileged keys and unsafe QR URLs',()=>{
 assert.equal(A.enabled(config),true);assert.equal(A.enabled({...config,consentVersion:''}),false);
 assert.equal(A.configReady({...config,supabasePublishableKey:'sb_secret_SUPERSECRET'}),false);
 const jwt=role=>['e30',Buffer.from(JSON.stringify({role})).toString('base64url'),'sig'].join('.');
 assert.equal(A.publicKey(jwt('service_role')),false);assert.equal(A.publicKey(jwt('anon')),true);
 assert.throws(()=>makeConfig({SUPABASE_PUBLISHABLE_KEY:'sb_secret_TEST'}));assert.throws(()=>makeConfig({ENROLLMENT_ENABLED:'true'}));
 assert.equal(makeConfig({}).enrollmentEnabled,false);
 for(const u of ['javascript:alert(1)','http://example.org/','https://example.org/?token=secret','https://user:pass@example.org/'])assert.equal(A.qrUrl({publicSiteUrl:u},''),null);
 assert.equal(A.qrUrl({publicSiteUrl:'https://student.github.io/shelf/'},''),'https://student.github.io/shelf/');
});
test('body measurements accept one decimal and Urdu digits without silently changing units',()=>{
 assert.equal(A.measurement('۱۷۱٫۲','heightCm'),171.2);assert.equal(A.measurement('٦٥٫٤','weightKg'),65.4);
 assert.equal(A.measurement(' 78.5 ','waistCm'),78.5);
 for(const [key,values]of [['heightCm',['','1.71','171.25','2e2','0xAA','Infinity','250.1']],['weightKg',['','0','400.1','65kg','65,4']],['waistCm',['','29.9','250.1',null]]])for(const value of values)assert.throws(()=>A.measurement(value,key));
 for(const [key,min,max]of [['heightCm',50,250],['weightKg',20,400],['waistCm',30,250]]){assert.equal(A.measurement(min,key),min);assert.equal(A.measurement(max,key),max);}
});
test('questionnaire ID stays optional, keeps its case, and is not declared matched',()=>{
 assert.equal(A.questionnaireCode('   '),null);assert.equal(A.questionnaireCode(' TEST-ab_001 '),'TEST-ab_001');
 assert.throws(()=>A.questionnaireCode('x'.repeat(81)),/invalidQuestionnaireCode/);assert.throws(()=>A.questionnaireCode('A\nB'),/invalidQuestionnaireCode/);
 assert.equal(A.completeProfile({}),false);assert.equal(A.completeProfile({height_cm:null,weight_kg:null,waist_cm:null}),false);
 assert.equal(A.completeProfile({height_cm:171.2,weight_kg:65.4,waist_cm:78.5,questionnaire_code:null}),true);
});
test('OTP uses real Supabase endpoints; only verified server response creates a session',async()=>{
 const requests=[],storage=memory();let n=0;
 const backend=new Backend(config,async(url,opts)=>{requests.push({url,...opts});if(n++===0)return response({});if(n===2)return response({access_token:'access',refresh_token:'refresh',expires_in:3600});return response(null);},storage);
 await backend.send('phone','+923001234567');assert.equal(backend.session,null);
 assert.equal(requests[0].url,'https://example.supabase.co/auth/v1/otp');assert.deepEqual(JSON.parse(requests[0].body),{phone:'+923001234567',create_user:true,channel:'sms'});
 await backend.verify('phone','+923001234567','123456');assert.equal(backend.session.access_token,'access');
 assert.equal(JSON.parse(requests[1].body).type,'sms');assert.equal(requests[2].headers.Authorization,'Bearer access');
 assert.doesNotMatch(JSON.stringify([...storage.m.values()]),/923001234567|dob|university/);
});
test('email OTP uses email verification type and disabled SMS never sends',async()=>{
 let calls=0;const requests=[];const backend=new Backend({...config,phoneAuthEnabled:false},async(url,opts)=>{calls++;requests.push({url,...opts});return calls===1?response({}):response({error_code:'otp_expired'},422);},memory());
 await assert.rejects(backend.send('phone','+923001234567'),/smsUnavailable/);assert.equal(calls,0);
 await backend.send('email','synthetic@example.org');assert.deepEqual(JSON.parse(requests[0].body),{email:'synthetic@example.org',create_user:true});
 await assert.rejects(backend.verify('email','synthetic@example.org','123456'),/invalidOtp/);assert.equal(JSON.parse(requests[1].body).type,'email');assert.equal(backend.session,null);
});
test('session refresh is shared across requests and logout clears tokens even on network failure',async()=>{
 const storage=memory();let refresh=0;
 const backend=new Backend(config,async(url)=>{if(url.includes('/token?')){refresh++;return response({access_token:'new',refresh_token:'new-refresh',expires_in:3600});}throw new Error('offline');},storage);
 backend.remember({access_token:'old',refresh_token:'old-refresh',expires_at:1});
 assert.deepEqual(await Promise.all([backend.token(),backend.token()]),['new','new']);assert.equal(refresh,1);
 await assert.rejects(backend.signOut(),/networkError/);assert.equal(backend.session,null);assert.equal(storage.m.size,0);
});
test('rate limits, invalid OTP and expired sessions never expose provider error bodies',async()=>{
 for(const [status,expected]of [[429,'rateLimited'],[401,'sessionExpired'],[500,'serviceError']]){
  const backend=new Backend(config,async()=>response({message:'CONTACT_SECRET'},status),memory());
  await assert.rejects(backend.send('email','synthetic@example.org'),e=>e.message===expected&&!e.message.includes('SECRET'));
 }
});
test('profile and checkout use authenticated RPC with minimal idempotent basket',async()=>{
 const requests=[],backend=new Backend(config,async(url,opts)=>{requests.push({url,...opts});return response({session_id:'test-session'});},memory());
 backend.remember({access_token:'access',refresh_token:'refresh',expires_in:3600});
 await backend.saveProfile({p_dob:'2004-01-02',p_gender:'female',p_university:'Synthetic University',p_consent_version:'v1',p_height_cm:171.2,p_weight_kg:65.4,p_waist_cm:78.5,p_questionnaire_code:null});
 await backend.submit({id:'test-session',basket:[{id:'water',quantity:1}],language:'ur',catalogVersion:'synthetic-pakistan-catalog-v2'});
 assert.ok(requests.every(r=>r.headers.Authorization==='Bearer access'));
 assert.equal(requests[1].url,'https://example.supabase.co/rest/v1/rpc/submit_pilot_task');
 assert.deepEqual(JSON.parse(requests[1].body),{p_session_id:'test-session',p_basket:[{id:'water',quantity:1}],p_language:'ur',p_catalog_version:'synthetic-pakistan-catalog-v2'});
 assert.doesNotMatch(requests[1].body,/p_dob|email|phone|price|height|weight|waist|questionnaire/);
});
test('Urdu and both other languages cover every UI key; catalog searches can use Urdu',()=>{
 require('../dist/i18n.js');require('../dist/urdu.js');require('../dist/enrollment-text.js');require('../dist/anthropometry-text.js');require('../dist/data.js');
 for(const l of ['zh','ur'])assert.deepEqual(Object.keys(CAMPUS_TEXT[l]).sort(),Object.keys(CAMPUS_TEXT.en).sort());
 assert.equal(CAMPUS_DATA.products.length,75);assert.equal(new Set(CAMPUS_DATA.products.map(p=>p.id)).size,75);
 for(const p of CAMPUS_DATA.products)assert.ok(p.zh&&p.en&&/[\u0600-\u06ff]/.test(p.ur));
 assert.ok(CAMPUS_DATA.products.some(p=>p.ur.includes('چنے')));
});
test('bundled QR generator creates a genuine scalable SVG with a quiet zone',()=>{
 const qr=require('../dist/vendor/qrcode.js')(0,'M');qr.addData('https://example.github.io/campus-shelf/');qr.make();
 const svg=qr.createSvgTag({cellSize:5,margin:20,scalable:true});assert.match(svg,/<svg/);assert.match(svg,/viewBox=/);assert.ok(qr.getModuleCount()>=21);
});
