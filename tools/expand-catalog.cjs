/* One-time catalog upgrade. New migration retains the original 24-SKU cohort. */
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');require(path.join(root,'dist/data.js'));
if(CAMPUS_DATA.products.length!==24)throw new Error('Expected original 24-product source; do not rerun.');
const rows=[
 // id, Chinese, English, Urdu, category, artwork, pack, grams/ml, unit, PKR, NOVA, comparator, kcal/fat/sugars/salt per100, color
 ['orange','新鲜橙子','Fresh orange','تازہ مالٹا','fresh','orange','ORANGE',160,'g',90,1,true,47,.1,9.4,0,'#df9239'],
 ['guava','新鲜番石榴','Fresh guava','تازہ امرود','fresh','guava','GUAVA',150,'g',80,1,true,68,1,8.9,0,'#9dae58'],
 ['grapes','新鲜葡萄','Fresh grapes','تازہ انگور','fresh','grapes','GRAPES',100,'g',150,1,true,69,.2,15.5,0,'#806383'],
 ['cucumber','黄瓜条','Cucumber sticks','کھیرے کے ٹکڑے','fresh','cucumber','CUCUMBER',150,'g',60,1,true,15,.1,1.7,.01,'#63844b'],
 ['egg','白煮鸡蛋','Boiled egg','ابلا ہوا انڈا','fresh','egg','EGG',55,'g',60,1,true,155,10.6,1.1,.31,'#d1b487'],
 ['almonds','无盐杏仁','Unsalted almonds','بغیر نمک بادام','snacks','nuts','ALMONDS',25,'g',220,1,true,579,50,4.4,.01,'#9c6e48'],
 ['raisins','原味葡萄干','Plain raisins','سادہ کشمش','snacks','dates','RAISINS',30,'g',80,1,false,299,.5,59,.03,'#7b5947'],
 ['popcorn','无盐原味爆米花','Plain air-popped popcorn','بغیر نمک پاپ کارن','snacks','popcorn','POPCORN',25,'g',70,1,true,387,4.5,.9,.02,'#b8a666'],
 ['tea','无糖红茶','Unsweetened black tea','بغیر شکر کالی چائے','drinks','tea','BLACK TEA',200,'ml',50,1,true,1,0,0,0,'#8c613d'],
 ['lemonwater','无糖柠檬水','Unsweetened lemon water','بغیر شکر لیموں پانی','drinks','bottle','LEMON WATER',250,'ml',70,1,true,4,0,.6,0,'#b8af50'],
 ['mango','新鲜芒果块','Fresh mango pieces','تازہ آم کے ٹکڑے','fresh','fruitcup','MANGO',150,'g',160,1,true,60,.4,13.7,0,'#d8a33c'],
 ['chickpeasalad','Chana Chaat 鹰嘴豆沙拉','Chana chaat','چنا چاٹ','meals','salad','CHANA CHAAT',180,'g',140,null,false,125,3,4,.65,'#96965c'],
 ['roti','原味 Chapati 薄饼','Plain chapati','سادہ چپاتی','meals','roti','CHAPATI',60,'g',40,null,false,260,4,2,.7,'#b99560'],
 ['paratha','Paratha 煎饼','Plain paratha','سادہ پراٹھا','meals','roti','PARATHA',90,'g',100,null,false,330,16,2,1,'#ba8a43'],
 ['pakora','蔬菜 Pakora 炸丸','Vegetable pakora','سبزی کے پکوڑے','meals','pakora','PAKORA',100,'g',100,null,false,300,18,3,1.3,'#bc7f3d'],
 ['roll','鸡肉卷饼','Chicken roll','چکن رول','meals','roll','CHICKEN ROLL',150,'g',250,null,false,250,12,3,1.2,'#bd9a69'],
 ['chocolate','牛奶巧克力棒','Milk chocolate bar','ملک چاکلیٹ بار','snacks','chocolate','CHOCOLATE',30,'g',150,4,false,535,30,52,.25,'#744b58'],
 ['wafer','巧克力威化饼','Chocolate wafers','چاکلیٹ ویفر','snacks','wafer','WAFERS',35,'g',80,4,false,510,26,36,.35,'#b07640'],
 ['cake','包装奶油蛋糕','Packaged cream cake','پیک شدہ کریم کیک','snacks','cake','CREAM CAKE',45,'g',100,4,false,410,21,33,.6,'#ca8d9a'],
 ['cornsnack','Masala 玉米膨化零食','Masala corn puffs','مصالحہ کارن پف','snacks','chips','CORN PUFFS',30,'g',60,4,false,520,28,3,1.8,'#c37635'],
 ['toffee','奶油太妃糖','Cream toffees','کریم ٹافیاں','snacks','candy','TOFFEES',25,'g',50,4,false,410,10,67,.2,'#b69656'],
 ['sweetbun','包装甜面包','Packaged sweet bun','پیک شدہ میٹھا بن','snacks','bun','SWEET BUN',60,'g',70,4,false,330,9,19,.65,'#b38755'],
 ['energydrink','能量饮料','Energy drink','انرجی ڈرنک','drinks','energycan','ENERGY',250,'ml',180,4,false,46,0,11,.12,'#425c72'],
 ['chocolatemilk','巧克力味乳饮料','Chocolate milk drink','چاکلیٹ دودھ کا مشروب','drinks','flavouredmilk','CHOCO MILK',250,'ml',160,4,false,83,2.7,12,.14,'#89654e'],
 ['strawberrymilk','草莓味乳饮料','Strawberry milk drink','اسٹرابیری دودھ کا مشروب','drinks','flavouredmilk','BERRY MILK',200,'ml',140,4,false,79,2.5,11.5,.13,'#b86e83'],
 ['orangefizz','橙味汽水','Orange fizzy drink','مالٹے کا فزی مشروب','drinks','energycan','ORANGE FIZZ',330,'ml',100,4,false,45,0,11,.03,'#d08b39']
];
for(const r of rows){const [id,zh,en,ur,category,kind,packText,size,unit,price,nova,eligible,kcal,fat,sugar,salt,color]=r;const i=CAMPUS_DATA.products.length;CAMPUS_DATA.products.push({id,zh,en,ur,category,kind,packText,tag:packText,size,unit,price,nova,eligible,kcal,fat,sugar,salt,color,bg:'#f3f1e7',synthetic:true,popularityRank:i+1,popularitySource:'synthetic-demonstration',catalogOrder:i});}
CAMPUS_DATA.version='synthetic-pakistan-catalog-v3';
CAMPUS_DATA.popularityVersion='synthetic-ranking-v2';
CAMPUS_DATA.products.forEach(p=>p.classificationStatus='synthetic-provisional-not-reviewed');
fs.writeFileSync(path.join(root,'dist/data.js'),'/* All 50 products, pack artwork, prices, nutrition and rankings are illustrative, not verified campus data. */\nglobalThis.CAMPUS_DATA = '+JSON.stringify(CAMPUS_DATA,null,2)+';\n');
const sqlString=s=>"'"+s.replaceAll("'","''")+"'";
const old=fs.readFileSync(path.join(root,'supabase/migrations/004_physical_shelf_upf_markup.sql'),'utf8');
const start=old.indexOf('create or replace function public.submit_pilot_task'),end=old.indexOf('-- Add display metadata');
const submit=old.slice(start,end).replace("then 'physical-rack-v1' else 'legacy'", "then case when p.catalog_version='synthetic-pakistan-catalog-v3' then 'physical-rack-v2' else 'physical-rack-v1' end else 'legacy'");
const insert=CAMPUS_DATA.products.map(p=>`(${sqlString(p.id)},${sqlString(CAMPUS_DATA.version)},${sqlString(JSON.stringify(p))}::jsonb)`).join(',\n');
fs.writeFileSync(path.join(root,'supabase/migrations/005_fifty_product_catalog.sql'),`-- A new 50-product catalog. Preserve old 24-product rows, profiles and receipts.\nbegin;\nalter table private.catalog drop constraint catalog_pkey;\nalter table private.catalog add primary key(id,version);\ninsert into private.catalog(id,version,product) values\n${insert};\nupdate private.pilot_settings set catalog_version='synthetic-pakistan-catalog-v3' where id=true;\n${submit}commit;\n`);
console.log('Created 50-product catalog and additive migration 005.');
