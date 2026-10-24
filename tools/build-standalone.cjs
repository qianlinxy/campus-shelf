const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../dist');
let html=fs.readFileSync(path.join(root,'index.html'),'utf8');
html=html.replace('<link rel="stylesheet" href="styles.css">',()=>'<style>\n'+fs.readFileSync(path.join(root,'styles.css'),'utf8')+'\n</style>');
for(const name of ['data.js','core.js','app.js']){
 html=html.replace(`<script src="${name}" defer></script>`,()=>'');
}
const scripts=['data.js','core.js','app.js'].map(name=>'<script>\n'+fs.readFileSync(path.join(root,name),'utf8').replaceAll('</script','<\\/script')+'\n</script>').join('\n');
html=html.replace('</body>',()=>scripts+'\n</body>');
fs.writeFileSync(path.join(root,'standalone.html'),html);
console.log('dist/standalone.html generated; no external assets required.');
