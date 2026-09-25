import {setupHardware} from './hardware-ui.js';
import {setupCalibration} from './calibration-ui.js';
import {setupParts} from './parts-ui.js';
import {setupTransport} from './transport-ui.js';
import {setupPerformanceEditor} from './performance-editor.js';
import {setupTapeEditing} from './tape-edit.js';
import {setupRecovery} from './recovery.js';
import {setupPerformance} from './performance-ui.js';
import {setupHistory} from './history.js';
import {validatePatch as validateState} from './patch-state.js';
import {setupLibrary} from './library-ui.js';
import {cleanName,uniqueName} from './library-bank.js';
import {setupInterface} from './interface.js';
import {setupSessions} from './session.js';
import {Engine} from './engine.js';
import {Tape,download} from './tape.js';
import {PatchBay} from './patchbay.js';
import {defaults,sources,destinations,normal,presets,presetNotes,arpLibrary} from './model.js';

const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const engine=new Engine(),tape=new Tape(engine),controls=new Map();
let powerBusy=false,micBusy=false,lastMeter={peak:0,mic:0,ef:0},userPresets=Object.create(null);
const sourceNames=Object.fromEntries(sources),destNames=Object.fromEntries(destinations.map(([id,name])=>[id,name]));
function status(message,error=false){$('#status').textContent=message;$('#status').style.color=error?'#ffae90':'';}
function safe(fn){return async(...args)=>{try{await fn(...args);}catch(e){status(e.message||String(e),true);}};}
function fmt(v,unit){if(unit==='Hz')return v>=1000?(v/1000).toFixed(1)+'k':Math.round(v)+'Hz';if(unit==='s')return v<1?Math.round(v*1000)+'ms':v.toFixed(1)+'s';if(unit==='st')return (v>0?'+':'')+v.toFixed(0);if(unit==='ct')return (v>0?'+':'')+v.toFixed(0)+'¢';if(unit==='V')return v.toFixed(1)+'V';if(unit==='x')return v.toFixed(1)+'×';return Math.round(v*100)+'%';}
function fader(key,label,min=0,max=1,unit='',log=false){
  controls.set(key,{min,max,unit,log});const value=defaults[key];const position=log?Math.log(value/min)/Math.log(max/min):value;
  return `<label class="fader" title="${label}. Double-click to reset."><span>${label}</span><div class="slot"><input type="range" data-param="${key}" aria-label="${key}: ${label}" min="${log?0:min}" max="${log?1:max}" step="${log?.001:(max-min)/1000}" value="${position}"></div><output data-value="${key}">${fmt(value,unit)}</output></label>`;
}
function jack(id,type,label){return `<div class="jack-wrap"><button class="jack ${type}" data-jack="${id}" data-type="${type}" aria-label="${type==='output'?'Output':'Input'}: ${(type==='output'?sourceNames:destNames)[id]}" title="${(type==='output'?sourceNames:destNames)[id]}${type==='input'?' · normal: '+sourceNames[normal[id]]:''}"></button><span class="jack-label">${label||id}</span>${type==='input'?`<span class="normal-label">${normal[id].replace('keyboard','KYBD').replace('preamp','PRE').replace('filter','VCF')}</span>`:''}</div>`;}
const jacks=(arr,type)=>`<div class="jacks">${arr.map(([id,label])=>jack(id,type,label)).join('')}</div>`;
const row=(...items)=>`<div class="faders">${items.join('')}</div>`;
const module=(name,id,span,sub,content)=>`<section class="module span${span}" aria-label="${name}"><h2>${name}<b>${id}</b></h2><div class="sub">${sub}</div>${content}</section>`;
function osc(n){const b='v'+n;return module('Oscillator '+n,'VCO '+n,4,n===2?'SINE / TRIANGLE / SAW / PULSE':'SAWTOOTH / PULSE',`<label class="module-toggle"><input type="checkbox" data-toggle="${b}lf"> LOW FREQUENCY RANGE</label>`+row(fader(b+'coarse','Frequency',-48,48,'st'),fader(b+'fine','Fine tune',-100,100,'ct'),fader(b+'fm','FM depth',0,3,'V'),fader(b+'pw','Pulse width',.03,.97))+ (n===2?`<label class="module-toggle">PWM <input type="range" data-param="v2pwm" aria-label="VCO 2 pulse-width modulation" min="0" max="1" step=".01" value="0"></label>`:'')+jacks(n===2?[[b+'saw','╱'],[b+'pulse','⊓'],[b+'sine','∿'],[b+'tri','△']]:[[b+'saw','╱'],[b+'pulse','⊓']],'output')+jacks(n===2?[[b+'pitch','KYBD'],[b+'fm','FM'],['v2pwm','PWM']]:[[b+'pitch','KYBD'],[b+'fm','FM']],'input'));}
$('#modules').innerHTML=
 module('External input','PRE',3,'MIC PREAMP / FOLLOWER',row(fader('preamp','Mic gain',.1,30,'x',true),fader('efGain','EF gain',.1,10,'x',true))+`<div class="module-meter"><span id="ef-meter"></span></div><div class="faders small">${fader('efAttack','Attack',.001,.2,'s',true)}${fader('efRelease','Release',.01,2,'s',true)}</div>`+jacks([['preamp','MIC OUT'],['ef','ENV']],'output')+jacks([['efInput','EF IN']],'input')+`<div class="mic-patch-controls"><button id="mic-enable">Enable mic</button><button id="patch-mic">Patch mic</button></div><p id="mic-patch-status" class="mic-patch-note">Microphone off. Enable it to send a signal.</p>`)+
 [1,2,3].map(osc).join('')+
 module('Voltage controlled filter','VCF',6,'24 dB/OCT · RESONANT LOW PASS',row(fader('cutoff','Cutoff',20,18000,'Hz',true),fader('resonance','Resonance',0,.98),fader('filterEnv','Env depth',-4,6,'V'),fader('filterFM','Audio FM',0,3,'V'),fader('filterKey','Key track',0,1),fader('drive','Drive',0,1))+`<div class="faders small">${fader('v1level','VCO 1')}${fader('v2level','VCO 2')}${fader('v3level','VCO 3')}${fader('noiseLevel','Noise')}${fader('ringLevel','Ring')}${fader('micLevel','Preamp')}</div>`+jacks([['filter1','1'],['filter2','2'],['filter3','3'],['filterNoise','NOISE'],['filterRing','RING'],['filterMic','MIC']],'input')+jacks([['filterPitch','KYBD'],['filterEnv','ENV'],['filterFM','FM']],'input')+jacks([['vcf','VCF OUT']],'output'))+
 module('Amplifier','VCA',3,'ENVELOPE / INITIAL GAIN',row(fader('vcaInitial','Initial'),fader('vcaAdsr','ADSR'),fader('vcaAr','AR'))+`<div class="faders small">${fader('vcaRing','Ring mix')}</div>`+jacks([['vcaAudio','AUDIO'],['vcaRing','RING']],'input')+jacks([['vcaCV','ENV'],['vcaAR','AR']],'input')+jacks([['vca','OUT']],'output'))+
 module('Ring modulator','RM',4,'FOUR-QUADRANT MULTIPLIER',`<label class="module-toggle"><input type="checkbox" data-toggle="ringAC" checked> AC COUPLING</label><div class="faders small">${fader('ringX','Input A')}${fader('ringY','Input B')}</div>`+jacks([['ringA','INPUT A'],['ringB','INPUT B']],'input')+jacks([['ring','RING OUT']],'output'))+
 module('Envelope generators','ADSR / AR',6,'KEYBOARD / PATCHABLE GATE',`<div class="faders small">${fader('attack','Attack',.001,5,'s',true)}${fader('decay','Decay',.005,8,'s',true)}${fader('sustain','Sustain')}${fader('release','Release',.005,10,'s',true)}${fader('arAttack','AR attack',.001,5,'s',true)}${fader('arRelease','AR release',.005,10,'s',true)}</div>`+jacks([['adsr','ADSR'],['ar','AR'],['gate','GATE'],['keyboard','LOW'],['keyboardUpper','HIGH'],['lfo','LFO']],'output')+jacks([['adsrGate','ADSR GATE'],['arGate','AR GATE']],'input'))+
 module('Noise generator','NG',3,'WHITE → PINK → LOW',`<div class="faders small">${fader('noiseColor','Color')}</div>`+jacks([['noise','NOISE OUT']],'output'))+
 module('Sample & hold','S/H',4,'INTERNAL CLOCK / SWITCH',`<div class="faders small">${fader('clock','Clock',.2,30,'Hz',true)}${fader('shLevel','Level',0,4,'V')}</div>`+jacks([['sh','S/H'],['clock','CLOCK'],['switch','SWITCH']],'output')+jacks([['shInput','SIGNAL'],['shClock','CLOCK'],['switchA','A'],['switchB','B']],'input'))+
 module('Voltage processor','VP',4,'ATTENUATE / INVERT / LAG',`<div class="faders small">${fader('procA','A',-1,1,'x')}${fader('procB','B',-1,1,'x')}${fader('offset','Offset',-5,5,'V')}${fader('lag','Lag',.001,2,'s',true)}</div>`+jacks([['processor','SUM'],['lag','LAG']],'output')+jacks([['procA','A'],['procB','B'],['lagInput','LAG IN']],'input'))+
 module('Output & spring','OUT',3,'STEREO REVERBERATION',`<div class="faders small">${fader('reverb','Spring')}${fader('reverbTime','Decay')}${fader('pan','Pan',-1,1,'x')}${fader('master','Level')}</div><p class="sub" style="margin-top:18px;line-height:1.9">OUTPUT → TAPE<br>SAFE OUTPUT LIMITER<br><span id="sample-rate">AUDIO ENGINE OFF</span></p>`);
