/* Retained credential-safe publisher. No credential is written to disk/argv. */
const {spawn,spawnSync}=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const project=JSON.parse(fs.readFileSync('.openai/hosting.json','utf8')).project_id;
function git(args,input){const r=spawnSync('git',['-c',`safe.directory=${process.cwd().replaceAll('\\','/')}`,...args],{encoding:input===undefined?'utf8':undefined,input,timeout:12000,windowsHide:true});if(r.error||r.status!==0)throw Error('Local Git operation failed: '+String(r.stderr||r.error?.message||''));return r.stdout;}
async function readInput(){process.stderr.write('Ready for source JSON on stdin (input hidden).\n');if(process.stdin.isTTY)process.stdin.setRawMode(true);return new Promise((resolve,reject)=>{let text='';const done=()=>{process.stdin.removeAllListeners('data');if(process.stdin.isTTY)process.stdin.setRawMode(false);process.stdin.pause();try{resolve(JSON.parse(text));}catch{reject(Error('Invalid source JSON'));}};process.stdin.setEncoding('utf8');process.stdin.on('data',chunk=>{if(chunk.includes('\u0003')){reject(Error('Cancelled'));return;}text+=chunk;if(text.includes('\n')||text.includes('\r'))done();});});}
(async()=>{
 const request=await readInput(),credential=request.credential;
 if(credential?.auth_mode!=='http_extra_header'||typeof credential.token!=='string')throw Error('Returned bearer repository credential required.');
 if(Date.parse(credential.token_expires_at)<=Date.now())throw Error('Renew source credential for this Site.');
 if(!new URL(credential.remote_url).pathname.endsWith('/'+project+'.git'))throw Error('Site identity and repository do not match.');
 console.log('Preparing reviewed source commit…');
 git(['add','--all','--','.']);
 const diff=spawnSync('git',['-c',`safe.directory=${process.cwd().replaceAll('\\','/')}`,'diff','--cached','--quiet'],{windowsHide:true});
 if(diff.status===1)git(['-c','user.name=Sites','-c','user.email=sites@users.noreply.openai.com','commit','-m','Build campus virtual shelf prototype']);
 else if(diff.status!==0)throw Error('Could not inspect source index.');
 const sha=git(['rev-parse','HEAD']).trim();
 const pack=git(['pack-objects','--stdout','--revs'],Buffer.from(sha+'\n'));
 fs.mkdirSync('.publication',{recursive:true});const packPath=path.resolve('.publication','source-'+sha+'.pack');fs.writeFileSync(packPath,pack);
 const shell=process.env.SITES_PWSH||'pwsh';
 console.log('Synchronising with the returned repository using standard TLS…');
 const child=spawn(shell,['-NoProfile','-File',path.resolve('tools/sync-source.ps1')],{windowsHide:true,stdio:['pipe','pipe','pipe']});
 let stdout='',stderr='';child.stdout.on('data',x=>stdout+=x);child.stderr.on('data',x=>stderr+=x);
 child.stdin.end(JSON.stringify({credential,project_id:project,commit_sha:sha,pack_path_b64:Buffer.from(packPath,'utf8').toString('base64')}));
 child.on('error',()=>{console.error('Could not start secure source transport.');process.exitCode=1;});
 child.on('close',code=>{const redact=s=>s.split(credential.token).join('[redacted]');if(code!==0){console.error(redact(stderr));process.exitCode=1;}else{process.stdout.write(redact(stdout));}});
})().catch(e=>{console.error(e.message);process.exitCode=1;});
