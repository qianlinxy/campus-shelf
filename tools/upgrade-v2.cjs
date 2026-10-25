// One-time migration of the original two-language prototype; safe to re-run.
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'../dist');
let app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const match=app.match(/ const TEXT=(\{[\s\S]*?\n \});/);
if(match){
 const dictionary=vm.runInNewContext('('+match[1]+')');
 fs.writeFileSync(path.join(root,'i18n.js'),'globalThis.CAMPUS_TEXT = '+JSON.stringify(dictionary,null,2)+';\n');
 app=app.replace(match[0],' const TEXT=globalThis.CAMPUS_TEXT;');
 fs.writeFileSync(path.join(root,'app.js'),app);
}
