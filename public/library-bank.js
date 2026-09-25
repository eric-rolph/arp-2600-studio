export function cleanName(value){if(typeof value!=='string')throw new Error('Each patch needs a name.');const name=value.trim();if(!name||name.length>100||/[\x00-\x1f]/.test(name)||['__proto__','prototype','constructor'].includes(name))throw new Error('Use a patch name of 1–100 ordinary characters.');return name;}
export function uniqueName(name,existing){let next=name,n=2;while(Object.hasOwn(existing,next))next=name.slice(0,88)+' ('+n+++')';return next;}
export function metadata(raw={}){return {family:String(raw.family||'Saved').slice(0,50),mode:['Keys','Drone','Sequence','Microphone','Performance','Study'].includes(raw.mode)?raw.mode:'Keys',play:String(raw.play||'Load and play the keyboard.').slice(0,1200),note:Number.isFinite(raw.note)?Math.max(0,Math.min(127,raw.note)):60,...(Number.isFinite(raw.gate)?{gate:Math.max(.01,Math.min(6,raw.gate))}:{}),category:String(raw.category||'User').slice(0,40),description:String(raw.description||'Saved patch.').slice(0,1200),tags:(Array.isArray(raw.tags)?raw.tags:[]).filter(t=>typeof t==='string').slice(0,12).map(t=>t.slice(0,30))};}
export function parseBank(raw,{studio,validate,convertArp}){
 if(!raw||raw.format!=='synth-patch-bank'||raw.version!==1||!Array.isArray(raw.patches)||!raw.patches.length||raw.patches.length>256)throw new Error('Choose a patch bank with 1–256 patches.');
 const convert=raw.studio===studio?validate:studio==='tonto-studio'&&raw.studio==='arp-2600-studio'?convertArp:null;if(!convert)throw new Error('This bank belongs to a different studio.');
 return raw.patches.map(p=>{if(!p||!p.patch?.params||typeof p.patch.params!=='object'||Array.isArray(p.patch.params)||!p.patch?.routes||typeof p.patch.routes!=='object'||Array.isArray(p.patch.routes))throw new Error('A bank entry has no patch data.');return {name:cleanName(p.name),...metadata(p),patch:convert(p.patch)};});
}
export function packBank(studio,entries){return {format:'synth-patch-bank',version:1,studio,patches:entries.map(p=>({name:p.name,...metadata(p),patch:p.patch}))};}
export function matches(entry,{query='',category='',family='',mode='',scope='all'},favorites=new Set()){
 if(category&&entry.category!==category||family&&entry.family!==family||mode&&entry.mode!==mode||scope==='saved'&&!entry.user||scope==='favorites'&&!favorites.has(entry.id))return false;
 const text=[entry.name,entry.category,entry.family,entry.mode,entry.description,entry.play,...entry.tags||[]].join(' ').toLowerCase();return query.toLowerCase().trim().split(/\s+/).every(word=>text.includes(word));
}
