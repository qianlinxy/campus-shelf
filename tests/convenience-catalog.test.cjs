const test=require('node:test'),assert=require('node:assert/strict');
require('../dist/data.js');const C=require('../dist/core.js'),P=CAMPUS_DATA.products,old=require('./fixtures/catalog-v4.json');
const cfg={schemaVersion:2,budget:600,price:false,position:true,labels:true,upf:true,markupPercent:25,layoutMode:'alternatives-eye',placementRule:'upf-or-high'};
test('convenience scope adds 28 choices, removes full lunches and retains previous prices',()=>{
 assert.equal(CAMPUS_DATA.version,'synthetic-pakistan-catalog-v5');assert.equal(P.length,75);assert.equal(new Set(P.map(p=>p.id)).size,75);
 const removed=old.filter(p=>!P.some(x=>x.id===p.id));assert.deepEqual(removed.map(p=>p.id).sort(),['biryani','paratha','roti']);
 const added=P.filter(p=>!old.some(x=>x.id===p.id));assert.equal(added.length,28);
 for(const p of P){assert.ok(p.zh&&p.en&&p.ur);assert.equal(p.synthetic,true);const before=old.find(x=>x.id===p.id);if(before)assert.equal(p.price,before.price);}
 assert.ok(!P.some(p=>/biryani|pulao|daal chawal|curry/i.test(p.en)));
 assert.equal(P.find(p=>p.id==='egg-sandwich').nova,null);
});
test('frozen foods have their own fixture; shelf, cold drinks and counter retain their areas',()=>{
 assert.deepEqual(P.filter(p=>p.displayZone==='freezer').map(p=>p.id).sort(),['icecream-cone','icecream-cup','kulfi']);
 for(const id of ['water','cola','energydrink','cold-coffee','sweet-lassi','salted-lassi','banana-shake','mango-shake'])assert.equal(P.find(p=>p.id===id).displayZone,'fridge');
 for(const id of ['tea','milk-chai','dahi-bhallay','muffin','egg-sandwich'])assert.equal(P.find(p=>p.id===id).displayZone,'counter');
});
test('all eight 75-product conditions keep four fixture dimensions and independent factors',()=>{
 let dimensions;
 for(const rule of ['upf','upf-or-high'])for(let n=0;n<8;n++){
  const c={...cfg,placementRule:rule,price:!!(n&4),position:!!(n&2),layoutMode:n&2?'alternatives-eye':'targets-eye',labels:!!(n&1),upf:!!(n&1)},p=C.planogram(P,c);
  assert.equal(p.version,'physical-rack-v4');assert.deepEqual(p.areas.map(x=>x.zone),['shelf','fridge','counter','freezer']);
  // Each placement definition can require different width; all eight arms within it are equal.
  const d=p.areas.map(x=>[x.zone,x.columns,x.offsetPx,x.widthPx]);if(n===0)dimensions=d;else assert.deepEqual(d,dimensions);
  const slots=p.tiers.flatMap(t=>t.slots).filter(s=>s.id);assert.equal(slots.length,75);assert.equal(new Set(slots.map(s=>s.id)).size,75);
  for(const slot of slots){const food=P.find(x=>x.id===slot.id);assert.equal(slot.zone,food.displayZone);assert.equal(slot.facings,2);if(C.targetProduct(food,rule))assert.ok(c.position?slot.tier>=2:slot.tier<=1);}
  assert.deepEqual(C.planogram(P,{...c,price:!c.price,labels:!c.labels,upf:!c.upf}),p);
 }
});
test('frozen units use grams and the same NOVA4-only markup arithmetic as other purchases',()=>{
 const cart={'icecream-cup':1,kulfi:1,'toffee-piece':2};const t=C.totals(cart,P,cfg);assert.equal(t.amountMinor,22000);assert.equal(t.energy,370);assert.equal(t.upfShare,null);
 const raised=C.totals(cart,P,{...cfg,price:true});assert.equal(raised.amountMinor,25000);assert.equal(raised.energy,t.energy);
 const s=C.snapshot(cart,P,cfg);assert.equal(s.basket.find(p=>p.id==='icecream-cup').displayZone,'freezer');assert.equal(s.basket.find(p=>p.id==='toffee-piece').quantity,2);
});
