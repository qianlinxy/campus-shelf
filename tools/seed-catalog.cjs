// Generate server fixtures from exactly the same synthetic catalog as the page.
const fs=require('node:fs');require('../dist/data.js');
const data=globalThis.CAMPUS_DATA;
if(data.version!=='synthetic-pakistan-catalog-v2'||data.products.length!==24)throw new Error('Historical generator is locked. Run the existing 001-005 migrations; do not overwrite migration 002.');
const quote=s=>"'"+s.replaceAll("'","''")+"'";
const lines=data.products.map(p=>`insert into private.catalog(id,version,product) values(${quote(p.id)},${quote(data.version)},${quote(JSON.stringify(p))}::jsonb);`);
fs.writeFileSync(require('node:path').join(__dirname,'../supabase/migrations/002_synthetic_catalog.sql'),'-- SYNTHETIC DEMO FIXTURES: never treat these as verified nutrition or prices.\nbegin;\n'+lines.join('\n')+'\ncommit;\n');
console.log('Generated server catalog: '+data.products.length+' synthetic products.');
