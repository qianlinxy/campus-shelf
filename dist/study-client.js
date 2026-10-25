(function(root){
 'use strict';
 const canonical=v=>JSON.stringify(v,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
 function validate(task,products,core){
  if(!task||!core.validateConfig(task.config)||task.catalog_version!==root.CAMPUS_DATA.version||task.layout_version!==core.LAYOUT_VERSION||task.rules_version!==core.RULES_VERSION)throw new Error('catalogVersionMismatch');
  if(!Array.isArray(task.products)||canonical(task.products)!==canonical(products))throw new Error('catalogVersionMismatch');
  return task;
 }
 class StudyClient {
  constructor(backend,task,onStatus=()=>{}){this.backend=backend;this.task=task;this.onStatus=onStatus;this.pending=null;this.inflight=null;this.retryRequest=null;this.timer=null;this.blocked=false;}
  queue(current,language){
   if(this.task.completed_at||this.blocked)return;
   this.pending={basket:Object.entries(current.cart).map(([id,quantity])=>({id,quantity})),language,events:(current.events||[]).filter(e=>!this.acked?.has(e.id))};
   clearTimeout(this.timer);this.onStatus('pending');this.timer=setTimeout(()=>this.flush().catch(()=>{}),700);
  }
  async flush(){
   clearTimeout(this.timer);
   if(this.inflight){await this.inflight;return this.flush();}
   if(this.blocked)throw new Error('taskConflict');
   if(!this.retryRequest&&!this.pending)return this.task;
   this.inflight=this.drain();
   try{return await this.inflight;}finally{this.inflight=null;}
  }
  async drain(){
   while(this.retryRequest||this.pending){
    if(!this.retryRequest){const p=this.pending;this.pending=null;this.retryRequest={p_task_id:this.task.id,p_revision:this.task.revision,p_request_id:crypto.randomUUID(),p_basket:p.basket,p_language:p.language,p_events:p.events.filter(e=>!this.acked?.has(e.id)).slice(0,50),p_complete:false};
     const remaining=p.events.filter(e=>!this.retryRequest.p_events.some(x=>x.id===e.id));if(remaining.length)this.pending={...p,events:remaining};}
    this.onStatus('saving');
    try{
     this.task=await this.backend.saveStudy(this.retryRequest);this.acked||=new Set();for(const e of this.retryRequest.p_events)this.acked.add(e.id);this.retryRequest=null;
    }catch(e){
     if(['taskConflict','taskCompleted','sessionExpired'].includes(e.message)){this.blocked=true;this.onStatus(e.message==='sessionExpired'?'sessionExpired':'conflict');}
     else this.onStatus('error');
     throw e;
    }
   }
   this.onStatus('saved');return this.task;
  }
  async complete(current,language){
   if(this.completionRequest){this.task=await this.backend.saveStudy(this.completionRequest);this.completionRequest=null;this.onStatus('completed');return this.task;}
   this.queue(current,language);await this.flush();
   if(this.task.completed_at)return this.task;
   // Server accepts a retry of the identical completed basket if the response was lost.
   this.completionRequest={p_task_id:this.task.id,p_revision:this.task.revision,p_request_id:crypto.randomUUID(),p_basket:Object.entries(current.cart).map(([id,quantity])=>({id,quantity})),p_language:language,p_events:[],p_complete:true};
   this.task=await this.backend.saveStudy(this.completionRequest);this.completionRequest=null;
   this.onStatus('completed');return this.task;
  }
  dispose(){clearTimeout(this.timer);this.blocked=true;this.pending=null;}
 }
 const api={StudyClient,validate,canonical};root.CampusStudy=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