controls.set('v2pwm',{min:0,max:1});
function syncControls(){
  for(const el of $$('[data-param]')){const key=el.dataset.param,v=engine.params[key],cfg=controls.get(key);el.value=cfg?.log?Math.log(v/cfg.min)/Math.log(cfg.max/cfg.min):v;const out=$(`[data-value="${key}"]`);if(out)out.textContent=fmt(v,cfg.unit);}
  for(const el of $$('[data-toggle]'))el.checked=engine.params[el.dataset.toggle]>.5;
  $('#duo').checked=engine.params.duo>.5;$('#glide').value=engine.params.glide;$('#vibrato').value=engine.params.vibrato;$('#octave').textContent='OCT '+(engine.params.octave>0?'+':'')+engine.params.octave;
}
for(const el of $$('[data-param]')){
  el.addEventListener('input',()=>{const key=el.dataset.param,cfg=controls.get(key),raw=Number(el.value),v=cfg.log?cfg.min*(cfg.max/cfg.min)**raw:raw;engine.set(key,v);const out=$(`[data-value="${key}"]`);if(out)out.textContent=fmt(v,cfg.unit);});
  el.addEventListener('dblclick',()=>{engine.set(el.dataset.param,defaults[el.dataset.param]);syncControls();});
}
for(const el of $$('[data-toggle]'))el.onchange=()=>engine.set(el.dataset.toggle,el.checked?1:0);
$('#glide').oninput=e=>engine.set('glide',+e.target.value);$('#vibrato').oninput=e=>engine.set('vibrato',+e.target.value);

