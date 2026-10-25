const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const A=require('../dist/auth-core.js');

// Exercise the real event handlers with an in-memory DOM and an SMS stub.
// No contact details are transmitted and no provider configuration is changed.
function enrollment(){
 const nodes=new Map(),listeners={},calls=[];let lang='zh';
 const node=()=>({value:'',textContent:'',disabled:false,hidden:false,querySelectorAll:()=>[],addEventListener(){}});
 for(const id of ['enrollmentDialog','enrollmentHeading','enrollmentLanguage','enrollmentContent','enrollmentMode','enrollmentNotice','accountBtn','entryButton','settingsBtn','studySync','studySaveStatus','retryStudySave'])nodes.set(id,node());
 let html='',dynamic=[];
 Object.defineProperty(nodes.get('enrollmentContent'),'innerHTML',{get:()=>html,set:value=>{
  for(const id of dynamic)nodes.delete(id);dynamic=[];html=value;
  for(const tag of value.matchAll(/<(?:input|button|p|output)[^>]*\bid="([^"]+)"[^>]*>/g)){
   const el=node();el.value=tag[0].match(/\bvalue="([^"]*)"/)?.[1]||'';
   nodes.set(tag[1],el);dynamic.push(tag[1]);
  }
 }});
 const dialog=nodes.get('enrollmentDialog');dialog.open=false;dialog.showModal=()=>dialog.open=true;dialog.close=()=>dialog.open=false;
 const document={getElementById:id=>nodes.get(id)||null,querySelector:()=>node(),addEventListener:(name,fn)=>listeners[name]=fn};
 const cfg={supabaseUrl:'https://example.supabase.co',supabasePublishableKey:'sb_publishable_TEST_PUBLIC',enrollmentEnabled:true,phoneAuthEnabled:true,consentVersion:'test-v1',informationUrls:{zh:'https://example.org/zh',en:'https://example.org/en',ur:'https://example.org/ur'}};
 class Backend{constructor(){this.session=null;}async send(channel,contact){calls.push(['send',channel,contact]);}async verify(channel,contact,code){calls.push(['verify',channel,contact,code]);return null;}}
 const context={CampusAuthCore:A,CAMPUS_CONFIG:cfg,CampusBackend:Backend,CampusUI:{t:key=>context.CAMPUS_TEXT[lang][key]||key,escape:value=>String(value).replaceAll('&','&amp;').replaceAll('"','&quot;'),lang:()=>lang,identity(){},toast(){}},document,location:{protocol:'https:',origin:'https://example.org',pathname:'/'},fetch(){throw new Error('No network allowed');},sessionStorage:{},setInterval(){},window:{addEventListener(){}},CAMPUS_DATA:{version:'test'}};
 vm.createContext(context);
 for(const file of ['i18n.js','urdu.js','enrollment-text.js','enrollment.js'])vm.runInContext(fs.readFileSync(require.resolve('../dist/'+file),'utf8'),context);
 const click=(id,channel)=>listeners.click({target:{closest:selector=>selector==='[data-channel]'?(channel?{dataset:{channel}}:null):selector==='button'?{id}:null}});
 const submit=async id=>{listeners.submit({target:{id},preventDefault(){}});await new Promise(setImmediate);};
 return {nodes,calls,click,submit,language(value){lang=value;context.CampusEnrollment.refresh();}};
}

test('SMS send and verify use the same combined number after the OTP screen is rendered',async()=>{
 const ui=enrollment();ui.click('accountBtn');ui.click(null,'phone');
 assert.equal(ui.nodes.get('countryCodeInput').value,'+92');
 ui.nodes.get('contactInput').value='۰۳۰۰۱۲۳۴۵۶۷';
 await ui.submit('contactForm');
 assert.deepEqual(ui.calls,[['send','phone','+923001234567']]);
 assert.ok(ui.nodes.has('otpInput'));
 ui.nodes.get('otpInput').value='۱۲۳۴۵۶';await ui.submit('otpForm');
 assert.deepEqual(ui.calls[1],['verify','phone','+923001234567','123456']);
});

test('country code and phone survive language, email and change-contact round trips',async()=>{
 const ui=enrollment();ui.click('accountBtn');ui.nodes.get('contactInput').value='synthetic@example.org';ui.click(null,'phone');
 ui.nodes.get('countryCodeInput').value='+86';ui.nodes.get('contactInput').value='13800138000';
 ui.language('ur');assert.equal(ui.nodes.get('countryCodeInput').value,'+86');assert.equal(ui.nodes.get('contactInput').value,'13800138000');
 ui.click(null,'email');assert.equal(ui.nodes.get('contactInput').value,'synthetic@example.org');ui.click(null,'phone');
 await ui.submit('contactForm');assert.deepEqual(ui.calls[0],['send','phone','+8613800138000']);
 ui.click('changeContactBtn');assert.equal(ui.nodes.get('countryCodeInput').value,'+86');assert.equal(ui.nodes.get('contactInput').value,'13800138000');
});
