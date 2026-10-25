// One-time additive v0.9 catalogue. Retain every earlier catalogue and receipt.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');require('../dist/data.js');const data=CAMPUS_DATA;
if(data.version!=='synthetic-pakistan-catalog-v4')throw new Error('Expected v4; never overwrite a released catalogue.');
const migration=path.join(root,'supabase/migrations/008_convenience_store_catalog.sql');
if(fs.existsSync(migration))throw new Error('Migration already exists.');
fs.writeFileSync(path.join(root,'tests/fixtures/catalog-v4.json'),JSON.stringify(data.products,null,2)+'\n');
const removed=new Set(['biryani','roti','paratha']);data.products=data.products.filter(p=>!removed.has(p.id));
// All values below are illustrative candidates, not brand nutrition or measured shop prices.
// The NOVA flags are provisional too; mixed counter foods stay unclassified.
const rows=[
 ['tuc','TUC咸味薄脆饼干','TUC salted crackers','ٹک نمکین بسکٹ','shelf','biscuits','TUC',30,50,4,480,20,6,1.8],
 ['zeera-biscuits','孜然味饼干 Click','Click / Zeera biscuits','کلک زیرہ بسکٹ','shelf','biscuits','ZEERA',30,50,4,470,19,12,1.3],
 ['peanut-pik','Peanut Pik花生饼干','Peanut Pik biscuits','پینٹ پک بسکٹ','shelf','biscuits','PEANUT PIK',24,40,4,490,23,25,.7],
 ['marie','Marie茶点饼干','Marie biscuits','میری بسکٹ','shelf','biscuits','MARIE',30,50,4,440,12,22,.6],
 ['potato-sticks','条状马铃薯零食','Potato sticks','آلو اسٹکس','shelf','chips','POTATO STICKS',25,50,4,530,32,2,1.8],
 ['kurkure','Kurkure香辣膨化零食','Kurkure masala snack','کرکرے مسالہ اسنیک','shelf','chips','KURKURE',25,50,4,530,30,3,1.8],
 ['cheetos','Cheetos芝士味膨化零食','Cheetos cheese snack','چیٹوز چیز اسنیک','shelf','chips','CHEETOS',25,50,4,520,29,3,1.7],
 ['corn-nuts','香辣烘烤玉米粒','Spicy roasted corn nuts','مسالہ بھنے مکئی دانے','shelf','nuts','CORN NUTS',30,60,null,450,15,2,1.4],
 ['gum','口香糖（1小条）','Chewing gum (small strip)','چیونگ گم (چھوٹی پٹی)','shelf','candy','GUM',10,30,4,300,0,65,.02],
 ['cashews','腰果 Kaju','Kaju (cashews)','کاجو','shelf','nuts','KAJU',25,150,1,553,44,6,.02],
 ['masala-chana','香料味鹰嘴豆','Masala chana','مسالہ چنا','shelf','nuts','MASALA CHANA',30,50,null,390,8,4,1.2],
 ['namkeen-daal','咸味脆豆零食','Namkeen daal','نمکین دال','shelf','nuts','NAMKEEN DAAL',30,50,null,450,20,3,1.5],
 ['cake-rusk','蛋糕烤干 Cake rusk','Cake rusk','کیک رسک','shelf','biscuits','CAKE RUSK',40,60,4,450,18,28,.6],
 ['muffin','小松糕（1个）','Bakery muffin','بیکری مفن','counter','muffin','MUFFIN',60,100,null,380,17,28,.6],
 ['doughnut','甜甜圈（1个）','Bakery doughnut','بیکری ڈونٹ','counter','doughnut','DOUGHNUT',60,100,null,410,22,25,.7],
 ['brownie','布朗尼（1块）','Bakery brownie','بیکری براؤنی','counter','brownie','BROWNIE',50,150,null,420,23,35,.4],
 ['egg-sandwich','鸡蛋三明治（1份）','Egg sandwich','انڈے کا سینڈوچ','counter','cheese-sandwich','EGG SANDWICH',130,150,null,220,9,3,1],
 ['dahi-bhallay','Dahi bhallay酸奶小吃','Dahi bhallay','دہی بھلے','counter','dahi-bhallay','DAHI BHALLAY',150,130,null,150,5,5,.8],
 ['samosa-chaat','Samosa chaat三角酥小吃','Samosa chaat','سموسہ چاٹ','counter','chaat','SAMOSA CHAAT',150,150,null,210,10,4,1.1],
 ['milk-chai','奶茶 Doodh patti（加糖）','Doodh patti (sweet milk tea)','دودھ پتی (میٹھی چائے)','counter','tea','DOODH PATTI',150,70,null,65,2.5,8,.1],
 ['cold-coffee','冷藏咖啡乳饮料','Chilled coffee milk drink','ٹھنڈی کافی دودھ کا مشروب','fridge','flavouredmilk','COFFEE MILK',250,180,4,75,2.5,10,.12],
 ['sweet-lassi','甜味Lassi','Sweet lassi','میٹھی لسی','fridge','yogurt','SWEET LASSI',250,130,null,85,3,11,.1],
 ['salted-lassi','咸味Lassi','Salted lassi','نمکین لسی','fridge','yogurt','SALTED LASSI',250,120,null,45,2.5,4,.5],
 ['banana-shake','香蕉奶昔（外带杯）','Banana milkshake (takeaway cup)','کیلے کا ملک شیک','fridge','yogurt','BANANA SHAKE',250,180,null,95,3,13,.1],
 ['mango-shake','芒果奶昔（外带杯）','Mango milkshake (takeaway cup)','آم کا ملک شیک','fridge','yogurt','MANGO SHAKE',250,200,null,100,3,15,.1],
 ['icecream-cup','杯装冰淇淋','Ice cream cup','آئس کریم کپ','freezer','icecream-cup','ICE CREAM',80,100,4,210,11,22,.15],
 ['icecream-cone','蛋筒冰淇淋','Ice cream cone','آئس کریم کون','freezer','icecream-cone','ICE CREAM',90,150,4,260,13,27,.2],
 ['kulfi','Kulfi奶冰棒','Kulfi milk ice lolly','قلفی','freezer','kulfi','KULFI',70,100,null,230,12,25,.15]
];
const palette=['#b77946','#778b54','#ad715e','#607d87','#a38a4f','#8c7490'];
for(const [i,r] of rows.entries()){
 const [id,zh,en,ur,displayZone,kind,packText,size,price,nova,kcal,fat,sugar,salt]=r;
 data.products.push({id,zh,en,ur,displayZone,kind,packText,size,unit:displayZone==='fridge'||id==='milk-chai'?'ml':'g',price,nova,eligible:nova===1,kcal,fat,sugar,salt,
 category:displayZone==='fridge'||id==='milk-chai'?'drinks':displayZone==='counter'?'meals':'snacks',color:palette[i%palette.length],bg:'#f5f0df',tag:packText,
 synthetic:true,classificationStatus:'synthetic-provisional-not-reviewed',popularitySource:'synthetic-demonstration',saleUnit:['shelf','fridge'].includes(displayZone)?'pack_or_portion':'portion',portionCount:1,
 availabilityStatus:'candidate-awaiting-target-campus-confirmation',nutritionSource:'illustrative-not-brand-or-recipe-measurement'});
}
data.products.forEach((p,i)=>{p.catalogOrder=i;p.popularityRank=(i*17)%75+1;});
data.version='synthetic-pakistan-catalog-v5';data.scope='Campus convenience store, snacks and takeaway drinks; no complete lunches';
data.adaptationSource='Local study-team scope and candidate selection 2026-10-24; target-campus photos pending';
fs.writeFileSync(path.join(root,'dist/data.js'),'/* 75 provisional convenience-store choices. All prices, nutrition, NOVA and art require local confirmation. */\nglobalThis.CAMPUS_DATA = '+JSON.stringify(data,null,2)+';\n');
const q=s=>"'"+s.replaceAll("'","''")+"'";
const inserts=data.products.map(p=>`(${q(p.id)},${q(data.version)},${q(JSON.stringify(p))}::jsonb)`).join(',\n');
const v7=fs.readFileSync(path.join(root,'supabase/migrations/007_campus_catalog_and_zones.sql'),'utf8');
let submit=v7.slice(v7.indexOf('create or replace function public.submit_pilot_task'),v7.indexOf("notify pgrst"));
submit=submit.replace("case when p.catalog_version='synthetic-pakistan-catalog-v4'", "case when p.catalog_version='synthetic-pakistan-catalog-v5' then 'physical-rack-v4' when p.catalog_version='synthetic-pakistan-catalog-v4'");
const v6=fs.readFileSync(path.join(root,'supabase/migrations/006_factorial_study.sql'),'utf8');
const start=v6.slice(v6.indexOf('create function public.get_or_start_study_task'),v6.indexOf('create function private.study_basket_result')).replace('create function public.get_or_start_study_task','create or replace function public.get_or_start_study_task').replace('jsonb_array_length(s.catalog_snapshot)<>50',"jsonb_array_length(s.catalog_snapshot)<>(case when s.catalog_version='synthetic-pakistan-catalog-v5' then 75 else 50 end)");
const basket=v7.slice(v7.indexOf('create or replace function private.study_basket_result'),v7.indexOf('create or replace function public.submit_pilot_task')).replace('jsonb_array_length(p_basket)>50','jsonb_array_length(p_basket)>jsonb_array_length(p_catalog)');
const sql=`-- Additive convenience-store revision. Do not modify prior participants, studies or receipts.\nbegin;\ninsert into private.catalog(id,version,product) values\n${inserts};\nupdate private.pilot_settings set catalog_version='synthetic-pakistan-catalog-v5' where id=true;\ninsert into private.studies(id,protocol_version,catalog_version,layout_version,base_config,catalog_snapshot)\nselect 'almab-factorial-test-v3','candidate-protocol-v3','synthetic-pakistan-catalog-v5','physical-rack-v4',\n'{"schemaVersion":2,"budget":600,"markupPercent":25,"placementRule":"upf-or-high","controlLayout":"targets-eye"}',jsonb_agg(product order by (product->>'catalogOrder')::integer)\nfrom private.catalog where version='synthetic-pakistan-catalog-v5';\n${start}\n${basket}\n${submit}\nnotify pgrst, 'reload schema';\ncommit;\n`;
fs.writeFileSync(migration,sql);fs.writeFileSync(path.join(root,'cloudbase/03_convenience_store_upgrade.sql'),'-- CloudBase: only after migrations 001-007 (v0.8). Never reinstall the fresh schema.\n'+sql);
console.log('Added '+rows.length+' candidates; removed 3 lunch foods; total '+data.products.length+'. No live data changed.');