try{for(const [name,p]of Object.entries(JSON.parse(localStorage.getItem('2600-patches')||'{}')))try{userPresets[cleanName(name)]={...validatedPatch(p),...(p.library?{library:p.library}:{})};}catch{}}catch{}
function fillPresets(){
  const select=$('#preset');select.replaceChildren();
  const groups=new Map();
  for(const name of Object.keys(presets)){
    const category=name.startsWith('Warm ·')?'Pad':name.startsWith('Metal ·')?'Percussion':name.split(' · ')[0];
    if(!groups.has(category)){const group=document.createElement('optgroup');group.label=category;groups.set(category,group);select.append(group);}
    const option=new Option(name,name);option.title=presetNotes[name]||'Saved in this browser.';groups.get(category).append(option);
  }
  if(Object.keys(userPresets).length){const group=document.createElement('optgroup');group.label='Saved in this browser';for(const name of Object.keys(userPresets))group.append(new Option(name,'user:'+name));select.append(group);}
}
function describePreset(){const name=$('#preset').value;$('#preset-note').textContent=presetNotes[name]||userPresets[name.slice(5)]?.library?.description||'Saved in this browser.';}

function validatedPatch(patch){return validateState(patch);}
$('#preset').onchange=()=>{const value=$('#preset').value,patch=value.startsWith('user:')?userPresets[value.slice(5)]:presets[value]||userPresets[value];if(!patch)return;const p=validatedPatch(patch);if(!value.startsWith('user:')&&!userPresets[value])Object.assign(p,{performance:structuredClone(engine.state.performance),sharedPerformance:structuredClone(engine.state.sharedPerformance),parts:structuredClone(engine.state.parts),partFocus:engine.state.partFocus,calibration:structuredClone(engine.state.calibration)});engine.panic();engine.load(p.params,p.routes,p);patchBay.cancel();syncControls();drawCables();renderRoutes();describePreset();status('Loaded '+$('#preset').selectedOptions[0].textContent+'.');};
function writeMemories(next){const current=$('#preset').value;localStorage.setItem('2600-patches',JSON.stringify(next));userPresets=next;fillPresets();$('#preset').value=current;}
$('#save-patch').onclick=safe(()=>{const requested=prompt('Name this patch:','My patch');if(!requested?.trim())return;const name=uniqueName('User · '+cleanName(requested),userPresets),next=Object.assign(Object.create(null),userPresets,{[name]:validatedPatch(engine.state)});writeMemories(next);$('#preset').value='user:'+name;describePreset();status('Patch saved in this browser.');});
window.addEventListener('storage',e=>{if(e.key!=='2600-patches')return;try{const next=Object.create(null),current=$('#preset').value;for(const [name,p]of Object.entries(JSON.parse(e.newValue||'{}')))try{next[cleanName(name)]={...validatedPatch(p),...(p.library?{library:p.library}:{})};}catch{}userPresets=next;fillPresets();$('#preset').value=current;}catch{}});
setupLibrary({studio:'arp-2600-studio',entries:arpLibrary,getSaved:()=>userPresets,writeSaved:writeMemories,capture:()=>validatedPatch(engine.state),validate:validatedPatch,routeName:id=>sourceNames[id]||destNames[id]||id,load:entry=>{const p=validatedPatch(entry.patch);if(!entry.user)Object.assign(p,{performance:structuredClone(engine.state.performance),sharedPerformance:structuredClone(engine.state.sharedPerformance),parts:structuredClone(engine.state.parts),partFocus:engine.state.partFocus,calibration:structuredClone(engine.state.calibration)});engine.panic();engine.load(p.params,p.routes,p);patchBay.cancel();syncControls();drawCables();renderRoutes();$('#preset').value=entry.user?'user:'+entry.name:entry.name;$('#preset-note').textContent=entry.description+' '+entry.play;status('Loaded '+entry.name+'.');}});
$('#export-patch').onclick=()=>download(new Blob([JSON.stringify(engine.state,null,2)],{type:'application/json'}),'2600-patch.json');
$('#import-patch').onchange=safe(async e=>{const file=e.target.files[0];if(!file)return;if(file.size>16000000)throw new Error('Patch file is too large.');const p=validatedPatch(JSON.parse(await file.text()));engine.panic();engine.load(p.params,p.routes,p);patchBay.cancel();syncControls();drawCables();renderRoutes();$('#preset-note').textContent='Imported patch.';status('Patch imported.');e.target.value='';});fillPresets();

