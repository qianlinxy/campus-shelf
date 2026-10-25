(function(){
 'use strict';
 const A=globalThis.CampusAuthCore,cfg=globalThis.CAMPUS_CONFIG||{},$=id=>document.getElementById(id),ui=globalThis.CampusUI;
 const connected=location.protocol!=='file:'&&A.enabled(cfg),studyMode=connected&&!!cfg.studyId;
 let backend;
 try{backend=new CampusBackend(cfg,fetch.bind(globalThis),sessionStorage);}catch{backend=new CampusBackend(cfg,fetch.bind(globalThis),null);}
 let profile=null,step='login',channel='email',contact='',fields={},busy=false,message='',sentAt=0,qrSvg='',authEpoch=0,studyClient=null,syncStatus='';
 let emailContact='',phoneCountryCode='+92',phoneNumber='';
 const t=k=>ui.t(k),esc=ui.escape;
 const languages=()=>`<span class="language-switch" role="group" data-language-group aria-label="${esc(t('language'))}" dir="ltr">${[['zh','中文'],['en','English'],['ur','اردو']].map(([code,label])=>`<button type="button" data-language="${code}" lang="${code==='zh'?'zh-CN':code}" dir="${code==='ur'?'rtl':'ltr'}" aria-pressed="${ui.lang()===code}">${label}</button>`).join('')}</span>`;
 const button=(id,label,klass='primary-button')=>`<button type="button" id="${id}" class="${klass}">${t(label)}</button>`;
 const inputValue=id=>$(id)?.value||'';
 function rememberFields(){if(step==='profile')fields={dob:inputValue('dobInput'),gender:inputValue('genderInput'),university:inputValue('universityInput'),heightCm:inputValue('heightInput'),weightKg:inputValue('weightInput'),waistCm:inputValue('waistInput'),questionnaireCode:inputValue('questionnaireCodeInput'),consent:$('consentInput')?.checked};if(step==='login'&&$('contactInput')){if(channel==='email')emailContact=inputValue('contactInput');else{phoneCountryCode=inputValue('countryCodeInput');phoneNumber=inputValue('contactInput');}}}
 function contactFields(){
  const disabled=connected?'':'disabled';
  if(channel==='email')return `<label class="form-field" for="contactInput">${t('email')}<input id="contactInput" type="email" dir="ltr" autocomplete="email" maxlength="254" placeholder="${t('emailPlaceholder')}" value="${esc(emailContact)}" required ${disabled}></label>`;
  return `<div class="phone-fields" dir="ltr"><label class="form-field" for="countryCodeInput">${t('countryCode')}<input id="countryCodeInput" name="countryCode" type="tel" inputmode="tel" dir="ltr" autocomplete="tel-country-code" maxlength="8" placeholder="+92" value="${esc(phoneCountryCode)}" aria-describedby="phoneHint" required ${disabled}></label><label class="form-field" for="contactInput">${t('phoneNumber')}<input id="contactInput" name="phoneNumber" type="tel" inputmode="tel" dir="ltr" autocomplete="tel-national" maxlength="32" placeholder="${t('phonePlaceholder')}" value="${esc(phoneNumber)}" aria-describedby="phoneHint" required ${disabled}></label></div><p id="phoneHint" class="field-hint">${t('phoneHint')}</p>`;
 }
 function existingFields(p){return {dob:p.dob,gender:p.gender,university:p.university,heightCm:p.height_cm??'',weightKg:p.weight_kg??'',waistCm:p.waist_cm??'',questionnaireCode:p.questionnaire_code??''};}
 function measurementsForm(){
  const values=[['height','heightCm','cm'],['weight','weightKg','kg'],['waist','waistCm','cm']];
  return `<fieldset class="measurements-fieldset"><legend>${t('measurementsTitle')}</legend><p id="measurementHint">${t('measurementsHint')}</p><div class="measurements-grid">${values.map(([key,field,unit])=>`<label class="form-field" for="${key}Input">${t(key)} (<bdi dir="ltr">${unit}</bdi>)<input id="${key}Input" name="${field}" type="text" inputmode="decimal" dir="ltr" pattern="[0-9۰-۹٠-٩]{1,3}([.٫][0-9۰-۹٠-٩])?" maxlength="5" value="${esc(fields[field]??'')}" aria-describedby="measurementHint" autocomplete="off" required></label>`).join('')}</div></fieldset><label class="form-field" for="questionnaireCodeInput">${t('questionnaireCode')}<input id="questionnaireCodeInput" name="questionnaireCode" type="text" dir="auto" maxlength="80" value="${esc(fields.questionnaireCode||'')}" aria-describedby="questionnaireHint" autocomplete="off" autocapitalize="off" spellcheck="false"></label><p id="questionnaireHint" class="field-hint">${t('questionnaireHint')}</p>`;
 }
 function render(){
  const dialog=$('enrollmentDialog');if(!dialog.open)return;
  $('enrollmentHeading').textContent=t(step==='qr'?'qrTitle':step==='profile'?'profileTitle':step==='otp'?'otpTitle':step==='account'?'profileOnly':'loginTitle');
  $('enrollmentLanguage').innerHTML=languages();
  const notice=!connected?`<p class="enrollment-notice">${t(step==='profile'?'profilePreview':'previewNotice')}</p>`:'';
  let html='';
  if(step==='login'){
   html=`<p>${t('loginIntro')}</p>${notice}<form id="contactForm"><div class="auth-tabs" role="group" aria-label="${t('contact')}"><button type="button" data-channel="email" aria-pressed="${channel==='email'}">${t('email')}</button><button type="button" data-channel="phone" aria-pressed="${channel==='phone'}">${t('phone')}</button></div>${contactFields()}${channel==='phone'&&!cfg.phoneAuthEnabled?`<p class="enrollment-notice">${t('smsUnavailable')}</p>`:''}<button class="primary-button wide" type="submit" ${!connected||(channel==='phone'&&!cfg.phoneAuthEnabled)?'disabled':''}>${t('sendOtp')}</button></form><div class="auth-secondary">${button('previewProfileBtn','previewProfile','text-button')}${!connected?button('previewBrowseBtn','previewBrowse','text-button'):''}</div>`;
  }else if(step==='otp'){
   html=`<p>${t('otpBody')}</p><form id="otpForm"><label class="form-field">${t('otp')}<input id="otpInput" type="text" inputmode="numeric" autocomplete="one-time-code" dir="ltr" maxlength="6" pattern="[0-9۰-۹٠-٩]{6}" required></label><button type="submit" class="primary-button wide">${t('verify')}</button></form><div class="auth-secondary">${button('resendBtn','resend','text-button')}${button('changeContactBtn','changeContact','text-button')}</div>`;
  }else if(step==='profile'){
   const preview=!connected||!backend.session;
   html=`<p>${t('profileIntro')}</p>${preview?`<p class="enrollment-notice">${t('profilePreview')}</p>`:''}<form id="profileForm"><div class="profile-grid"><label class="form-field">${t('dob')}<input id="dobInput" type="date" dir="ltr" min="1900-01-01" max="${A.pakistanToday()}" value="${esc(fields.dob||'')}" required></label><label class="form-field">${t('age')}<output id="ageOutput" class="age-output">—</output></label></div><label class="form-field">${t('gender')}<select id="genderInput" required><option value="">${t('choose')}</option>${A.genders.map(g=>`<option value="${g}" ${fields.gender===g?'selected':''}>${t(g)}</option>`).join('')}</select></label><label class="form-field">${t('university')}<input id="universityInput" list="universityOptions" maxlength="160" minlength="2" placeholder="${t('universityHint')}" value="${esc(fields.university||'')}" autocomplete="organization" required></label><datalist id="universityOptions"><option value="University of the Punjab"><option value="University of Karachi"><option value="Quaid-i-Azam University"><option value="University of Peshawar"><option value="University of Agriculture Faisalabad"><option value="National University of Sciences and Technology"><option value="Lahore College for Women University"><option value="COMSATS University Islamabad"></datalist>${measurementsForm()}${!preview?`<a class="information-link" href="${esc(cfg.informationUrls[ui.lang()])}" target="_blank" rel="noopener noreferrer">${t('readInformation')} ↗</a><label class="consent-check"><input id="consentInput" type="checkbox" required ${fields.consent?'checked':''}><span>${t('consentLabel')}</span></label><button type="submit" class="primary-button wide">${t('saveProfile')}</button>`:`<p>${t('previewNoSave')}</p>`}</form><div class="auth-secondary">${button('backLoginBtn','backLogin','text-button')}${!connected?button('previewBrowseBtn','previewBrowse','text-button'):''}</div>`;
  }else if(step==='account'){
   html=`<p class="enrollment-notice">${t('signedIn')}</p><dl class="profile-summary"><dt>${t('participant')}</dt><dd class="participant-code" dir="ltr">${esc(profile.participant_id)}</dd><dt>${t('age')}</dt><dd>${A.age(profile.dob)} ${t('years')}</dd><dt>${t('gender')}</dt><dd>${t(profile.gender)}</dd><dt>${t('university')}</dt><dd>${esc(profile.university)}</dd>${[["height","height_cm","cm"],["weight","weight_kg","kg"],["waist","waist_cm","cm"]].map(([label,key,unit])=>`<dt>${t(label)}</dt><dd><bdi dir="ltr">${esc(profile[key])} ${unit}</bdi></dd>`).join('')}<dt>${t('questionnaireCode')}</dt><dd>${profile.questionnaire_code?esc(profile.questionnaire_code):t('questionnairePending')}</dd>${profile.questionnaire_code?`<dd>${t('matchPending')}</dd>`:''}</dl><p>${t('signOutNote')}</p><div class="dialog-actions">${button('signOutBtn','signOut','secondary-button')}${button('previewBrowseBtn','browse')}</div>`;
  }else if(step==='qr'){
   const current=location.protocol==='https:'?location.origin+location.pathname:'';
   const url=A.qrUrl(cfg,current);
   html=`<p>${t('qrBody')}</p>`;qrSvg='';
   if(url&&url.length<=600){try{const qr=qrcode(0,'M');qr.addData(url);qr.make();qrSvg=qr.createSvgTag({cellSize:5,margin:20,scalable:true});html+=`<div class="entry-qr" aria-label="${t('qrTitle')}">${qrSvg}</div><a class="plain-code qr-url" dir="ltr" href="${esc(url)}">${esc(url)}</a><div class="dialog-actions">${button('downloadQrBtn','qrDownload')}</div>`;}catch{html+=`<p class="enrollment-notice">${t('qrUnavailable')}</p>`;}}
   else html+=`<p class="enrollment-notice">${t('qrUnavailable')}</p>`;
  }
  $('enrollmentContent').innerHTML=html+`<p id="authMessage" class="auth-message" role="status" aria-live="polite">${esc(message)}</p>`;
  updateAge();updateResend();
 }
 function updateAge(){const el=$('ageOutput');if(el){const years=A.age(inputValue('dobInput'));el.textContent=years===null?'—':`${years} ${t('years')}`;}}
 function updateResend(){const el=$('resendBtn');if(!el)return;const wait=Math.max(0,60-Math.floor((Date.now()-sentAt)/1000));el.disabled=wait>0||busy;el.textContent=wait?`${wait} ${t('seconds')}`:t('resend');}
 function show(next){rememberFields();step=next;message='';if(!$('enrollmentDialog').open)$('enrollmentDialog').showModal();render();}
 function feedback(text){message=text;if($('authMessage'))$('authMessage').textContent=text;}
 async function run(label,fn){if(busy)return;busy=true;const epoch=authEpoch;feedback(t(label));$('enrollmentContent').querySelectorAll('button,input,select').forEach(el=>el.disabled=true);try{await fn();}catch(e){if(epoch!==authEpoch)return;if(e.message==='sessionExpired'){profile=null;ui.identity(null);step='login';}message=t(e.message in CAMPUS_TEXT.en?e.message:'serviceError');render();}finally{busy=false;if(epoch===authEpoch){$('enrollmentContent').querySelectorAll('button,input,select').forEach(el=>el.disabled=false);if(step==='login'&&(!connected||(channel==='phone'&&!cfg.phoneAuthEnabled)))render();updateResend();}}}
 async function send(){
  if(!connected){feedback(t('notConfigured'));return;}
  rememberFields();
  if(channel==='email'){contact=emailContact.trim();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)){feedback(t('invalidContact'));return;}}
  else try{contact=A.phone(phoneNumber,phoneCountryCode);phoneCountryCode=A.dialCode(phoneCountryCode);}catch(e){feedback(t(e.message));return;}
  await run('sending',async()=>{await backend.send(channel,contact);sentAt=Date.now();show('otp');});
 }
 function validateProfile(p){if(p&&p.catalog_version!==CAMPUS_DATA.version)throw new Error('catalogVersionMismatch');if(p&&!CampusShelfCore.validateConfig(p.pilot_config))throw new Error('serviceError');return p;}
 function syncMessage(status){syncStatus=status;const key={pending:'studyPending',saving:'studySaving',saved:'studySaved',error:'studyError',conflict:'studyConflict',completed:'studyCompleted',sessionExpired:'sessionExpired'}[status];if($('studySaveStatus'))$('studySaveStatus').textContent=key?t(key):'';if($('retryStudySave'))$('retryStudySave').hidden=!['error','pending'].includes(status);}
 async function accept(p){
  const epoch=authEpoch;profile=validateProfile(p);fields={};feedback('');
  if(p&&A.completeProfile(p)){
   let task=null;
   if(studyMode){task=CampusStudy.validate(await backend.getStudy(cfg.studyId),CAMPUS_DATA.products,CampusShelfCore);if(epoch!==authEpoch)return;studyClient?.dispose();studyClient=new CampusStudy.StudyClient(backend,task,syncMessage);}
   ui.identity(p,task);$('enrollmentDialog').close();ui.toast(t(task?'studyRestored':'profileSaved'));if(task)syncMessage(task.completed_at?'completed':'saved');
  }else{if(p)fields=existingFields(p);show('profile');}updateBanner();
 }
 function updateBanner(){
  $('enrollmentMode').textContent=t(studyMode?'studyMode':connected?'pilotMode':'previewMode');$('enrollmentNotice').textContent=t(studyMode?'studyNotice':connected?'connectedNotice':'previewNotice');
  $('accountBtn').textContent=t(A.completeProfile(profile)?'signedIn':'account');$('entryButton').textContent=t(A.completeProfile(profile)?'browse':'entryButton');
  if(connected){document.querySelector('.prototype-pill').textContent=t('pilot');document.querySelector('[data-i18n="localOnly"]').textContent=t('serverActivity');}
  $('settingsBtn').hidden=connected; // Controls in a public prototype are not an authorization mechanism.
  $('studySync').hidden=!studyMode;syncMessage(syncStatus);
 }
 document.addEventListener('submit',e=>{
  if(e.target.id==='contactForm'){e.preventDefault();send();}
  if(e.target.id==='otpForm'){e.preventDefault();const code=A.digits(inputValue('otpInput'));run('verifying',async()=>{const p=await backend.verify(channel,contact,code);await accept(p);});}
  if(e.target.id==='profileForm'){e.preventDefault();if(!connected||!backend.session)return;rememberFields();let values;try{values=A.profile({...fields,consentVersion:cfg.consentVersion});}catch(err){feedback(t(err.message));return;}run('saving',async()=>accept(await backend.saveProfile(values)));}
 });
 document.addEventListener('input',e=>{if(e.target.id==='dobInput')updateAge();});
 document.addEventListener('click',e=>{
  const channelBtn=e.target.closest('[data-channel]');if(channelBtn&&!busy){rememberFields();channel=channelBtn.dataset.channel;message='';render();return;}
  const id=e.target.closest('button')?.id;
  if(id==='accountBtn')show(A.completeProfile(profile)?'account':backend.session&&connected?'profile':'login');
  if(id==='entryButton'){if(A.completeProfile(profile)){if(studyMode&&!studyClient)run('saving',()=>accept(profile));else $('shelf').scrollIntoView({behavior:'smooth'});}else show(backend.session&&connected?'profile':'login');}
  if(id==='qrBtn')show('qr');
  if(id==='closeEnrollmentBtn'&&!busy)$('enrollmentDialog').close();
  if(id==='previewProfileBtn'){fields={};show('profile');}
  if(id==='backLoginBtn'){fields={};show(backend.session&&connected?'profile':'login');}
  if(id==='previewBrowseBtn')$('enrollmentDialog').close();
  if(id==='changeContactBtn')show('login');
  if(id==='resendBtn')run('sending',async()=>{await backend.send(channel,contact);sentAt=Date.now();message='';render();});
  if(id==='signOutBtn')run('saving',async()=>{if(studyClient&&!studyClient.blocked&&!studyClient.task.completed_at)await studyClient.flush();try{await backend.signOut();}finally{authEpoch++;studyClient?.dispose();studyClient=null;profile=null;contact='';emailContact='';phoneCountryCode='+92';phoneNumber='';fields={};ui.identity(null);show('login');updateBanner();}});
  if(id==='retryStudySave')studyClient?.flush().catch(()=>{});
  if(id==='downloadQrBtn'&&qrSvg){const url=URL.createObjectURL(new Blob([qrSvg],{type:'image/svg+xml'}));const a=document.createElement('a');a.href=url;a.download='campus-shelf-entry-qr.svg';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 });
 $('enrollmentDialog').addEventListener('cancel',e=>{if(busy)e.preventDefault();});
 $('enrollmentDialog').addEventListener('close',()=>{rememberFields();fields={};$('enrollmentContent').innerHTML='';});
 globalThis.CampusEnrollment={
  connected,studyMode,refresh(){rememberFields();render();updateBanner();},ready(){if(!connected)return true;if(studyClient?.blocked){ui.toast(t('studyConflict'));return false;}if(A.completeProfile(profile)&&backend.session&&(!studyMode||studyClient))return true;if(!backend.session)profile=null;updateBanner();show(backend.session?'profile':'login');if(profile)feedback(t(studyMode?'studyUnavailable':'profileIncomplete'));return false;},
  queueSave(task,language){if(studyClient?.task.id===task.id&&!studyClient.completionRequest)studyClient.queue(task,language);},commitPending(){return !!studyClient?.completionRequest;},
  async submitTask(task,language){if(!connected)return null;if(!A.completeProfile(profile))throw new Error('profileIncomplete');try{if(studyMode){if(!studyClient||studyClient.task.id!==task.id)throw new Error('taskConflict');const saved=await studyClient.complete(task,language);return {session_id:saved.id,submitted_at:saved.completed_at,result:saved.result};}return await backend.submit({id:task.id,basket:Object.entries(task.cart).map(([id,quantity])=>({id,quantity})),language,catalogVersion:CAMPUS_DATA.version});}catch(e){if(e.message==='sessionExpired'){profile=null;updateBanner();show('login');}throw e;}}
 };
 setInterval(updateResend,1000);updateBanner();
 const restoreEpoch=authEpoch;
 if(connected&&backend.session)backend.getProfile().then(async p=>{if(authEpoch!==restoreEpoch)return;if(p)await accept(p);updateBanner();}).catch(e=>{if(authEpoch!==restoreEpoch)return;if(e.message==='sessionExpired'){backend.remember(null);profile=null;ui.identity(null);}updateBanner();show('login');feedback(t(e.message in CAMPUS_TEXT.en?e.message:'serviceError'));});
 setInterval(()=>{if(studyClient&&!studyClient.blocked&&(studyClient.pending||studyClient.retryRequest))studyClient.flush().catch(()=>{});},10000);
 window.addEventListener('online',()=>studyClient?.flush().catch(()=>{}));
 window.addEventListener('beforeunload',e=>{if(studyClient&&(studyClient.pending||studyClient.retryRequest||studyClient.inflight)){e.preventDefault();e.returnValue='';}});
})();
