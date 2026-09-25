// One entry per control gesture (or burst of MIDI messages), with a bounded history.
export class PatchHistory{
 constructor(read,apply,notify=()=>{}){this.read=read;this.apply=apply;this.notify=notify;this.past=[];this.future=[];this.current=this.snapshot();}
 snapshot(){const p=structuredClone(this.read());p.sequencer=false;return JSON.stringify(p);}
 changed(){if(this.applying)return;clearTimeout(this.timer);this.timer=setTimeout(()=>this.flush(),350);}
 flush(){clearTimeout(this.timer);const next=this.snapshot();if(next===this.current)return;this.past.push(this.current);if(this.past.length>40)this.past.shift();this.current=next;this.future=[];this.notify();}
 travel(redo=false){this.flush();const from=redo?this.future:this.past,to=redo?this.past:this.future;if(!from.length)return;to.push(this.current);this.current=from.pop();this.applying=true;try{this.apply(JSON.parse(this.current));}finally{this.applying=false;this.current=this.snapshot();this.notify();}}
}
export function setupHistory({engine,load,status}){
 const row=document.createElement('div');row.className='patch-history';row.innerHTML='<button id="patch-undo" disabled title="Undo patch edit (Ctrl/⌘ Z)">Undo</button><button id="patch-redo" disabled title="Redo patch edit (Ctrl/⌘ Shift Z)">Redo</button><span>Controls, cables, matrix &amp; performance loop</span>';document.querySelector('.preset-field').append(row);
 const undo=row.querySelector('#patch-undo'),redo=row.querySelector('#patch-redo');
 const h=new PatchHistory(()=>engine.state,p=>load(p,'Restored patch edit.'),()=>{undo.disabled=!h.past.length;redo.disabled=!h.future.length;});
 engine.addEventListener('patchchange',()=>h.changed());
 const travel=forward=>{h.travel(forward);status(forward?'Patch edit redone.':'Patch edit undone. Notes and sequencers stopped; tape takes kept.');};undo.onclick=()=>travel(false);redo.onclick=()=>travel(true);
 window.addEventListener('keydown',e=>{if(!(e.ctrlKey||e.metaKey)||e.altKey||e.target.matches('input:not([type=range]):not([type=checkbox]),textarea,select')||document.querySelector('dialog[open]'))return;const key=e.key.toLowerCase();if(key==='z'||key==='y'){e.preventDefault();travel(key==='y'||e.shiftKey);}});engine.history=h;return h;
}
