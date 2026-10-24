(function(root){
  'use strict';
  const RULES_VERSION='prototype-traffic-lights-v1';
  const METRICS=['kcal','fat','sugar','salt','upf'];
  function validateConfig(c){
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
  function priceMinor(p,c){return Math.round(p.price*100*(c.price&&p.eligible?1-c.discountPercent/100:1));}
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
  function orderedProducts(products,c){return c.position?[...products].sort((a,b)=>Number(b.eligible)-Number(a.eligible)):[...products];}
  function conditionCode(c){return `${+c.price}${+c.position}${+c.labels}`;}
  function snapshot(cart,products,c){
    return {config:{...c},conditionCode:conditionCode(c),rulesVersion:RULES_VERSION,
      basket:Object.entries(cart).filter(([id,q])=>products.some(p=>p.id===id)&&Number.isInteger(q)&&q>0&&q<=99).map(([id,quantity])=>{const p=products.find(x=>x.id===id);return {id,quantity,priceMinor:priceMinor(p,c),size:p.size,unit:p.unit,nova:p.nova,nutrientsPer100:{kcal:p.kcal,fat:p.fat,sugar:p.sugar,salt:p.salt},lights:Object.fromEntries(METRICS.map(m=>[m,classify(p,m)]))};}),
      totals:totals(cart,products,c)};
  }
  const api={RULES_VERSION,METRICS,validateConfig,classify,priceMinor,totals,changeQuantity,orderedProducts,conditionCode,snapshot};
  root.CampusShelfCore=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
