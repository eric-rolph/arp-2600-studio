import {defaults} from './model.js';
import {freshPatch,validatePatch,controls} from './patch-state.js';
export class Engine extends EventTarget {
  constructor(){super();this.state=freshPatch();this.app='arp-2600-studio';this.notes=new Map();this.sustain=false;this.released=new Set();this.micStream=null;}
  get params(){return this.state.params;}set params(value){this.state.params=value;}get routes(){return this.state.routes;}set routes(value){this.state.routes=value;}
  configure(){this.send('configure',{state:this.state});this.send('params',{values:this.params});this.send('routes',{routes:this.routes});this.dispatchEvent(new Event('patchchange'));}
  async start(){
    if(this.starting)return this.starting;
    this.starting=this.initialize();
    try{return await this.starting;}finally{this.starting=null;}
  }
  async initialize(){await this.recoveryReady;
    if(this.ctx){await this.ctx.resume();return;}
    if(!window.AudioContext)throw new Error('This browser does not support Web Audio. Try current Chrome or Edge.');
    const ctx=this.ctx=new AudioContext({latencyHint:'interactive',sampleRate:48000});
    try{await ctx.audioWorklet.addModule('/dsp.js');}catch(e){await ctx.close();this.ctx=null;throw e;}
    this.synth=new AudioWorkletNode(ctx,'synth-2600',{numberOfInputs:1,numberOfOutputs:3,outputChannelCount:[2,1,1]});
    this.bus=ctx.createGain();this.master=ctx.createGain();this.master.gain.value=this.params.master;
    this.limiter=ctx.createDynamicsCompressor();this.limiter.threshold.value=-3;this.limiter.knee.value=0;this.limiter.ratio.value=20;this.limiter.attack.value=.002;this.limiter.release.value=.12;
    this.analyser=ctx.createAnalyser();this.analyser.fftSize=2048;
    this.micAnalyser=ctx.createAnalyser();this.micAnalyser.fftSize=2048;
    this.clickMonitor=ctx.createGain();this.clickMonitor.gain.value=.65;this.synth.connect(this.clickMonitor,2);this.clickMonitor.connect(this.master);
    this.synth.connect(this.bus,0);this.synth.connect(this.micAnalyser,1);
    this.bus.connect(this.master).connect(this.limiter).connect(this.analyser).connect(ctx.destination);
    this.synth.port.onmessage=({data})=>this.dispatchEvent(new CustomEvent('meter',{detail:data}));
    this.synth.onprocessorerror=()=>this.dispatchEvent(new CustomEvent('error',{detail:'The audio processor stopped. Reload the page to restart it.'}));
    this.configure();await ctx.resume();
    this.dispatchEvent(new Event('ready'));
  }
  send(type,data={}){this.synth?.port.postMessage({type,...data});}
  set(key,value){if(key==='tempo'&&this.performanceTempo!=null)return;const c=controls[key];if(!c||!Number.isFinite(value))return;value=Math.max(c.min,Math.min(c.max,value));const previous=this.params[key];this.params[key]=value;if(key==='master')this.master?.gain.setTargetAtTime(value,this.ctx.currentTime,.015);this.send('params',{values:{[key]:value}});this.dispatchEvent(new CustomEvent('parameter',{detail:{key,value,previous}}));this.dispatchEvent(new Event('patchchange'));}
  load(params,routes,extra={}){this.panic();this.stopPerformance?.();this.state=validatePatch({...extra,params,routes});if(this.master)this.master.gain.setTargetAtTime(this.params.master,this.ctx.currentTime,.02);this.configure();this.dispatchEvent(new Event('patchload'));}
  patch(dest,source){if(source) this.routes[dest]=source;else delete this.routes[dest];this.send('routes',{routes:this.routes});this.dispatchEvent(new Event('patchchange'));}
 trigger(retrigger=true,changedPart){const groups=[null,...Object.keys(this.state.parts||{}).filter(id=>this.state.parts[id].enabled)];for(const part of groups){if(changedPart!==undefined&&part!==changedPart)continue;const notes=[...this.notes.values()].filter(n=>(n.part||null)===part),last=notes.at(-1),data=last?{...last,retrigger,lower:Math.min(...notes.map(n=>n.note)),upper:Math.max(...notes.map(n=>n.note))}:null;if(part)this.send('part-live',{part,note:data});else if(data)this.send('on',data);else this.send('off');}}
  on(note,velocity=1,id=note,target){const part=target===false?null:target??(this.state.parts?.[this.activePart]?.enabled?this.activePart:null);this.notes.delete(id);this.notes.set(id,{note,velocity,part});this.released.delete(id);this.trigger(true,part);this.dispatchEvent(new CustomEvent('noteaction',{detail:{on:true,note,velocity,id,part}}));this.dispatchEvent(new Event('notes'));}
  off(id){if(!this.notes.has(id))return;const part=this.notes.get(id).part||null;if(this.isSustained(id)){this.released.add(id);return;}this.notes.delete(id);this.released.delete(id);this.trigger(false,part);this.dispatchEvent(new CustomEvent('noteaction',{detail:{on:false,id}}));this.dispatchEvent(new Event('notes'));}
 isSustained(id){return [...(this.pedals||[])].some(owner=>!owner.startsWith('midi-')||String(id).startsWith(owner+'-'));}
 sustainPedal(on,owner='manual'){this.pedals??=new Set();if(on)this.pedals.add(owner);else this.pedals.delete(owner);this.sustain=this.pedals.size>0;for(const id of this.released)if(!this.isSustained(id))this.off(id);}
  panic(){this.notes.clear();this.released.clear();this.sustain=false;this.pedals?.clear();this.send('panic',{values:this.params,routes:this.routes});this.dispatchEvent(new Event('panic'));}
  async microphone(deviceId){
    await this.start();this.stopMicrophone();
    if(!navigator.mediaDevices?.getUserMedia)throw new Error('Microphone input requires HTTPS and a supported browser.');
    this.micStream=await navigator.mediaDevices.getUserMedia({audio:{deviceId:deviceId?{exact:deviceId}:undefined,echoCancellation:false,noiseSuppression:false,autoGainControl:false,channelCount:1},video:false});
    this.micSource=this.ctx.createMediaStreamSource(this.micStream);this.micSource.connect(this.synth);
    this.micStream.getAudioTracks()[0].onended=()=>{this.stopMicrophone();this.dispatchEvent(new Event('micended'));};
  }
  stopMicrophone(){this.micSource?.disconnect();this.micStream?.getTracks().forEach(t=>t.stop());this.micStream=null;this.micSource=null;}
  async midi(){
    await this.start();if(!navigator.requestMIDIAccess)throw new Error('Web MIDI is unavailable here. Use Chrome or Edge, or the on-screen keyboard.');
    this.midiAccess=await navigator.requestMIDIAccess({sysex:false});this.bindMidi();this.midiAccess.onstatechange=()=>this.bindMidi();return this.midiAccess.inputs.size;
  }
  dropNotes(predicate){let changed=false;for(const id of this.notes.keys())if(predicate(id)){this.notes.delete(id);this.released.delete(id);this.dispatchEvent(new CustomEvent('noteaction',{detail:{on:false,id}}));changed=true;}if(changed){this.trigger(false);this.dispatchEvent(new Event('notes'));}}
 bindMidi(){
    const inputs=[...this.midiAccess.inputs.values()].filter(input=>input.state!=='disconnected');
    for(const input of this.boundMidi||[])if(!inputs.some(next=>next.id===input.id)){input.onmidimessage=null;this.dropNotes(id=>String(id).startsWith('midi-'+input.id+'-'));for(const owner of this.pedals||[])if(owner.startsWith('midi-'+input.id+'-'))this.sustainPedal(false,owner);}
    this.boundMidi=inputs;
    for(const input of inputs)input.onmidimessage=({data,timeStamp})=>{if(data[0]>=240){this.dispatchEvent(new CustomEvent('midirealtime',{detail:{device:input.id,data:Array.from(data),time:timeStamp??performance.now()}}));return;}
      const [status,n,v]=data,type=status&0xf0,id=`midi-${input.id}-${status&15}-${n}`;
      if(type===0x90&&v>0)this.routeMidiOn?this.routeMidiOn(n,v/127,id,status&15):this.on(n,v/127,id,false);
      if(type===0x80||(type===0x90&&v===0))(this.routeMidiOff?this.routeMidiOff(id):this.off(id));
      if(type===0xe0)this.set('bend',(((v<<7)|n)-8192)/8192*2);
      if(type===0xb0){const useDefault=this.dispatchEvent(new CustomEvent('midicc',{cancelable:true,detail:{device:input.id,name:input.name,channel:status&15,cc:n,value:v}}));if(n===1&&useDefault)this.set('mod',v/127);if(n===64)this.sustainPedal(v>=64,`midi-${input.id}-${status&15}`);if(n===120||n===123)this.panic();
        const map={7:['master',1],74:['cutoff',1],71:['resonance',.97],73:['attack',3],72:['release',4]};
        if(map[n]&&useDefault){const [key,max]=map[n];this.set(key,key==='cutoff'?20*1000**(v/127):v/127*max);this.dispatchEvent(new CustomEvent('control',{detail:{key,value:this.params[key]}}));}}
      this.dispatchEvent(new Event('notes'));
    };
    this.dispatchEvent(new CustomEvent('midistate',{detail:inputs.map(i=>i.name)}));
  }
}
