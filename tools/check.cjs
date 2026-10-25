const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../dist');
for(const name of fs.readdirSync(root).filter(n=>n.endsWith('.js'))){new vm.Script(fs.readFileSync(path.join(root,name),'utf8'),{filename:name});}
for(const name of ['i18n.js','urdu.js','enrollment-text.js','anthropometry-text.js','rack-text.js','study-text.js','convenience-text.js','data.js'])require(path.join(root,name));
const text=globalThis.CAMPUS_TEXT,keys=Object.keys(text.en).sort();
for(const lang of ['zh','en','ur']){
 if(JSON.stringify(Object.keys(text[lang]).sort())!==JSON.stringify(keys))throw new Error('Language key mismatch: '+lang);
 if(Object.values(text[lang]).some(s=>typeof s!=='string'||!s))throw new Error('Empty translation: '+lang);
}
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
for(const match of html.matchAll(/data-i18n(?:-html)?="([^"]+)"/g))if(!text.en[match[1]])throw new Error('Missing HTML translation '+match[1]);
for(const p of globalThis.CAMPUS_DATA.products)if(!p.ur||!p.zh||!p.en||!p.synthetic)throw new Error('Invalid catalog row '+p.id);
if(globalThis.CAMPUS_DATA.products.length!==75||new Set(globalThis.CAMPUS_DATA.products.map(p=>p.id)).size!==75)throw new Error('Expected 75 unique products');
console.log('Syntax, three-language parity, static text and 75-product catalog checked.');
