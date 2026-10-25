(function(root){
 'use strict';
 class Backend {
  constructor(config,fetcher=globalThis.fetch.bind(globalThis),storage=globalThis.sessionStorage){
   this.config=config;this.fetcher=fetcher;this.storage=storage;this.session=null;this.refreshing=null;
   this.cloudbase=root.CampusAuthCore.provider(config)==='cloudbase';this.pending=null;
   this.base=this.cloudbase?root.CampusAuthCore.cloudbaseUrl(config):config.supabaseUrl;
   this.key=this.cloudbase?'campus-auth:cloudbase:'+config.cloudbaseEnvId:'campus-auth:'+config.supabaseUrl;
   try{this.session=JSON.parse(storage?.getItem(this.key)||'null');}catch{}
  }
  remember(data){
   if(data&&(!data.access_token||!data.refresh_token||!Number.isFinite(data.expires_at||data.expires_in)||!(data.expires_at||data.expires_in)))throw new Error('serviceError');
   this.session=data?{access_token:data.access_token,refresh_token:data.refresh_token,expires_at:data.expires_at||Math.floor(Date.now()/1000)+data.expires_in}:null;
   try{if(this.session)this.storage?.setItem(this.key,JSON.stringify(this.session));else this.storage?.removeItem(this.key);}catch{}
  }
  async request(path,{body,method='POST',authenticated=false,token}={}){
   if(!root.CampusAuthCore.configReady(this.config))throw new Error('notConfigured');
   if(authenticated)token=await this.token();
   const headers={'Content-Type':'application/json'};
   if(!this.cloudbase)headers.apikey=this.config.supabasePublishableKey;
   else if(!token&&this.config.cloudbasePublishableKey)token=this.config.cloudbasePublishableKey;
   if(token)headers.Authorization='Bearer '+token;
   let response;
   try{response=await this.fetcher(this.base.replace(/\/$/,'')+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(20000),credentials:'omit',referrerPolicy:'no-referrer'});}catch{throw new Error('networkError');}
   const text=await response.text();let data;try{data=text?JSON.parse(text):null;}catch{throw new Error('serviceError');}
   if(!response.ok){
    if(this.cloudbase){
     const code=data?.error;
     if(code==='captcha_required')throw new Error('captchaRequired');
     if(['invalid_verification_code','verification_code_expired','invalid_verification_token','verification_expired'].includes(code))throw new Error('invalidOtp');
     if(code==='rate_limit_exceeded')throw new Error('rateLimited');
     if(['invalid_refresh_token','refresh_token_expired'].includes(code)){this.remember(null);throw new Error('sessionExpired');}
    }
    if(response.status===401){this.remember(null);throw new Error('sessionExpired');}
    if(response.status===429)throw new Error('rateLimited');
    if(['otp_expired','otp_disabled','validation_failed'].includes(data?.error_code))throw new Error('invalidOtp');
    if(data?.message==='enrollment_closed')throw new Error('enrollmentClosed');
    const profileErrors={verified_contact_required:'verifiedContactRequired',invalid_height:'invalidHeight',invalid_weight:'invalidWeight',invalid_waist:'invalidWaist',invalid_questionnaire_code:'invalidQuestionnaireCode',questionnaire_code_unavailable:'questionnaireCodeUnavailable',profile_incomplete:'profileIncomplete',legacy_identity_mismatch:'legacyIdentityMismatch',study_unavailable:'studyUnavailable',study_closed:'studyClosed',study_consent_mismatch:'studyConsentMismatch',catalog_version_mismatch:'catalogVersionMismatch',task_conflict:'taskConflict',task_completed:'taskCompleted',admin_required:'adminRequired'};
    if(profileErrors[data?.message])throw new Error(profileErrors[data.message]);
    throw new Error('serviceError'); // Never echo provider responses containing personal data.
   }
   return data;
  }
  async token(){
   if(!this.session?.refresh_token)throw new Error('sessionExpired');
   if(this.session.expires_at>Date.now()/1000+45)return this.session.access_token;
   if(!this.refreshing)this.refreshing=this.request(this.cloudbase?'/auth/v1/token':'/auth/v1/token?grant_type=refresh_token',{body:{refresh_token:this.session.refresh_token,...(this.cloudbase?{grant_type:'refresh_token'}:{})}}).then(data=>{this.remember(data);return data.access_token;}).finally(()=>{this.refreshing=null;});
   return this.refreshing;
  }
  async send(channel,contact,createUser=true){
   if(!root.CampusAuthCore.configReady(this.config)||(createUser&&!root.CampusAuthCore.enabled(this.config)))throw new Error('notConfigured');
   if(channel==='phone'&&!this.config.phoneAuthEnabled)throw new Error('smsUnavailable');
   if(!['email','phone'].includes(channel))throw new Error('invalidContact');
   if(this.cloudbase){
    this.pending=null;
    const data=await this.request('/auth/v1/verification',{body:{[channel==='phone'?'phone_number':'email']:contact,target:createUser?'ANY':'USER'}});
    if(!data?.verification_id||!Number.isFinite(data.expires_in)||data.expires_in<=0)throw new Error('serviceError');
    this.pending={id:data.verification_id,channel,contact,createUser,isUser:data.is_user===true,until:Date.now()+data.expires_in*1000};
    return {}; // Contacts and verification IDs stay in memory, never in session storage.
   }
   return this.request('/auth/v1/otp',{body:{[channel]:contact,create_user:createUser,...(channel==='phone'?{channel:'sms'}:{})}});
  }
  async verify(channel,contact,code){
   if(!/^\d{6}$/.test(code))throw new Error('invalidOtp');
   let data;
   if(this.cloudbase){
    const p=this.pending;
    if(!p||p.channel!==channel||p.contact!==contact||p.until<=Date.now())throw new Error('invalidOtp');
    const verified=await this.request('/auth/v1/verification/verify',{body:{verification_id:p.id,verification_code:code}});
    if(!verified?.verification_token)throw new Error('invalidOtp');
    this.pending=null;
    data=await this.request(p.isUser||!p.createUser?'/auth/v1/signin':'/auth/v1/signup',{body:{verification_token:verified.verification_token,...(!p.isUser&&p.createUser?{[channel==='phone'?'phone_number':'email']:contact}:{})}});
   }else data=await this.request('/auth/v1/verify',{body:{[channel]:contact,token:code,type:channel==='phone'?'sms':'email'}});
   if(!data?.access_token||!data?.refresh_token)throw new Error('invalidOtp');
   this.remember(data);return this.getProfile();
  }
  rpc(name,body){return this.request((this.cloudbase?'/v1/rdb/rest/rpc/':'/rest/v1/rpc/')+name,{body,authenticated:true});}
  getProfile(){return this.rpc('get_my_profile',{});}
  saveProfile(values){return this.rpc('register_participant',values);}
  submit(session){return this.rpc('submit_pilot_task',{p_session_id:session.id,p_basket:session.basket,p_language:session.language,p_catalog_version:session.catalogVersion});}
  getStudy(studyId){return this.rpc('get_or_start_study_task',{p_study_id:studyId});}
  saveStudy(values){return this.rpc('save_study_task',values);}
  overview(studyId,filters={},after=''){return this.rpc('admin_study_overview',{p_study_id:studyId,p_filters:filters,p_after:after,p_limit:50});}
  taskDetail(taskId){return this.rpc('admin_study_task_detail',{p_task_id:taskId});}
  startExport(studyId,dataset,filters={}){return this.rpc('admin_start_export',{p_study_id:studyId,p_dataset:dataset,p_filters:filters});}
  exportPage(id,after=''){return this.rpc('admin_export_page',{p_export_id:id,p_after:after,p_limit:200});}
  async signOut(){try{if(this.session)await this.request(this.cloudbase?'/auth/v1/user/signout':'/auth/v1/logout?scope=local',{body:{},authenticated:true});}finally{this.pending=null;this.remember(null);}}
 }
 root.CampusBackend=Backend;if(typeof module!=='undefined'&&module.exports)module.exports=Backend;
})(globalThis);