for(const [id,name]of sources)$('#route-source').add(new Option(name,id));for(const [id,name]of destinations)$('#route-dest').add(new Option(name,id));
function doPatch(dest,src){patchBay.cancel();engine.patch(dest,src);drawCables();renderRoutes();const micHint=(src==='preamp'||src==='ef')&&!engine.micStream?' Enable Microphone to send a signal.':'';status(src?`Connected ${sourceNames[src]} to ${destNames[dest]}.${micHint}`:`${destNames[dest]} restored to ${sourceNames[normal[dest]]}.`);}
const patchBay=new PatchBay({rack:$('#rack'),cables:$('#cables'),hint:$('#patch-hint'),routes:()=>engine.routes,onPatch:doPatch,status,sourceNames,destNames});
$('#patch-mic').onclick=()=>{patchBay.begin($('[data-jack="preamp"][data-type="output"]'));if(!engine.micStream)status('Choose any green-ringed input. Enable Microphone to send a signal.');};
$('#connect-route').onclick=()=>doPatch($('#route-dest').value,$('#route-source').value);
$('#clear-patch').onclick=()=>{engine.routes={};engine.configure();patchBay.cancel();drawCables();renderRoutes();status('All patch cables removed. Internal connections restored.');};
$('#dock-keys').onclick=()=>{const on=$('.keyboard-panel').classList.toggle('docked');$('#dock-keys').setAttribute('aria-pressed',String(on));};
$('#show-normals').onclick=()=>{const open=$('#routing').hidden;$('#routing').hidden=!open;$('#show-normals').setAttribute('aria-pressed',String(open));};
function renderRoutes(){const container=$('#route-list');container.replaceChildren();for(const [dest,src] of Object.entries(engine.routes)){const chip=document.createElement('span');chip.className='route-chip';chip.append(document.createTextNode(`${sourceNames[src]} → ${destNames[dest]}`));const button=document.createElement('button');button.textContent='×';button.setAttribute('aria-label',`Remove ${sourceNames[src]} to ${destNames[dest]}`);button.onclick=()=>doPatch(dest,null);chip.append(button);container.append(chip);}}
function drawCables(){patchBay.draw();}

