const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../dist');
require('./stamp-assets.cjs').stamp();
let html=fs.readFileSync(path.join(root,'index.html'),'utf8');
html=html.replace(/<link rel="stylesheet" href="(styles|rack)\.css(?:\?[^\"]*)?">/g,(_tag,name)=>'<style>\n'+fs.readFileSync(path.join(root,name+'.css'),'utf8')+'\n</style>');
const names=['config.js','i18n.js','urdu.js','enrollment-text.js','anthropometry-text.js','rack-text.js','study-text.js','convenience-text.js','data.js','auth-core.js','backend.js','vendor/qrcode.js','core.js','camera.js','study-client.js','app.js','enrollment.js'];
html=html.replace(/<script src="([^\"]+)" defer><\/script>/g,(tag,src)=>names.includes(src.split('?')[0])?'':tag);
// The portable file is always a preview; real enrollment runs on the hosted site.
const scripts=names.map(name=>'<script>\n'+(name==='config.js'?'globalThis.CAMPUS_CONFIG={enrollmentEnabled:false};':fs.readFileSync(path.join(root,name),'utf8')).replaceAll('</script','<\\/script')+'\n</script>').join('\n');
html=html.replace('</body>',()=>scripts+'\n</body>');
html=html.replace(/[ \t]+$/gm,'');
fs.writeFileSync(path.join(root,'standalone.html'),html);
console.log('dist/standalone.html generated; no external assets required.');
