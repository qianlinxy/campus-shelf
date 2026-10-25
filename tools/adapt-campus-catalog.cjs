// One-time v0.8 adaptation. Historical catalogs and applied migrations stay intact.
const fs=require('node:fs'),path=require('node:path');const root=path.resolve(__dirname,'..');
require('../dist/data.js');const data=globalThis.CAMPUS_DATA;
if(data.version!=='synthetic-pakistan-catalog-v3')throw new Error('One-time adaptation only; do not overwrite an existing catalog version.');
fs.mkdirSync(path.join(root,'tests/fixtures'),{recursive:true});fs.writeFileSync(path.join(root,'tests/fixtures/catalog-v3.json'),JSON.stringify(data.products,null,2)+'\n');
const find=id=>data.products.find(p=>p.id===id);
Object.assign(find('cheese'),{id:'cheese-sandwich',zh:'芝士三明治（1份）',en:'Cheese sandwich',ur:'چیز سینڈوچ',kind:'sandwich',category:'meals',packText:'SANDWICH',size:150,price:150,nova:null,eligible:false,kcal:225,fat:8,sugar:3,salt:1.1,saleUnit:'portion',portionCount:1});
Object.assign(find('mango'),{id:'biryani',zh:'鸡肉香饭 Biryani（1盘）',en:'Chicken biryani',ur:'چکن بریانی',kind:'biryani',category:'meals',packText:'BIRYANI',size:300,price:160,nova:null,eligible:false,kcal:180,fat:6,sugar:1,salt:.9,saleUnit:'plate',portionCount:1});
Object.assign(find('toffee'),{id:'toffee-piece',zh:'奶油太妃糖（1颗）',en:'Cream toffee (1 piece)',ur:'کریم ٹافی (ایک عدد)',kind:'toffee-piece',packText:'TOFFEE',size:5,price:10,saleUnit:'piece',portionCount:1,portionNote:'Provisional 5g per piece and PKR10, scaled from the old synthetic 25g/PKR50 example; verify from photos.'});
Object.assign(find('raisins'),{zh:'葡萄干 Kishmish',en:'Kishmish (raisins)',ur:'کشمش',aliases:['kishmish','raisins','kismis','کشمش','葡萄干']});
for(const p of data.products){
 p.displayZone=p.id==='yogurt'||(p.category==='drinks'&&p.id!=='tea')?'fridge':(p.category==='meals'&&p.id!=='noodles')||['tea','cucumber','egg','chaat'].includes(p.id)?'counter':'shelf';
 p.saleUnit||='pack_or_portion';p.portionCount||=1;
}
data.version='synthetic-pakistan-catalog-v4';data.adaptationSource='Local campus feedback 2026-10-24; not a completed availability survey';
fs.writeFileSync(path.join(root,'dist/data.js'),'/* 50 provisional campus foods. Prices, portions, nutrition, NOVA and artwork remain synthetic. */\nglobalThis.CAMPUS_DATA = '+JSON.stringify(data,null,2)+';\n');
const quote=s=>"'"+s.replaceAll("'","''")+"'";
const inserts=data.products.map(p=>`(${quote(p.id)},${quote(data.version)},${quote(JSON.stringify(p))}::jsonb)`).join(',\n');
const old=fs.readFileSync(path.join(root,'supabase/migrations/005_fifty_product_catalog.sql'),'utf8');
let submit=old.slice(old.indexOf('create or replace function public.submit_pilot_task'),old.lastIndexOf('commit;'));
submit=submit.replace("case when p.catalog_version='synthetic-pakistan-catalog-v3'", "case when p.catalog_version='synthetic-pakistan-catalog-v4' then 'physical-rack-v3' when p.catalog_version='synthetic-pakistan-catalog-v3'");
const v6=fs.readFileSync(path.join(root,'supabase/migrations/006_factorial_study.sql'),'utf8');
let basket=v6.slice(v6.indexOf('create function private.study_basket_result'),v6.indexOf('-- Logs have an explicit'));
basket=basket.replace('create function private.study_basket_result','create or replace function private.study_basket_result');
basket=basket.replace("'size',(product->>'size')::numeric", "'sale_unit',coalesce(product->>'saleUnit','pack_or_portion'),'pieces_per_unit',case when product->>'saleUnit'='piece' then (product->>'portionCount')::integer else null end,'size',(product->>'size')::numeric");
const target=path.join(root,'supabase/migrations/007_campus_catalog_and_zones.sql');if(fs.existsSync(target))throw new Error('Migration already exists; do not overwrite.');
fs.writeFileSync(target,`-- New catalog and study; existing participants, frozen studies and receipts are unchanged.\nbegin;\ninsert into private.catalog(id,version,product) values\n${inserts};\nupdate private.pilot_settings set catalog_version='synthetic-pakistan-catalog-v4' where id=true;\ninsert into private.studies(id,protocol_version,catalog_version,layout_version,base_config,catalog_snapshot)\nselect 'almab-factorial-test-v2','candidate-protocol-v2','synthetic-pakistan-catalog-v4','physical-rack-v3',\n'{"schemaVersion":2,"budget":600,"markupPercent":25,"placementRule":"upf-or-high","controlLayout":"targets-eye"}',jsonb_agg(product order by (product->>'catalogOrder')::integer)\nfrom private.catalog where version='synthetic-pakistan-catalog-v4';\n${basket}\n${submit}\nnotify pgrst, 'reload schema';\ncommit;\n`);
console.log('Catalog v4 and additive migration007 generated. No cloud records changed.');