async function power(){if(powerBusy)return;powerBusy=true;try{await engine.start();$('#power').textContent='⏻ Audio on';$('#power').classList.add('active');$('#audio-state').textContent='ENGINE RUNNING';$('#sample-rate').textContent=`${engine.ctx.sampleRate/1000} kHz / 2× OSC`;status('Audio ready. Play the keyboard or connect a microphone.');}finally{powerBusy=false;}}
$('#power').onclick=safe(async()=>{if(engine.ctx?.state==='running'){engine.panic();tape.stop();await tape.stopRecord();await engine.ctx.suspend();$('#power').textContent='⏻ Power on';$('#audio-state').textContent='AUDIO SUSPENDED';status('Audio suspended.');return;}await power();});
$('#panic').onclick=()=>{engine.panic();tape.stop();highlightKeys();status('Notes, feedback and reverb cleared.');};
engine.addEventListener('ready',()=>{const update=()=>{const running=engine.ctx.state==='running';$('#power').textContent=running?'⏻ Audio on':'⏻ Power on';$('#power').classList.toggle('active',running);$('#power').setAttribute('aria-pressed',String(running));$('#audio-state').textContent=running?'ENGINE RUNNING':'AUDIO SUSPENDED';$('#sample-rate').textContent=`${engine.ctx.sampleRate/1000} kHz / 2× OSC`;};engine.ctx.onstatechange=update;update();});
engine.addEventListener('meter',e=>{lastMeter=e.detail;});engine.addEventListener('error',e=>status(e.detail,true));
engine.addEventListener('control',syncControls);engine.addEventListener('notes',highlightKeys);
async function devices(){if(!navigator.mediaDevices)return;const list=await navigator.mediaDevices.enumerateDevices(),select=$('#mic-device'),value=select.value;select.replaceChildren(new Option('Default input',''));for(const d of list.filter(d=>d.kind==='audioinput'&&d.deviceId!=='default'))select.add(new Option(d.label||'Microphone',d.deviceId));select.value=value;}
function syncMicrophone(){
 const live=!!engine.micStream;
 $('#mic').textContent=live?'● Microphone':'○ Microphone';$('#mic').classList.toggle('active',live);$('#mic').disabled=micBusy;
 $('#mic-enable').textContent=micBusy?'Connecting...':live?'Disable mic':'Enable mic';$('#mic-enable').classList.toggle('active',live);$('#mic-enable').disabled=micBusy;
 $('#mic-patch-status').textContent=live?'Microphone live. MIC OUT can feed any input.':'Microphone off. Enable it to send a signal.';
}
$('#mic').onclick=$('#mic-enable').onclick=safe(async()=>{
 if(micBusy)return;
 if(engine.micStream){engine.stopMicrophone();syncMicrophone();status('Microphone disconnected. Its patch cables are kept.');return;}
 micBusy=true;syncMicrophone();
 try{await power();const connected=await engine.microphone($('#mic-device').value);await devices();if(connected)status('Microphone live. Patch MIC OUT to any input. Use headphones.');}
 finally{micBusy=false;syncMicrophone();}
});
$('#mic-device').onchange=safe(async()=>{if(engine.micStream||engine.micPending){try{if(await engine.microphone($('#mic-device').value))status('Microphone input changed.');}finally{syncMicrophone();}}});
engine.addEventListener('micended',()=>{syncMicrophone();status('Microphone disconnected. Its patch cables are kept.');});
$('#midi').onclick=safe(async()=>{await power();const n=await engine.midi();$('#midi').classList.add('active');$('#midi').textContent='● MIDI';status(n?`${n} MIDI input${n>1?'s':''} connected.`:'MIDI enabled. Connect a keyboard to begin.');});
engine.addEventListener('midistate',e=>{$('#midi-status').textContent=e.detail.length?e.detail.join(' · '):'MIDI ENABLED · NO DEVICE';});

