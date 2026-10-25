"""One-time v0.6 integration. Kept as a record; do not re-run after integration."""
from pathlib import Path
import json
root=Path(__file__).resolve().parents[1]
p=root/'dist/app.js'
s=p.read_text(encoding='utf-8')
assert "interfaceVersion:'0.5.0'" in s
s=s.replace("{type,time:new Date().toISOString(),...details}","{id:uid(),type,time:new Date().toISOString(),...details}")
s=s.replace('persist();}\n function toast',"persist();globalThis.CampusEnrollment?.queueSave(state.current,lang);}\n function toast")
s=s.replace("function newSession(config,assignment='manual-demo',status='condition_changed'){", "function newSession(config,assignment='manual-demo',status='condition_changed'){\n  if(connected){toast(t('taskCompleted'));return;}")
s=s.replace("function change(id,delta){if(!globalThis.CampusEnrollment?.ready())return;if(state.current.complete)","function change(id,delta){if(!globalThis.CampusEnrollment?.ready())return;if(state.current.submitting||state.current.commitPending||(connected&&state.current.complete)){toast(t('taskCompleted'));return;}if(state.current.complete)")
s=s.replace("function applySettings(random=false){", "function applySettings(random=false){if(connected)return;")
s=s.replace("if(button){button.disabled=true;button.textContent=t('saving');}try{const receipt", "state.current.submitting=true;if(button){button.disabled=true;button.textContent=t('saving');}try{const receipt")
s=s.replace("}catch(e){if(button){button.disabled=false;button.textContent=t('confirm');}toast(t(e.message==='sessionExpired'?'sessionExpired':'submissionFailed'));return;}log('checkout_completed',{snapshot:C.snapshot(state.current.cart,products,state.current.config)});state.current.complete=true;state.current.completedAt=new Date().toISOString();persist();showReceipt();}", "}catch(e){state.current.submitting=false;state.current.commitPending=!!globalThis.CampusEnrollment?.commitPending();if(button){button.disabled=false;button.textContent=t('confirm');}toast(t(['sessionExpired','taskConflict','taskCompleted','studyClosed'].includes(e.message)?e.message:'submissionFailed'));return;}state.current.complete=true;state.current.submitting=false;state.current.commitPending=false;state.current.completedAt=state.current.serverReceipt?.submittedAt||new Date().toISOString();log('checkout_completed',{snapshot:C.snapshot(state.current.cart,products,state.current.config)});persist();showReceipt();}")
needle='<button class="primary-button" data-action="new-session">${t(\'newExperience\')} ↗</button>'
assert needle in s
s=s.replace(needle,"${connected?'':`"+needle+"`}")
s=s.replace("$('clearCartBtn').addEventListener('click',()=>{if(state.current.complete)","$('clearCartBtn').addEventListener('click',()=>{if(state.current.submitting||state.current.commitPending||(connected&&state.current.complete)){toast(t('taskCompleted'));return;}if(state.current.complete)")
start=s.index(' globalThis.CampusUI=')
end=s.index('\n render();log(',start)
s=s[:start]+''' globalThis.CampusUI={t,lang:()=>lang,escape:esc,toast,identity(profile,task=null){
  closeInfo();$('settingsDialog').close();closeMobileCart();camera?.reset();
  const config=task?.config||profile?.pilot_config;if(profile&&!C.validateConfig(config)){toast(t('serviceError'));return;}
  const current=fresh(profile?config:defaultConfig,task?'server-randomized-factorial':profile?'fixed-pilot-not-randomized':'manual-demo');
  if(task){current.id=task.id;current.startedAt=task.started_at;current.cart=Object.fromEntries(task.basket.map(x=>[x.id,x.quantity]));current.complete=!!task.completed_at;current.completedAt=task.completed_at;current.studyId=task.study_id;if(current.complete)current.serverReceipt={sessionId:task.id,submittedAt:task.completed_at};}
  state={version:1,lang,current,history:[]};category='all';search='';rackView='overview';$('searchInput').value='';$('rackViewport').scrollLeft=0;render();
 }};'''+s[end:]
s=s.replace("interfaceVersion:'0.5.0'", "interfaceVersion:'0.6.0'")
p.write_text(s,encoding='utf-8')
p=root/'dist/index.html';s=p.read_text(encoding='utf-8')
s=s.replace('<script src="rack-text.js" defer></script>','<script src="rack-text.js" defer></script>\n  <script src="study-text.js" defer></script>')
s=s.replace('<script src="app.js" defer></script>','<script src="study-client.js" defer></script>\n  <script src="app.js" defer></script>')
s=s.replace('<aside class="basket-panel"','<aside class="basket-panel"',1)
s=s.replace('<div class="basket-items" id="basketItems">','<div id="studySync" class="study-sync" hidden><p id="studySaveStatus" role="status" aria-live="polite"></p><button type="button" id="retryStudySave" class="text-button" data-i18n="retrySave" hidden></button></div><div class="basket-items" id="basketItems">')
s=s.replace('PROTOTYPE 0.5','PROTOTYPE 0.6')
s=s.replace('</footer>','<a href="admin.html" data-i18n="researchAdmin" class="text-button">研究管理</a></footer>')
p.write_text(s,encoding='utf-8')
p=root/'dist/config.js';s=p.read_text(encoding='utf-8').replace("enrollmentEnabled: false,","enrollmentEnabled: false,\n  studyId: '',")
p.write_text(s,encoding='utf-8')
for name in ['package.json','package-lock.json']:
 p=root/name;obj=json.loads(p.read_text(encoding='utf-8'));obj['version']='0.6.0'
 if '' in obj.get('packages',{}):obj['packages']['']['version']='0.6.0'
 p.write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
p=root/'tools/check.cjs';s=p.read_text(encoding='utf-8').replace("'rack-text.js','data.js'","'rack-text.js','study-text.js','data.js'");p.write_text(s,encoding='utf-8')
p=root/'tools/build-standalone.cjs';s=p.read_text(encoding='utf-8').replace("'rack-text.js','data.js'","'rack-text.js','study-text.js','data.js'").replace("'camera.js','app.js'","'camera.js','study-client.js','app.js'");p.write_text(s,encoding='utf-8')
