(function(root){
 'use strict';
 function digits(s){return String(s).replace(/[۰-۹٠-٩]/g,c=>String(c.charCodeAt(0)-(c>='۰'?1776:1632)));}
 function phone(value){
  let s=digits(value).trim().replace(/[\s()-]/g,'');
  if(s.startsWith('0092'))s='+'+s.slice(2);
  if(/^03\d{9}$/.test(s))s='+92'+s.slice(1);
  if(/^923\d{9}$/.test(s))s='+'+s;
  if(!/^\+923\d{9}$/.test(s))throw new Error('invalidPhone');
  return s;
 }
 function pakistanToday(now=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Karachi',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);}
 function age(dob,today=pakistanToday()){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(dob)||!/^\d{4}-\d{2}-\d{2}$/.test(today))return null;
  const d=new Date(dob+'T00:00:00Z');if(!Number.isFinite(+d)||d.toISOString().slice(0,10)!==dob||dob>today)return null;
  const [y,m,day]=dob.split('-').map(Number),[ty,tm,td]=today.split('-').map(Number);
  return ty-y-((tm<m||(tm===m&&td<day))?1:0);
 }
 const genders=['female','male','other','prefer_not_to_say'];
 // Broad data-entry checks, not clinical cut-offs or study eligibility criteria.
 const measurementRules={heightCm:{min:50,max:250,error:'invalidHeight'},weightKg:{min:20,max:400,error:'invalidWeight'},waistCm:{min:30,max:250,error:'invalidWaist'}};
 function measurement(value,key){
  const rule=measurementRules[key],text=digits(value??'').trim().replace(/٫/g,'.');
  if(!rule||!/^\d{1,3}(\.\d)?$/.test(text))throw new Error(rule?.error||'invalidMeasurement');
  const n=Number(text);if(!Number.isFinite(n)||n<rule.min||n>rule.max)throw new Error(rule.error);
  return n;
 }
 function questionnaireCode(value){
  const code=String(value??'').trim();if(!code)return null;
  if(code.length>80||/[\u0000-\u001f\u007f]/.test(code))throw new Error('invalidQuestionnaireCode');
  return code;
 }
 function completeProfile(p){return !!p&&Object.keys(measurementRules).every(key=>{const value=p[{heightCm:'height_cm',weightKg:'weight_kg',waistCm:'waist_cm'}[key]];try{measurement(value,key);return true;}catch{return false;}});}
 function profile(input,today){
  const years=age(input.dob,today);
  if(years===null)throw new Error('invalidDob');
  if(years<18||years>26)throw new Error('ageRange');
  if(!genders.includes(input.gender))throw new Error('invalidGender');
  const university=String(input.university||'').trim();
  if(university.length<2||university.length>160)throw new Error('invalidUniversity');
  const height=measurement(input.heightCm,'heightCm'),weight=measurement(input.weightKg,'weightKg'),waist=measurement(input.waistCm,'waistCm');
  const code=questionnaireCode(input.questionnaireCode);
  if(input.consent!==true)throw new Error('consentRequired');
  return {p_dob:input.dob,p_gender:input.gender,p_university:university,p_consent_version:input.consentVersion,p_height_cm:height,p_weight_kg:weight,p_waist_cm:waist,p_questionnaire_code:code};
 }
 function publicKey(key){
  if(typeof key!=='string'||!key)return false;
  if(key.startsWith('sb_publishable_'))return /^[A-Za-z0-9_-]+$/.test(key);
  try{const b64=key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');return JSON.parse(atob(b64)).role==='anon';}catch{return false;}
 }
 function cloudbaseKey(key,env){
  // This is a configuration guard; the CloudBase gateway verifies signatures.
  if(typeof key!=='string'||!/^[-\w]+\.[-\w]+\.[-\w]+$/.test(key))return false;
  try{const p=JSON.parse(atob(key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));return p.role==='anon'&&p.sub==='anon'&&p.project_id===env&&p.aud===env&&p.is_system_admin!==true&&(!p.exp||p.exp>Date.now()/1000);}catch{return false;}
 }
 function provider(c){return c?.backendProvider||'supabase';}
 function cloudbaseUrl(c){return /^[a-z][a-z0-9-]{3,99}$/.test(c?.cloudbaseEnvId||'')?'https://'+c.cloudbaseEnvId+'.api.tcloudbasegateway.com':null;}
 function configReady(c){
  if(provider(c)==='cloudbase')return !!cloudbaseUrl(c)&&c.cloudbaseRegion==='ap-shanghai'&&(!c.cloudbasePublishableKey||cloudbaseKey(c.cloudbasePublishableKey,c.cloudbaseEnvId));
  if(provider(c)!=='supabase')return false;
  try{const u=new URL(c.supabaseUrl);return u.protocol==='https:'&&!u.username&&!u.password&&u.pathname==='/'&&!u.search&&!u.hash&&publicKey(c.supabasePublishableKey);}catch{return false;}
 }
 function httpsUrl(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.search&&!u.hash?u.href:null;}catch{return null;}}
 function enabled(c){return configReady(c)&&c.enrollmentEnabled===true&&typeof c.consentVersion==='string'&&c.consentVersion.length>0&&['zh','en','ur'].every(l=>httpsUrl(c.informationUrls?.[l]));}
 function qrUrl(c,current){return httpsUrl(c.publicSiteUrl)||httpsUrl(current);}
 const api={digits,phone,age,pakistanToday,profile,genders,measurementRules,measurement,questionnaireCode,completeProfile,publicKey,cloudbaseKey,provider,cloudbaseUrl,configReady,enabled,httpsUrl,qrUrl};
 root.CampusAuthCore=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