const keymap={'a':0,'w':1,'s':2,'e':3,'d':4,'f':5,'t':6,'g':7,'y':8,'h':9,'u':10,'j':11,'k':12,'o':13,'l':14,'p':15,';':16,"'":17};
const blackNotes=new Set([1,3,6,8,10]);let whiteIndex=0;const whiteCount=29;
for(let n=48;n<=96;n++){const black=blackNotes.has(n%12),button=document.createElement('button');button.className='key '+(black?'black':'white');button.dataset.note=n;button.setAttribute('aria-label',`${['C','C sharp','D','D sharp','E','F','F sharp','G','G sharp','A','A sharp','B'][n%12]}${Math.floor(n/12)-1}`);button.style.width=(black?.61:1)*100/whiteCount+'%';button.style.left=(black?whiteIndex-.305:whiteIndex)*100/whiteCount+'%';if(!black)whiteIndex++;const hint=Object.keys(keymap).find(k=>keymap[k]===n-60);button.innerHTML=`<span>${hint?.toUpperCase()||((n%12===0)?'C'+(Math.floor(n/12)-1):'')}</span>`;$('#keyboard').append(button);}
const pointers=new Map(),pendingKeys=new Set();
function sizeKeyboard(){const compact=matchMedia('(max-width:560px)').matches;let pos=0;const count=compact?15:29;for(const key of $$('.key')){const n=+key.dataset.note,black=blackNotes.has(n%12);key.hidden=compact&&n>72;key.style.width=(black?.61:1)*100/count+'%';key.style.left=(black?pos-.305:pos)*100/count+'%';if(!black)pos++;}$('#keyboard').setAttribute('aria-label',compact?'Two octave keyboard; use octave buttons for other registers':'Four octave keyboard');}
sizeKeyboard();window.addEventListener('resize',sizeKeyboard);
function highlightKeys(){const active=new Set([...engine.notes.values()].map(n=>n.note));for(const k of $$('.key'))k.classList.toggle('pressed',active.has(+k.dataset.note));}
$('#keyboard').addEventListener('pointerdown',safe(async e=>{const key=e.target.closest('.key');if(!key)return;e.preventDefault();const id='pointer-'+e.pointerId;pointers.set(e.pointerId,+key.dataset.note);key.setPointerCapture(e.pointerId);await engine.start();if(!pointers.has(e.pointerId))return;engine.on(+key.dataset.note,1,id);highlightKeys();}));
$('#keyboard').addEventListener('pointermove',e=>{if(!pointers.has(e.pointerId))return;const key=document.elementFromPoint(e.clientX,e.clientY)?.closest('.key');if(key&&+key.dataset.note!==pointers.get(e.pointerId)){engine.off('pointer-'+e.pointerId);pointers.set(e.pointerId,+key.dataset.note);engine.on(+key.dataset.note,1,'pointer-'+e.pointerId);highlightKeys();}});
for(const event of ['pointerup','pointercancel','lostpointercapture'])$('#keyboard').addEventListener(event,e=>{if(pointers.has(e.pointerId)){engine.off('pointer-'+e.pointerId);pointers.delete(e.pointerId);highlightKeys();}});
function octave(delta){engine.set('octave',Math.max(-3,Math.min(3,engine.params.octave+delta)));syncControls();}
$('#duo').onchange=e=>{engine.set('duo',e.target.checked?1:0);if(e.target.checked)doPatch('v2pitch','keyboardUpper');else if(engine.routes.v2pitch==='keyboardUpper')doPatch('v2pitch',null);engine.trigger(false);};
let manualHeld=false;engine.addEventListener('panic',()=>{pendingKeys.clear();pointers.clear();manualHeld=false;highlightKeys();});
$('#manual-gate').onpointerdown=safe(async e=>{manualHeld=true;e.target.setPointerCapture(e.pointerId);await engine.start();if(manualHeld)engine.on(60,1,'manual');highlightKeys();});
for(const ev of ['pointerup','pointercancel','lostpointercapture'])$('#manual-gate').addEventListener(ev,()=>{manualHeld=false;engine.off('manual');highlightKeys();});
$('#oct-down').onclick=()=>octave(-1);$('#oct-up').onclick=()=>octave(1);
window.addEventListener('keydown',safe(async e=>{if(e.target.matches('input,select,textarea')||document.querySelector('dialog[open]')||e.ctrlKey||e.metaKey||e.altKey)return;const key=e.key.toLowerCase();if(e.repeat)return;if(key==='escape'){patchBay.cancel();engine.panic();highlightKeys();return;}if(key==='z')return octave(-1);if(key==='x')return octave(1);if(key in keymap){e.preventDefault();pendingKeys.add(key);await engine.start();if(pendingKeys.has(key))engine.on(60+keymap[key],1,'key-'+key);highlightKeys();}}));
window.addEventListener('keyup',e=>{const key=e.key.toLowerCase();pendingKeys.delete(key);if(key in keymap){engine.off('key-'+key);highlightKeys();}});
window.addEventListener('blur',()=>{pendingKeys.clear();pointers.clear();engine.dropNotes(id=>String(id).startsWith('key-')||String(id).startsWith('pointer-')||id==='manual');manualHeld=false;highlightKeys();});
window.addEventListener('beforeunload',e=>{if(tape.takes.length||tape.recording){e.preventDefault();e.returnValue='';}});

