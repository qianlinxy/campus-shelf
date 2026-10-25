(function(root){
  'use strict';
  const RULES_VERSION='prototype-traffic-lights-v1';
  const METRICS=['kcal','fat','sugar','salt','upf'];
  const LAYOUT_VERSION='physical-rack-v5',LAYOUTS=['alternatives-eye','targets-eye','category','popularity'];
  const rackConfig=c=>c?.schemaVersion===2;
  function validateConfig(c){
    if(rackConfig(c))return Number.isInteger(c.budget)&&c.budget>=100&&c.budget<=5000&&[20,25,30].includes(c.markupPercent)&&LAYOUTS.includes(c.layoutMode)&&['upf','upf-or-high'].includes(c.placementRule)&&['price','position','labels','upf'].every(k=>typeof c[k]==='boolean')&&c.position===(c.layoutMode==='alternatives-eye');
    return !!c && Number.isInteger(c.budget) && c.budget>=100 && c.budget<=5000 &&
      Number.isInteger(c.discountPercent) && c.discountPercent>=5 && c.discountPercent<=40 &&
      ['price','position','labels','upf'].every(k=>typeof c[k]==='boolean');
  }
  function classify(product,metric){
    if(metric==='upf'){
      if(product.nova===1)return 'green';
      if(product.nova===2||product.nova===3)return 'amber';
      if(product.nova===4)return 'red';
      return 'unknown';
    }
    const value=product[metric];
    if(typeof value!=='number'||!Number.isFinite(value)||value<0)return 'unknown';
    const drink=product.unit==='ml';
    const bounds={kcal:drink?[20,40]:[150,300],fat:drink?[1.5,8.75]:[3,17.5],sugar:drink?[2.5,11.25]:[5,22.5],salt:drink?[.3,.75]:[.3,1.5]}[metric];
    if(!bounds)return 'unknown';
    return value<=bounds[0]?'green':value<=bounds[1]?'amber':'red';
  }
  function priceMinor(p,c){if(rackConfig(c))return Math.round(p.price*100*(c.price&&p.nova===4?1+c.markupPercent/100:1));return Math.round(p.price*100*(c.price&&p.eligible?1-c.discountPercent/100:1));}
  function targetProduct(p,rule='upf-or-high'){return p.nova===4||(rule==='upf-or-high'&&['kcal','fat','sugar','salt'].some(m=>classify(p,m)==='red'));}
  function fixturePlanogram(products,c,minColumns=16){
    const mode=rackConfig(c)?c.layoutMode:(c.position?'alternatives-eye':'category');
    const rule=rackConfig(c)?c.placementRule:'upf-or-high';
    // Four physical tiers; at most 2 tiers per target/comparator group. Widen if required.
    const canonical=[...products].sort((a,b)=>(a.catalogOrder??products.indexOf(a))-(b.catalogOrder??products.indexOf(b)));
    const target=canonical.filter(p=>targetProduct(p,rule)),alternatives=canonical.filter(p=>!targetProduct(p,rule)&&p.eligible===true),neutral=canonical.filter(p=>!target.includes(p)&&!alternatives.includes(p));
    const cols=Math.max(minColumns,Math.ceil(products.length/4),Math.ceil(Math.max(target.length,alternatives.length,neutral.length)/2));
    const grid=Array.from({length:4},()=>Array(cols).fill(null));
    const put=(list,tiers)=>{let i=0;for(const tier of tiers){const free=grid[tier].flatMap((p,col)=>p?[]:[col]),n=Math.min(free.length,list.length-i),start=Math.floor((free.length-n)/2);for(const col of free.slice(start,start+n))grid[tier][col]=list[i++];}if(i!==list.length)throw new Error('Planogram capacity exceeded');};
    if(mode==='alternatives-eye'){put(alternatives,[1,0]);put(target,[3,2]);put(neutral,[0,1,2,3]);}
    else if(mode==='targets-eye'){put(target,[1,0]);put(alternatives,[3,2]);put(neutral,[2,3,0,1]);}
    else{
      const categoryOrder=['drinks','snacks','fresh','meals'];
      const categorySorted=[...canonical].sort((a,b)=>categoryOrder.indexOf(a.category)-categoryOrder.indexOf(b.category)||canonical.indexOf(a)-canonical.indexOf(b));
      const list=mode==='popularity'?[...canonical].sort((a,b)=>(a.popularityRank??999)-(b.popularityRank??999)||canonical.indexOf(a)-canonical.indexOf(b)):categorySorted;
      const tiers=mode==='popularity'?[1,2,0,3]:[0,1,2,3],batch=Math.ceil(list.length/4);
      tiers.forEach((tier,i)=>put(list.slice(i*batch,(i+1)*batch),[tier]));
    }
    return {version:'physical-rack-v2',mode,placementRule:rule,columns:cols,facingsPerSku:2,tiers:grid.map((row,tier)=>({tier,slots:row.map((p,column)=>({id:p?.id??null,tier,column,facings:p?2:0}))}))};
  }
  function coldCabinetPlanogram(products,c){
    const mode=rackConfig(c)?c.layoutMode:(c.position?'alternatives-eye':'category'),rule=rackConfig(c)?c.placementRule:'upf-or-high';
    const canonical=[...products].sort((a,b)=>(a.catalogOrder??products.indexOf(a))-(b.catalogOrder??products.indexOf(b)));
    const chilled=canonical.filter(p=>p.displayZone==='fridge'),frozen=canonical.filter(p=>p.displayZone==='freezer');
    const cols=Math.max(4,Math.ceil(chilled.length/3),frozen.length),grid=Array.from({length:4},()=>Array(cols).fill(null));
    const put=(list,tiers)=>{let i=0;for(const tier of tiers){const free=grid[tier].flatMap((p,col)=>p?[]:[col]),n=Math.min(free.length,list.length-i),start=Math.floor((free.length-n)/2);for(const col of free.slice(start,start+n))grid[tier][col]=list[i++];}if(i!==list.length)throw new Error('Cold compartment capacity exceeded');};
    if(['alternatives-eye','targets-eye'].includes(mode)){
      const targets=chilled.filter(p=>targetProduct(p,rule)),alternatives=chilled.filter(p=>!targetProduct(p,rule)&&p.eligible),neutral=chilled.filter(p=>!targets.includes(p)&&!alternatives.includes(p));
      // Only the three chilled levels participate in placement changes. Overflow
      // shares the upper tier; the freezer is fixed in every experimental arm.
      if(mode==='alternatives-eye'){put(alternatives,[1,0,2]);put(targets,[2,0,1]);}
      else{put(targets,[1,0,2]);put(alternatives,[2,0,1]);}
      put(neutral,[0,1,2]);
    }else{
      const categoryOrder=['drinks','snacks','fresh','meals'];
      const list=[...chilled].sort(mode==='popularity'?(a,b)=>(a.popularityRank??999)-(b.popularityRank??999):(a,b)=>categoryOrder.indexOf(a.category)-categoryOrder.indexOf(b.category));
      const order=mode==='popularity'?[1,2,0]:[0,1,2],batch=Math.ceil(list.length/3);order.forEach((tier,i)=>put(list.slice(i*batch,(i+1)*batch),[tier]));
    }
    put(frozen,[3]);
    return {version:LAYOUT_VERSION,mode,placementRule:rule,columns:cols,facingsPerSku:2,tiers:grid.map((row,tier)=>({tier,compartment:tier===3?'frozen':'chilled',slots:row.map((p,column)=>({id:p?.id??null,tier,column,facings:p?2:0,storageZone:tier===3?'freezer':'fridge',compartment:tier===3?'frozen':'chilled'}))}))};
  }
  function planogram(products,c){
    if(!products.every(p=>['shelf','fridge','counter','freezer'].includes(p.displayZone)))return fixturePlanogram(products,c);
    let offsetPx=0,columnOffset=0;
    const combined=products.some(p=>p.displayZone==='freezer');
    const areas=(combined?['shelf','cold-cabinet','counter']:['shelf','fridge','counter']).filter(zone=>products.some(p=>zone==='cold-cabinet'?['fridge','freezer'].includes(p.displayZone):p.displayZone===zone)).map(zone=>{
      const list=products.filter(p=>zone==='cold-cabinet'?['fridge','freezer'].includes(p.displayZone):p.displayZone===zone),p=zone==='cold-cabinet'?coldCabinetPlanogram(list,c):fixturePlanogram(list,c,zone==='shelf'?8:4),widthPx=p.columns*116+56;
      const area={...p,zone,offsetPx,widthPx,columnOffset,tiers:p.tiers.map(row=>({...row,slots:row.slots.map(slot=>({...slot,zone,column:slot.column+columnOffset,localColumn:slot.column}))}))};
      offsetPx+=widthPx+28;columnOffset+=p.columns;return area;
    });
    return {version:combined?LAYOUT_VERSION:'physical-rack-v3',mode:areas[0].mode,placementRule:areas[0].placementRule,columns:columnOffset,facingsPerSku:2,widthPx:offsetPx-28,areas,
      tiers:[0,1,2,3].map(tier=>({tier,slots:areas.flatMap(a=>a.tiers[tier].slots)}))};
  }
  function totals(cart,products,c){
    let amountMinor=0,energy=0,upfEnergy=0,unknownEnergy=0,count=0;
    for(const [id,q]of Object.entries(cart)){
      const p=products.find(x=>x.id===id);
      if(!p||!Number.isInteger(q)||q<1||q>99)continue;
      const kcal=p.kcal*p.size/100*q;
      amountMinor+=priceMinor(p,c)*q;energy+=kcal;count+=q;
      if(p.nova===4)upfEnergy+=kcal;
      if(![1,2,3,4].includes(p.nova))unknownEnergy+=kcal;
    }
    return {amountMinor,remainingMinor:c.budget*100-amountMinor,energy,upfEnergy,unknownEnergy,count,upfShare:energy>0&&unknownEnergy===0?upfEnergy/energy:null};
  }
  function changeQuantity(cart,id,delta,products,c){
    if(!products.some(p=>p.id===id)||![-1,1].includes(delta))return {ok:false,reason:'invalid',cart};
    const n=(cart[id]||0)+delta;
    if(n>99)return {ok:false,reason:'limit',cart};
    if(n<0)return {ok:false,reason:'invalid',cart};
    const next={...cart};if(n===0)delete next[id];else next[id]=n;
    if(totals(next,products,c).remainingMinor<0)return {ok:false,reason:'budget',cart};
    return {ok:true,cart:next};
  }
  function orderedProducts(products,c){if(rackConfig(c)){const byId=new Map(products.map(p=>[p.id,p]));return planogram(products,c).tiers.flatMap(t=>t.slots.filter(s=>s.id).map(s=>byId.get(s.id)));}return c.position?[...products].sort((a,b)=>Number(b.eligible)-Number(a.eligible)):[...products];}
  function conditionCode(c){if(rackConfig(c)&&['category','popularity'].includes(c.layoutMode))return `P${+c.price}-O${c.layoutMode}-L${+c.labels}-U${+c.upf}`;const code=`${+c.price}${+c.position}${+c.labels}`;return rackConfig(c)&&c.labels!==c.upf?`${code}-U${+c.upf}`:code;}
  function snapshot(cart,products,c){
    return {config:{...c},conditionCode:conditionCode(c),rulesVersion:RULES_VERSION,...(rackConfig(c)?{planogram:planogram(products,c),pricePolicy:'NOVA4-only-markup',popularitySource:'synthetic-not-campus-sales'}:{}),
      basket:Object.entries(cart).filter(([id,q])=>products.some(p=>p.id===id)&&Number.isInteger(q)&&q>0&&q<=99).map(([id,quantity])=>{const p=products.find(x=>x.id===id);return {id,quantity,priceMinor:priceMinor(p,c),size:p.size,unit:p.unit,saleUnit:p.saleUnit||'pack_or_portion',portionCount:p.portionCount||1,displayZone:p.displayZone||null,nova:p.nova,nutrientsPer100:{kcal:p.kcal,fat:p.fat,sugar:p.sugar,salt:p.salt},lights:Object.fromEntries(METRICS.map(m=>[m,classify(p,m)]))};}),
      totals:totals(cart,products,c)};
  }
  function panTarget(left,viewportWidth,scrollWidth,direction){return Math.max(0,Math.min(Math.max(0,scrollWidth-viewportWidth),left+direction*Math.max(116,viewportWidth*.75)));}
  const api={RULES_VERSION,METRICS,LAYOUT_VERSION,LAYOUTS,rackConfig,validateConfig,classify,targetProduct,planogram,panTarget,priceMinor,totals,changeQuantity,orderedProducts,conditionCode,snapshot};
  root.CampusShelfCore=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
