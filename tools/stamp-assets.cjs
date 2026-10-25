// Avoid combining a revised catalog with cached layout, labels or configuration.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
function stamp(){const root=path.resolve(__dirname,'../dist');for(const name of ['index.html','admin.html']){
 const file=path.join(root,name),html=fs.readFileSync(file,'utf8');
 const next=html.replace(/((?:src|href)=")([^"?#]+)(?:\?[^"#]*)?(")/g,(all,prefix,asset,suffix)=>{
  if(!/^[a-zA-Z0-9_./-]+\.(js|css)$/.test(asset)||asset.includes('..'))return all;
  const content=fs.readFileSync(path.join(root,asset)),hash=crypto.createHash('sha256').update(content).digest('hex').slice(0,12);return prefix+asset+'?v='+hash+suffix;
 });if(next!==html)fs.writeFileSync(file,next);
}}
if(require.main===module)stamp();module.exports={stamp};