function time(t){return `${Math.floor(t/60).toString().padStart(2,'0')}:${Math.floor(t%60).toString().padStart(2,'0')}.${Math.floor(t%1*100).toString().padStart(2,'0')}`;}
$('#record').onclick=safe(async()=>{if(tape.recording){tape.stopRecord();return;}const request=tape.recordRequest;await power();if(request!==tape.recordRequest)return;if(await tape.record())status('Recording synth and dry microphone. Stop to keep this take.');});
$('#tape-stop').onclick=()=>{tape.stopRecord();tape.stop();};$('#tape-play').onclick=safe(async()=>{const request=tape.playRequest;await power();if(request!==tape.playRequest)return;if(await tape.play()!==false)status('Tape playback started. Play or record another pass over it.');});
function tapeChange(){tape.updatePlayback();}
function setSpeed(speed){tape.speed=speed;$('#tape-speed').value=Math.log2(speed);$('#speed-readout').textContent=`${speed.toFixed(2)}× · ${(12*Math.log2(speed)>=0?'+':'')+(12*Math.log2(speed)).toFixed(1)} st`;$$('[data-speed]').forEach(b=>b.classList.toggle('active',Math.abs(+b.dataset.speed-speed)<.001));tapeChange();}
$('#tape-speed').oninput=e=>{setSpeed(2**Number(e.target.value));};$$('[data-speed]').forEach(b=>b.onclick=()=>setSpeed(+b.dataset.speed));
for(const key of ['saturation','wow','flutter'])$('#'+key).oninput=e=>{tape[key]=+e.target.value;tapeChange();};
for(const key of ['loop','reverse'])$('#'+key).onchange=e=>{tape[key]=e.target.checked;tapeChange(key==='reverse');};
$('#import-audio').onchange=safe(async e=>{if(!e.target.files[0])return;await tape.importFile(e.target.files[0]);e.target.value='';status('Audio imported into the tape deck.');});
$('#export-mix').onclick=safe(async()=>{const button=$('#export-mix');button.disabled=true;button.textContent='Rendering…';try{download(await tape.export(),'2600-tape-mix.wav');status('Stereo WAV exported with tape speed and effects.');}finally{button.disabled=false;button.textContent='↓ Export mix WAV';}});
tape.addEventListener('notice',e=>status(e.detail));tape.addEventListener('change',renderTakes);
function renderTakes(){
  $('#record').classList.toggle('active',tape.recording);$('#record').setAttribute('aria-pressed',String(tape.recording));$('#tape-play').setAttribute('aria-pressed',String(tape.playing));$('#record').textContent=tape.recording?'● Recording':'● Record';$('#tape-play').classList.toggle('active',tape.playing);$('#tape-lamp').classList.toggle('recording',tape.recording);$('#tape-status').textContent=tape.recording?'RECORDING':tape.playing?'PLAYING':'STOPPED';$('#take-count').textContent=`${tape.takes.length} TAKE${tape.takes.length===1?'':'S'}`;
  const root=$('#takes');root.replaceChildren();if(!tape.takes.length){root.innerHTML='<div class="empty-tape">No recordings yet.<span>Press Record to capture the synth and microphone.</span></div>';return;}
  for(const take of tape.takes){const card=document.createElement('div');card.className='take';const title=document.createElement('div'),heading=document.createElement('h3');heading.textContent=take.name;const meta=document.createElement('small');meta.textContent=`${time(take.wet.duration)} / ${take.dry?'2 STEMS':'IMPORTED'}`;title.append(heading,meta);const buttons=document.createElement('div');buttons.className='take-buttons';for(const [kind,label]of [['wet','Synth WAV'],['dry','Voice WAV']]){if(kind==='dry'&&!take.dry)continue;const b=document.createElement('button');b.textContent=label;b.onclick=safe(()=>download(tape.stem(take,kind),`${take.name}-${kind}.wav`));buttons.append(b);}title.append(buttons);const canvas=document.createElement('canvas');canvas.width=550;canvas.height=55;canvas.className='take-wave';const ctrl=document.createElement('div');ctrl.className='take-controls';
    for(const [key,label,min,max,step]of [['wetGain','SYNTH',0,1.5,.01],['dryGain','DRY VOICE',0,1.5,.01],['rate','SPEED ×',.25,4,.01],['offset','START s',0,60,.1]]){if(key==='dryGain'&&!take.dry)continue;const l=document.createElement('label');l.textContent=label;const input=document.createElement('input');input.type=(key==='offset'||key==='rate')?'number':'range';input.min=min;input.max=max;input.step=step;input.value=take[key];input.setAttribute('aria-label',`${take.name} ${label}`);input.oninput=()=>{const value=+input.value;if(!Number.isFinite(value))return;take[key]=Math.max(min,Math.min(max,value));tapeChange(key==='offset');};l.append(input);ctrl.append(l);}
    for(const [key,label]of [['muted','Mute'],['reverse','Reverse']]){const button=document.createElement('button');button.textContent=label;button.classList.toggle('active',take[key]);button.setAttribute('aria-pressed',String(take[key]));button.onclick=()=>{take[key]=!take[key];tapeChange(key==='reverse');renderTakes();};ctrl.append(button);}const del=document.createElement('button');del.textContent='×';del.setAttribute('aria-label','Delete '+take.name);del.onclick=()=>{if(!confirm(`Remove ${take.name}? Export it first if you want to keep it.`))return;tape.stop();tape.takes=tape.takes.filter(t=>t!==take);tape.changed();};ctrl.append(del);card.append(title,canvas,ctrl);root.append(card);drawWave(canvas,take.wet.getChannelData(0));}
}
function drawWave(canvas,data){const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height;ctx.clearRect(0,0,w,h);ctx.strokeStyle='#adbf88';ctx.lineWidth=1;ctx.beginPath();for(let x=0;x<w;x++){const start=Math.floor(x*data.length/w),end=Math.max(start+1,Math.floor((x+1)*data.length/w));let peak=0;for(let i=start;i<end;i++)peak=Math.max(peak,Math.abs(data[i]));ctx.moveTo(x,h/2-peak*h*.46);ctx.lineTo(x,h/2+peak*h*.46);}ctx.stroke();}

