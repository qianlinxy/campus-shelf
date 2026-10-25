const test=require('node:test'),assert=require('node:assert/strict');
require('../dist/data.js');const C=require('../dist/core.js'),products=require('./fixtures/catalog-v3.json');
const config={schemaVersion:2,budget:600,price:false,position:true,labels:true,upf:true,markupPercent:25,layoutMode:'alternatives-eye',placementRule:'upf-or-high'};
const sku=id=>products.find(p=>p.id===id);
const placements=p=>p.tiers.flatMap(t=>t.slots).filter(s=>s.id);

test('eight rack conditions keep the same inventory, four heights and two facings per SKU',()=>{
 const before=JSON.stringify(products);
 for(let n=0;n<8;n++){
  const c={...config,price:!!(n&4),position:!!(n&2),layoutMode:n&2?'alternatives-eye':'targets-eye',labels:!!(n&1),upf:!!(n&1)};
  assert.equal(C.validateConfig(c),true);assert.equal(C.conditionCode(c),n.toString(2).padStart(3,'0'));
  const rack=C.planogram(products,c),rows=placements(rack);
  assert.equal(rack.tiers.length,4);assert.equal(rack.columns,16);assert.equal(rows.length,50);
  assert.deepEqual(rows.map(s=>s.id).sort(),products.map(p=>p.id).sort());assert.equal(new Set(rows.map(s=>s.id)).size,50);assert.ok(rows.every(s=>s.facings===2));
  assert.equal(rack.tiers.flatMap(t=>t.slots).filter(s=>!s.id).length,14);
 }
 assert.equal(JSON.stringify(products),before);
});
test('price and label switches do not move any product or change facings',()=>{
 for(const mode of C.LAYOUTS){
  const c={...config,layoutMode:mode,position:mode==='alternatives-eye'},original=C.planogram(products,c);
  for(const price of [true,false])for(const labels of [true,false])assert.deepEqual(C.planogram(products,{...c,price,labels,upf:labels}),original);
 }
});
test('combined target group is on the lower two tiers and reverses to upper plus eye-level',()=>{
 const forward=placements(C.planogram(products,config)),reverse=placements(C.planogram(products,{...config,position:false,layoutMode:'targets-eye'}));
 for(const p of products){const a=forward.find(s=>s.id===p.id),b=reverse.find(s=>s.id===p.id);
  if(C.targetProduct(p,'upf-or-high')){assert.ok(a.tier>=2,p.id);assert.ok(b.tier<=1,p.id);}
  else if(p.eligible){assert.ok(a.tier<=1,p.id);assert.ok(b.tier>=2,p.id);}
 }
});
test('placement target, NOVA and nutrient lights are separate definitions',()=>{
 assert.equal(C.targetProduct(sku('nuts'),'upf'),false);assert.equal(C.targetProduct(sku('nuts'),'upf-or-high'),true);
 assert.equal(C.targetProduct(sku('nimko'),'upf'),false);assert.equal(C.targetProduct(sku('nimko'),'upf-or-high'),true);
 assert.equal(C.classify(sku('nuts'),'upf'),'green');assert.equal(C.classify(sku('nuts'),'fat'),'red');
 assert.equal(C.targetProduct(sku('sandwich'),'upf-or-high'),false);
});
test('NOVA 4 markup changes only NOVA 4 prices, at fixed 20/25/30 percent doses',()=>{
 for(const rate of [20,25,30]){
  const c={...config,price:true,markupPercent:rate};assert.equal(C.priceMinor(sku('cola'),c),10000+100*rate);
  for(const p of products)if(p.nova!==4)assert.equal(C.priceMinor(p,c),Math.round(p.price*100));
 }
 assert.equal(C.priceMinor(sku('cola'),config),10000);assert.equal(C.priceMinor({...sku('cola'),price:71.33},{...config,price:true}),8916);
});
test('markup is enforced by cart budgeting and captured with exact shelf positions',()=>{
 const raised={...config,price:true};assert.equal(C.changeQuantity({cola:4},'cola',1,products,raised).ok,false);
 assert.equal(C.totals({cola:5},products,raised).amountMinor,62500);
 const snapshot=C.snapshot({cola:1},products,raised);assert.equal(snapshot.basket[0].priceMinor,12500);assert.equal(snapshot.planogram.version,'physical-rack-v2');assert.equal(snapshot.pricePolicy,'NOVA4-only-markup');assert.equal(snapshot.popularitySource,'synthetic-not-campus-sales');
});
test('category and synthetic-popularity reference layouts are explicitly distinct from binary position codes',()=>{
 for(const mode of ['category','popularity']){const c={...config,position:false,layoutMode:mode};assert.ok(C.conditionCode(c).includes(mode));assert.deepEqual(C.planogram(products,c).tiers.map(t=>t.slots.filter(s=>s.id).length).sort((a,b)=>a-b),[11,13,13,13]);}
 const popular=C.planogram(products,{...config,position:false,layoutMode:'popularity'});assert.equal(popular.tiers[1].slots.filter(s=>s.id)[0].id,'chips');
 assert.ok(products.every(p=>p.popularitySource==='synthetic-demonstration'));assert.equal(new Set(products.map(p=>p.popularityRank)).size,50);
});
test('new configuration rejects ambiguous layout flags and unsupported markups',()=>{
 for(const patch of [{markupPercent:19},{markupPercent:23},{markupPercent:31},{layoutMode:'anything'},{position:false},{placementRule:'healthy-score'},{price:'on'}])assert.equal(C.validateConfig({...config,...patch}),false);
});

test('both placement definitions fit every SKU once, with identical rack dimensions',()=>{
 for(const placementRule of ['upf','upf-or-high'])for(const layoutMode of C.LAYOUTS){const p=C.planogram(products,{...config,placementRule,layoutMode,position:layoutMode==='alternatives-eye'});assert.equal(p.columns,16);assert.equal(placements(p).length,50);assert.equal(new Set(placements(p).map(s=>s.id)).size,50);}
 // A large target group must widen safely rather than drop foods.
 const expanded=Array.from({length:80},(_,i)=>({...sku('cola'),id:'test-'+i,catalogOrder:i}));const p=C.planogram(expanded,config);assert.equal(p.columns,40);assert.equal(placements(p).length,80);
});

test('horizontal pan targets clamp to both ends and overlap successive views',()=>{
 assert.equal(C.panTarget(0,400,1600,-1),0);assert.equal(C.panTarget(0,400,1600,1),300);assert.equal(C.panTarget(1100,400,1600,1),1200);assert.equal(C.panTarget(1200,400,1600,-1),900);assert.equal(C.panTarget(0,1600,400,1),0);
});
