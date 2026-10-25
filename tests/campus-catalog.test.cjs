const test=require('node:test'),assert=require('node:assert/strict');
require('../dist/data.js');const C=require('../dist/core.js'),products=require('./fixtures/catalog-v4.json'),previous=require('./fixtures/catalog-v3.json');
const base={schemaVersion:2,budget:600,price:false,position:true,labels:true,upf:true,markupPercent:25,layoutMode:'alternatives-eye',placementRule:'upf-or-high'};
test('campus adaptation keeps 50 buying choices without standalone cheese, mango chips or curry',()=>{
 assert.equal(products.length,50);assert.equal(new Set(products.map(p=>p.id)).size,50);
 for(const id of ['cheese','mango','toffee'])assert.ok(!products.some(p=>p.id===id));
 for(const id of ['cheese-sandwich','biryani','toffee-piece'])assert.ok(products.some(p=>p.id===id));
 assert.ok(!products.some(p=>/mango chips|chicken curry|banana chips/i.test(p.en)));
 assert.equal(products.find(p=>p.id==='biryani').nova,null);assert.equal(products.find(p=>p.id==='cheese-sandwich').nova,null);
 const kishmish=products.find(p=>p.id==='raisins');assert.equal(kishmish.en,'Kishmish (raisins)');assert.ok(kishmish.aliases.includes('raisins'));
});
test('cold drinks stay in their own fridge; hot tea and served meals belong to the counter',()=>{
 for(const p of products.filter(p=>p.category==='drinks'&&p.id!=='tea'))assert.equal(p.displayZone,'fridge',p.id);
 for(const id of ['biryani','cheese-sandwich','tea'])assert.equal(products.find(p=>p.id===id).displayZone,'counter');
 assert.equal(products.find(p=>p.id==='yogurt').displayZone,'fridge');assert.equal(products.find(p=>p.id==='noodles').displayZone,'shelf');
});
test('all eight conditions preserve fixture membership, dimensions, inventory and facings',()=>{
 let dimensions;for(let n=0;n<8;n++){
  const cfg={...base,price:!!(n&4),position:!!(n&2),layoutMode:n&2?'alternatives-eye':'targets-eye',labels:!!(n&1),upf:!!(n&1)},plan=C.planogram(products,cfg);
  assert.equal(plan.version,'physical-rack-v3');assert.deepEqual(plan.areas.map(a=>a.zone),['shelf','fridge','counter']);
  const dims=plan.areas.map(a=>[a.zone,a.columns,a.widthPx,a.offsetPx]);if(!dimensions)dimensions=dims;else assert.deepEqual(dims,dimensions);
  const slots=plan.tiers.flatMap(t=>t.slots).filter(s=>s.id);assert.equal(slots.length,50);assert.equal(new Set(slots.map(s=>s.id)).size,50);
  for(const slot of slots){assert.equal(slot.zone,products.find(p=>p.id===slot.id).displayZone);assert.equal(slot.facings,2);}
 }
});
test('price and label switches never move products; placement swaps heights within each fixture',()=>{
 for(const placementRule of ['upf','upf-or-high']){
  const cfg={...base,placementRule},a=C.planogram(products,cfg),b=C.planogram(products,{...cfg,position:false,layoutMode:'targets-eye'});
  assert.deepEqual(C.planogram(products,{...cfg,price:true,labels:false,upf:false}),a);
  const flat=p=>p.tiers.flatMap(t=>t.slots).filter(s=>s.id);
  for(const product of products){const x=flat(a).find(s=>s.id===product.id),y=flat(b).find(s=>s.id===product.id);assert.equal(x.zone,y.zone);if(C.targetProduct(product,placementRule)){assert.ok(x.tier>=2);assert.ok(y.tier<=1);}else if(product.eligible){assert.ok(x.tier<=1);assert.ok(y.tier>=2);}}
 }
});
test('two toffees mean two pieces, 10g total, with price and energy scaled per piece',()=>{
 const p=products.find(p=>p.id==='toffee-piece');assert.equal(p.saleUnit,'piece');assert.equal(p.portionCount,1);assert.equal(p.size,5);assert.equal(p.unit,'g');assert.equal(p.price,10);
 const basket={'toffee-piece':2},totals=C.totals(basket,products,base);assert.equal(totals.count,2);assert.equal(totals.amountMinor,2000);assert.equal(totals.energy,41);assert.equal(totals.upfEnergy,41);
 assert.equal(C.totals(basket,products,{...base,price:true}).amountMinor,2500);assert.equal(C.snapshot(basket,products,base).basket[0].saleUnit,'piece');
});
test('unchanged product prices and historical catalog remain intact',()=>{
 for(const p of products){const old=previous.find(o=>o.id===p.id);if(old)assert.equal(p.price,old.price,p.id);}
 assert.ok(previous.some(p=>p.id==='cheese'&&p.size===30));assert.ok(previous.some(p=>p.id==='toffee'&&p.size===25));assert.equal(C.planogram(previous,base).version,'physical-rack-v2');
});
