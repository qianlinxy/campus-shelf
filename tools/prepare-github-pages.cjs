// Only public values enter the browser bundle; fail closed on missing configuration.
const fs=require('node:fs'),path=require('node:path');
const A=require('../dist/auth-core.js');
function makeConfig(env){
 const requested=env.ENROLLMENT_ENABLED==='true';
 const cfg={backendProvider:env.BACKEND_PROVIDER||'supabase',supabaseUrl:env.SUPABASE_URL||'',supabasePublishableKey:env.SUPABASE_PUBLISHABLE_KEY||'',cloudbaseEnvId:env.CLOUDBASE_ENV_ID||'',cloudbaseRegion:env.CLOUDBASE_REGION||'ap-shanghai',cloudbasePublishableKey:env.CLOUDBASE_PUBLISHABLE_KEY||'',enrollmentEnabled:requested,studyId:env.STUDY_ID||'',phoneAuthEnabled:env.PHONE_AUTH_ENABLED==='true',publicSiteUrl:env.PUBLIC_SITE_URL||'',consentVersion:env.CONSENT_VERSION||'',informationUrls:{zh:env.INFORMATION_URL_ZH||'',en:env.INFORMATION_URL_EN||'',ur:env.INFORMATION_URL_UR||''}};
 if(!['supabase','cloudbase'].includes(cfg.backendProvider))throw new Error('BACKEND_PROVIDER must be cloudbase or supabase.');
 if(cfg.cloudbaseEnvId&&!A.cloudbaseUrl(cfg))throw new Error('Invalid CLOUDBASE_ENV_ID.');
 if(cfg.backendProvider==='cloudbase'&&cfg.cloudbaseRegion!=='ap-shanghai')throw new Error('This CloudBase deployment is configured for ap-shanghai.');
 if(cfg.cloudbasePublishableKey&&!A.cloudbaseKey(cfg.cloudbasePublishableKey,cfg.cloudbaseEnvId))throw new Error('Only the matching CloudBase anon Publishable Key is allowed. Never use an administrator API Key.');
 if(cfg.studyId&&!/^[a-z0-9][a-z0-9_-]{2,63}$/.test(cfg.studyId))throw new Error('STUDY_ID must be a 3-64 character study identifier.');
 if(cfg.supabasePublishableKey&&!A.publicKey(cfg.supabasePublishableKey))throw new Error('Only a Supabase publishable key or legacy anon key is allowed. Never use service_role / sb_secret_.');
 if(cfg.publicSiteUrl&&!A.httpsUrl(cfg.publicSiteUrl))throw new Error('PUBLIC_SITE_URL must be a public HTTPS URL without query, hash, or credentials.');
 if(requested&&!A.enabled(cfg))throw new Error('Enrollment requires valid provider configuration, a consent version and all three participant-information URLs.');
 if(requested&&cfg.backendProvider==='cloudbase'&&!cfg.studyId)throw new Error('CloudBase enrollment requires STUDY_ID.');
 return cfg;
}
if(require.main===module){const config=makeConfig(process.env);fs.writeFileSync(path.join(__dirname,'../dist/config.js'),'/* Generated public configuration: contains no server secrets. */\nglobalThis.CAMPUS_CONFIG = '+JSON.stringify(config,null,2)+';\n');console.log('Pages configuration prepared: '+(config.enrollmentEnabled?(config.studyId?'connected factorial study':'connected fixed pilot'):'preview (registration disabled)'));}
module.exports={makeConfig};