const scope=$('#scope'),ctx=scope.getContext('2d'),scopeData=new Float32Array(2048),micData=new Float32Array(2048),reels=$('#reels'),rc=reels.getContext('2d');let lastFrame=0;
function animate(now){requestAnimationFrame(animate);if(now-lastFrame<33)return;lastFrame=now;const w=scope.width,h=scope.height;ctx.clearRect(0,0,w,h);ctx.strokeStyle='#63784b25';ctx.lineWidth=1;ctx.beginPath();for(let x=0;x<w;x+=26){ctx.moveTo(x,0);ctx.lineTo(x,h);}for(let y=0;y<h;y+=20){ctx.moveTo(0,y);ctx.lineTo(w,y);}ctx.stroke();
  const running=engine.ctx?.state==='running';if(running&&engine.analyser){engine.analyser.getFloatTimeDomainData(scopeData);engine.micAnalyser.getFloatTimeDomainData(micData);for(const [data,color]of [[scopeData,'#ec9b59'],[micData,'#a5cbb3']]){ctx.strokeStyle=color;ctx.lineWidth=1.5;ctx.beginPath();for(let x=0;x<w;x++){const y=h/2-data[Math.floor(x*data.length/w)]*h*.42;if(x===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.stroke();}}
  $('#out-meter').value=running?Math.min(1,scopeData.reduce((peak,v)=>Math.max(peak,Math.abs(v)),0)):0;$('#mic-meter').value=running?Math.min(1,micData.reduce((peak,v)=>Math.max(peak,Math.abs(v)),0)):0;$('#ef-meter').style.width=(running?Math.min(100,lastMeter.ef*10):0)+'%';
  const elapsed=tape.recording?engine.ctx.currentTime-tape.recordStart:tape.playing?Math.max(0,engine.ctx.currentTime-tape.playStart):0;$('#tape-time').textContent=time(elapsed);
  rc.clearRect(0,0,300,112);const angle=(tape.playing||tape.recording)?now*.0015*tape.speed*(tape.reverse?-1:1):0;for(const x of [79,221]){rc.save();rc.translate(x,56);rc.rotate(angle);rc.strokeStyle='#9da990';rc.lineWidth=1;rc.fillStyle='#192114';rc.beginPath();rc.arc(0,0,46,0,Math.PI*2);rc.fill();rc.stroke();rc.beginPath();rc.arc(0,0,34,0,Math.PI*2);rc.stroke();for(let i=0;i<3;i++){rc.rotate(Math.PI*2/3);rc.fillStyle='#7c8a6a';rc.beginPath();rc.roundRect(-8,-37,16,28,6);rc.fill();}rc.fillStyle='#c4cfb5';rc.beginPath();rc.arc(0,0,5,0,Math.PI*2);rc.fill();rc.restore();}rc.strokeStyle='#b2a47d';rc.beginPath();rc.moveTo(80,102);rc.lineTo(220,102);rc.stroke();}
requestAnimationFrame(animate);
for(const id of ['help','about'])$('#'+id).onclick=()=>$('#guide').showModal();$('.close-dialog').onclick=()=>$('#guide').close();$('#guide').onclick=e=>{if(e.target===$('#guide')){const r=$('#guide').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('#guide').close();}};
syncControls();renderRoutes();describePreset();
// Diagnostic handle is enabled only on local development origins.
if(['localhost','127.0.0.1'].includes(location.hostname))window.studio={engine,tape,defaults,controls};

setupSessions({app:'arp-2600-studio',engine,tape,status,getPatch:()=>engine.state,validatePatch:validatedPatch,loadPatch:p=>{engine.panic();engine.load(p.params,p.routes,p);patchBay.cancel();syncControls();drawCables();renderRoutes();$('#preset-note').textContent='Restored session.';}});

const memory=document.createElement('section');memory.id='performance-memory';$('.tape-deck').before(memory);
const performanceUI=setupPerformance({engine,root:memory,power,safe,status,syncControls,format:(value,c)=>fmt(value,c.unit)});
const history=setupHistory({engine,load:p=>{engine.load(p.params,p.routes,p);patchBay.cancel();syncControls();drawCables();renderRoutes();},status});
if(window.studio)Object.assign(window.studio,{performanceUI,history});
setupRecovery({app:'arp-2600-studio',engine,tape,getPatch:()=>engine.state,loadPatch:p=>{engine.load(p.params,p.routes,p);syncControls();drawCables();renderRoutes();},status});


setupTapeEditing({tape});

setupPerformanceEditor({engine,performanceUI,status});

setupParts({engine,performanceUI,status,ids:['arp']});
setupTransport({engine,tape,performanceUI,power,safe,status});

setupCalibration({engine,tape,status,ids:['arp','tape']});

const studioNavigation=document.querySelector('.rack-nav');if(studioNavigation){for(const [id,label]of [['hardware-panel','Devices'],['studio-transport','Transport'],['instrument-parts','Parts'],['clip-editor','Clip editor']]){const a=document.createElement('a');a.href='#'+id;a.textContent=label;studioNavigation.querySelector('a[href="#performance-memory"]').before(a);}}
setupHardware({app:'arp-2600-studio',engine,power,safe,status});
setupInterface();

engine.addEventListener('micstate',syncMicrophone);
