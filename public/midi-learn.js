import {controls,families} from './patch-state.js';
export function controllerValue(id,value){
 const c=controls[id],x=Math.max(0,Math.min(127,value))/127;
 if(id==='mains')return x<.5?50:60;
 const result=c.log?c.min*(c.max/c.min)**x:c.min+x*(c.max-c.min);
 return ['switch','scale','root','model','processor'].includes(c.unit)||id==='octave'?Math.round(result):result;
}
export const controlName=id=>`${families[id.split('.')[0]]?.name||'Console'} · ${controls[id].label}`;
export function setupMidiLearn({engine,root,status,safe}){
 let armed=false,mappings=[];
 try{const data=JSON.parse(localStorage.getItem('arp-2600-midi-mappings')||'[]');if(Array.isArray(data))mappings=data.slice(0,128).filter(m=>m&&typeof m.device==='string'&&Number.isInteger(m.channel)&&m.channel>=0&&m.channel<16&&Number.isInteger(m.cc)&&m.cc>=0&&m.cc<120&&m.cc!==64&&Object.hasOwn(controls,m.target));}catch{}
 root.innerHTML='<summary>MIDI controller mappings <span id="mapping-count"></span></summary><p>Choose a control, click Learn, then move a hardware knob or fader. You can also right-click a synth control to learn it. Sustain and panic messages keep their usual functions.</p><div class="inline"><label>Control <select id="learn-target"></select></label><button id="midi-learn" aria-pressed="false">Learn</button></div><p id="learn-status" role="status"></p><div id="midi-mappings"></div>';
 const target=root.querySelector('#learn-target'),button=root.querySelector('#midi-learn'),note=root.querySelector('#learn-status');
 for(const id of Object.keys(controls))target.add(new Option(controlName(id),id));target.value='cutoff';
 function save(){try{localStorage.setItem('arp-2600-midi-mappings',JSON.stringify(mappings));}catch{status('MIDI mapping works for this visit; browser storage is unavailable.',true);}render();}
 function arm(on){armed=on;button.textContent=on?'Cancel learn':'Learn';button.setAttribute('aria-pressed',String(on));note.textContent=on?'Move a controller for '+controlName(target.value)+'.':'Mappings stay in this browser and are independent of the loaded patch.';}
 function render(){root.querySelector('#mapping-count').textContent=`· ${mappings.length}`;const list=root.querySelector('#midi-mappings');list.replaceChildren();for(const m of mappings){const row=document.createElement('div'),name=document.createElement('span'),remove=document.createElement('button');row.className='mapping-row';name.textContent=`${m.name||'MIDI input'} · Ch ${m.channel+1} · CC ${m.cc} → ${controlName(m.target)}`;remove.textContent='Remove';remove.setAttribute('aria-label','Remove mapping for '+controlName(m.target));remove.onclick=()=>{mappings=mappings.filter(entry=>entry!==m);save();};row.append(name,remove);list.append(row);}}
 button.onclick=safe(async()=>{if(armed)return arm(false);await engine.midi();arm(true);});
 document.addEventListener('contextmenu',e=>{const el=e.target.closest('[data-param],[data-dial]'),id=el?.dataset.param||el?.dataset.dial;if(!id)return;e.preventDefault();target.value=id;root.open=true;if(armed)arm(true);else button.click();});
 engine.addEventListener('midicc',e=>{const m=e.detail;if(m.cc===64||m.cc>=120)return;
  if(armed){e.preventDefault();mappings=mappings.filter(entry=>!(entry.device===m.device&&entry.channel===m.channel&&entry.cc===m.cc)&&entry.target!==target.value);mappings.push({...m,target:target.value});arm(false);save();note.textContent=`Learned CC ${m.cc} → ${controlName(target.value)}. Move it again to play.`;return;}
  const mapping=mappings.find(entry=>entry.device===m.device&&entry.channel===m.channel&&entry.cc===m.cc);if(mapping){e.preventDefault();engine.set(mapping.target,controllerValue(mapping.target,m.value));engine.dispatchEvent(new Event('control'));}
 });
 target.onchange=()=>{if(armed)arm(true);};window.addEventListener('keydown',e=>{if(e.key==='Escape'&&armed)arm(false);});arm(false);render();
}
