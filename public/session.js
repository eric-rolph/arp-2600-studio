import {download} from './tape.js';
const magic='SYNTHSES',encoder=new TextEncoder(),decoder=new TextDecoder();
const settingLimits={speed:[.25,4],saturation:[0,1],wow:[0,.025],flutter:[0,.012]};
const bounded=(value,min,max,fallback)=>Number.isFinite(value)?Math.max(min,Math.min(max,value)):fallback;
const littleEndian=new Uint8Array(new Uint32Array([1]).buffer)[0]===1;
function floatBytes(data){if(littleEndian)return data;const bytes=new ArrayBuffer(data.length*4),view=new DataView(bytes);for(let i=0;i<data.length;i++)view.setFloat32(i*4,data[i],true);return bytes;}
export function packSession(app,patch,tape){
 const parts=[],settings={reverse:!!tape.reverse,loop:!!tape.loop,exportFormat:tape.exportFormat,dither:tape.dither,loopBars:tape.loopBars};for(const key of Object.keys(settingLimits))settings[key]=tape[key];
 const buffer=b=>{if(!b)return null;for(let c=0;c<b.numberOfChannels;c++)parts.push(floatBytes(b.getChannelData(c)));return {frames:b.length,channels:b.numberOfChannels,rate:b.sampleRate};};
 const takes=tape.takes.map(t=>({name:t.name,wet:buffer(t.wet),dry:buffer(t.dry),wetGain:t.wetGain,dryGain:t.dryGain,offset:t.offset,rate:t.rate,muted:!!t.muted,reverse:!!t.reverse,trimStart:t.trimStart,trimEnd:t.trimEnd,fadeIn:t.fadeIn,fadeOut:t.fadeOut}));
 const metadata=encoder.encode(JSON.stringify({version:1,app,patch,settings,takes}));if(metadata.length>16000000)throw new Error('Session metadata exceeds 16 MB. Export part clips into separate sessions.');const header=new Uint8Array(12);header.set(encoder.encode(magic));new DataView(header.buffer).setUint32(8,metadata.length,true);
 const file=new Blob([header,metadata,...parts],{type:'application/octet-stream'});if(file.size>1024*1024*1024)throw new Error('This session exceeds 1 GB. Export some stems and remove those takes before saving.');return file;
}
export async function unpackSession(file,app){
 if(file.size<12||file.size>1024*1024*1024)throw new Error('Choose a session file smaller than 1 GB.');
 const header=await file.slice(0,12).arrayBuffer();if(decoder.decode(new Uint8Array(header,0,8))!==magic)throw new Error('This is not a synth session file.');
 const length=new DataView(header).getUint32(8,true);if(length>16000000||length<2||12+length>file.size)throw new Error('Invalid session header.');
 const metadata=JSON.parse(await file.slice(12,12+length).text());
 if(metadata.version!==1||metadata.app!==app)throw new Error('Open this session in the studio that saved it.');
 if(!Array.isArray(metadata.takes)||metadata.takes.length>8)throw new Error('Invalid session takes.');
 let offset=12+length;
 // Validate all lengths before allocating audio. Trailing or truncated data is rejected.
 for(const take of metadata.takes)for(const [name,b] of [['wet',take.wet],['dry',take.dry]]){
  if(!b){if(name==='wet')throw new Error('A take is missing its audio.');continue;}
  if(!Number.isInteger(b.frames)||b.frames<1||!Number.isInteger(b.channels)||b.channels<1||b.channels>2||!Number.isInteger(b.rate)||b.rate<8000||b.rate>192000||b.frames>b.rate*180)throw new Error('Invalid session audio dimensions.');
  offset+=b.frames*b.channels*4;if(offset>file.size)throw new Error('The session audio is truncated.');
 }
 if(offset!==file.size)throw new Error('Unexpected data at the end of the session.');offset=12+length;
 const read=async b=>{if(!b)return null;const channels=[];for(let c=0;c<b.channels;c++){const bytes=await file.slice(offset,offset+b.frames*4).arrayBuffer(),view=new DataView(bytes),data=new Float32Array(b.frames);for(let i=0;i<data.length;i++){data[i]=view.getFloat32(i*4,true);if(!Number.isFinite(data[i]))throw new Error('The session contains invalid audio samples.');}channels.push(data);offset+=b.frames*4;}return {rate:b.rate,channels};};
 const takes=[];for(const t of metadata.takes)takes.push({id:crypto.randomUUID(),name:String(t.name||'Take').slice(0,120),wet:await read(t.wet),dry:await read(t.dry),wetGain:bounded(t.wetGain,0,1.5,1),dryGain:bounded(t.dryGain,0,1.5,0),rate:bounded(t.rate,.25,4,1),offset:bounded(t.offset,0,60,0),muted:t.muted===true,reverse:t.reverse===true,trimStart:bounded(t.trimStart,0,180,0),trimEnd:bounded(t.trimEnd,0,180,t.wet.frames/t.wet.rate),fadeIn:bounded(t.fadeIn,0,30,0),fadeOut:bounded(t.fadeOut,0,30,0)});
 const settings={reverse:metadata.settings?.reverse===true,loop:metadata.settings?.loop===true,exportFormat:[16,24,32].includes(metadata.settings?.exportFormat)?metadata.settings.exportFormat:24,dither:metadata.settings?.dither!==false,loopBars:[0,1,2,4,8,16].includes(metadata.settings?.loopBars)?metadata.settings.loopBars:0};for(const [key,[min,max]]of Object.entries(settingLimits))settings[key]=bounded(metadata.settings?.[key],min,max,key==='speed'?1:0);
 return {patch:metadata.patch,settings,takes};
}
export function setupSessions({app,engine,tape,getPatch,validatePatch,loadPatch,status}){
 const root=document.querySelector('.transport'),group=document.createElement('div'),save=document.createElement('button'),open=document.createElement('button'),input=document.createElement('input');group.className='session-controls';group.style.cssText='display:flex;gap:8px;flex-wrap:wrap;margin-block:8px';save.id='save-session';save.textContent='Save session';open.id='open-session-button';open.textContent='Open session';input.id='open-session';input.type='file';input.accept='.synthsession';input.hidden=true;open.onclick=()=>input.click();group.append(save,open,input);root.append(group);
 const run=async fn=>{save.disabled=true;open.disabled=true;input.disabled=true;try{await fn();}catch(error){status(error.message,true);}finally{save.disabled=false;open.disabled=false;input.disabled=false;input.value='';}};
 save.onclick=()=>run(async()=>{await engine.recoveryReady;await tape.stopRecord();download(packSession(app,getPatch(),tape),app+'.synthsession');status('Session saved with the patch, tape settings and full-resolution recordings.');});
 input.onchange=()=>run(async()=>{
  const file=input.files[0];if(!file)return;await engine.recoveryReady;const session=await unpackSession(file,app),patch=validatePatch(session.patch);
  if((tape.takes.length||tape.recording)&&!confirm('Replace the current patch and recordings? Save the current session first if you want to keep it.'))return;
  await tape.init();const convert=b=>{if(!b)return null;const audio=engine.ctx.createBuffer(b.channels.length,b.channels[0].length,b.rate);b.channels.forEach((channel,i)=>audio.copyToChannel(channel,i));return audio;};
  const takes=session.takes.map(t=>({...t,wet:convert(t.wet),dry:convert(t.dry)}));await tape.stopRecord();tape.stop();loadPatch(patch);tape.takes=takes;Object.assign(tape,session.settings);tape.changed();tape.dispatchEvent(new Event('restore'));
  for(const key of ['saturation','wow','flutter','loop','reverse']){const el=document.getElementById(key);if(el.type==='checkbox')el.checked=tape[key];else el.value=tape[key];}
  const speed=document.getElementById('tape-speed');speed.value=Math.log2(tape.speed);speed.dispatchEvent(new Event('input',{bubbles:true}));status('Session restored. Recordings and patch are ready.');
 });
}
