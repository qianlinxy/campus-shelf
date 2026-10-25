const test=require('node:test');
const assert=require('node:assert/strict');
require('../dist/data.js');
const C=require('../dist/core.js');
const products=globalThis.CAMPUS_DATA.products;
const config={budget:600,price:false,position:false,labels:true,upf:true,discountPercent:20};
const p=id=>products.find(x=>x.id===id);

test('all eight conditions retain the exact same SKU inventory and sizes',()=>{
 const original=JSON.stringify(products);
 for(let n=0;n<8;n++){
  const c={...config,price:!!(n&4),position:!!(n&2),labels:!!(n&1)};
  const ordered=C.orderedProducts(products,c);
  assert.equal(C.conditionCode(c),n.toString(2).padStart(3,'0'));
  assert.deepEqual(ordered.map(p=>[p.id,p.size]).sort(),products.map(p=>[p.id,p.size]).sort());
 }
 assert.equal(JSON.stringify(products),original);
});
test('discount changes eligible price only, with money rounded to minor units',()=>{
 const c={...config,price:true};
 assert.equal(C.priceMinor(p('water'),c),4800);
 assert.equal(C.priceMinor(p('cola'),c),10000);
 assert.equal(C.priceMinor({...p('water'),price:71.33},{...c,discountPercent:15}),6063);
});
test('budget enforcement rejects overspending without changing basket',()=>{
 const cart={sandwich:3};
 const result=C.changeQuantity(cart,'water',1,products,config);
 assert.equal(result.ok,false);assert.equal(result.reason,'budget');assert.deepEqual(cart,{sandwich:3});
 assert.equal(C.totals(cart,products,config).remainingMinor,0);
});
test('remove and quantity controls cannot produce negative or excessive quantities',()=>{
 assert.deepEqual(C.changeQuantity({water:1},'water',-1,products,config).cart,{});
 assert.equal(C.changeQuantity({},'water',-1,products,config).ok,false);
 assert.equal(C.changeQuantity({water:99},'water',1,products,{...config,budget:10000}).reason,'limit');
 assert.equal(C.changeQuantity({},'invalid',1,products,config).ok,false);
});
test('UPF and nutrient colours remain independent',()=>{
 assert.equal(C.classify(p('nuts'),'upf'),'green');
 assert.equal(C.classify(p('nuts'),'fat'),'red');
 assert.equal(C.classify(p('cola'),'fat'),'green');
 assert.equal(C.classify(p('cola'),'upf'),'red');
 assert.equal(C.classify({nova:3},'upf'),'amber');
 assert.equal(C.classify(p('sandwich'),'upf'),'unknown');
});
test('per-100 thresholds distinguish food and drink, including boundaries',()=>{
 assert.equal(C.classify({unit:'g',fat:3},'fat'),'green');
 assert.equal(C.classify({unit:'g',fat:17.5},'fat'),'amber');
 assert.equal(C.classify({unit:'g',fat:17.51},'fat'),'red');
 assert.equal(C.classify({unit:'ml',fat:3},'fat'),'amber');
 assert.equal(C.classify({unit:'ml',sugar:11.25},'sugar'),'amber');
 assert.equal(C.classify({unit:'ml',sugar:11.26},'sugar'),'red');
 assert.equal(C.classify({unit:'g',kcal:null},'kcal'),'unknown');
 assert.equal(C.classify({unit:'g',salt:-1},'salt'),'unknown');
});
test('empty and zero-energy baskets have undefined energy shares',()=>{
 const empty=C.totals({},products,config),water=C.totals({water:1},products,config);
 assert.equal(empty.count,0);assert.equal(empty.upfShare,null);
 assert.equal(water.count,1);assert.equal(water.energy,0);assert.equal(water.upfShare,null);
});
test('unknown processing prevents a misleading zero UPF share',()=>{
 const total=C.totals({sandwich:1,water:1},products,config);
 assert.equal(total.upfShare,null);assert.equal(total.unknownEnergy,270);
});
test('energy is computed using pack size rather than per100 alone',()=>{
 const total=C.totals({cola:1,banana:2},products,config);
 assert.ok(Math.abs(total.energy-(42*3.3+89*2.4))<1e-9);
 assert.ok(Math.abs(total.upfEnergy-138.6)<1e-9);
 assert.equal(total.amountMinor,24000);
 assert.ok(Math.abs(total.upfShare-138.6/352.2)<1e-9);
});
test('receipt snapshot is independent of later cart and condition changes',()=>{
 const cart={cola:1};const c={...config};const snap=C.snapshot(cart,products,c);
 cart.cola=3;c.price=true;
 assert.equal(snap.basket[0].quantity,1);assert.equal(snap.config.price,false);
 assert.equal(snap.basket[0].lights.upf,'red');assert.equal(snap.rulesVersion,'prototype-traffic-lights-v1');
});
test('restored configuration rejects invalid budgets and factor values',()=>{
 assert.equal(C.validateConfig(config),true);
 for(const patch of [{budget:NaN},{budget:0},{budget:600.5},{price:'yes'},{discountPercent:0},{discountPercent:41}])assert.equal(C.validateConfig({...config,...patch}),false);
});
