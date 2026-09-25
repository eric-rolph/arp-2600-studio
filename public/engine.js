import {defaults} from './model.js';
export class Engine extends EventTarget {
  constructor(){super();this.params={...defaults};this.routes={};this.notes=new Map();this.sustain=false;this.released=new Set();this.micStream=null;}
  async start(){
    if(this.starting)return this.starting;
    this.starting=this.initialize();
    try{return await this.starting;}finally{this.starting=null;}
  }
  async initialize(){
    if(this.ctx){await this.ctx.resume();return;}
    if(!window.AudioContext)throw new Error('This browser does not support Web Audio. Try current Chrome or Edge.');
    const ctx=this.ctx=new AudioContext({latencyHint:'interactive'});
    try{await ctx.audioWorklet.addModule('/dsp.js');}catch(e){await ctx.close();this.ctx=null;throw e;}
    this.synth=new AudioWorkletNode(ctx,'synth-2600',{numberOfInputs:1,numberOfOutputs:2,outputChannelCount:[2,1]});
    this.bus=ctx.createGain();this.master=ctx.createGain();this.master.gain.value=this.params.master;
    this.limiter=ctx.createDynamicsCompressor();this.limiter.threshold.value=-3;this.limiter.knee.value=0;this.limiter.ratio.value=20;this.limiter.attack.value=.002;this.limiter.release.value=.12;
    this.analyser=ctx.createAnalyser();this.analyser.fftSize=2048;
    this.micAnalyser=ctx.createAnalyser();this.micAnalyser.fftSize=1024;
    this.synth.connect(this.bus,0);this.synth.connect(this.micAnalyser,1);
    this.bus.connect(this.master).connect(this.limiter).connect(this.analyser).connect(ctx.destination);
    this.synth.port.onmessage=({data})=>this.dispatchEvent(new CustomEvent('meter',{detail:data}));
    this.synth.onprocessorerror=()=>this.dispatchEvent(new CustomEvent('error',{detail:'The audio processor stopped. Reload the page to restart it.'}));
    this.send('params',{values:this.params});this.send('routes',{routes:this.routes});await ctx.resume();
    this.dispatchEvent(new Event('ready'));
  }
  send(type,data={}){this.synth?.port.postMessage({type,...data});}
  set(key,value){this.params[key]=value;if(key==='master')this.master?.gain.setTargetAtTime(value,this.ctx.currentTime,.015);this.send('params',{values:{[key]:value}});}
  load(params,routes){this.params={...defaults,...params};this.routes={...routes};if(this.master)this.master.gain.setTargetAtTime(this.params.master,this.ctx.currentTime,.02);this.send('params',{values:this.params});this.send('routes',{routes:this.routes});}
  patch(dest,source){if(source) this.routes[dest]=source;else delete this.routes[dest];this.send('routes',{routes:this.routes});}
  trigger(retrigger){const notes=[...this.notes.values()],last=notes.at(-1);if(last)this.send('on',{...last,retrigger,lower:Math.min(...notes.map(n=>n.note)),upper:Math.max(...notes.map(n=>n.note))});else this.send('off');}
  on(note,velocity=1,id=note){this.notes.delete(id);this.notes.set(id,{note,velocity});this.released.delete(id);this.trigger(true);}
  off(id){if(this.sustain){this.released.add(id);return;}this.notes.delete(id);this.trigger(false);}
  sustainPedal(on){this.sustain=on;if(!on){for(const id of this.released)this.off(id);this.released.clear();}}
  panic(){this.notes.clear();this.released.clear();this.sustain=false;this.send('panic',{values:this.params,routes:this.routes});}
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
  bindMidi(){
    for(const input of this.midiAccess.inputs.values())input.onmidimessage=({data})=>{
      const [status,n,v]=data,type=status&0xf0,id=`midi-${input.id}-${status&15}-${n}`;
      if(type===0x90&&v>0)this.on(n,v/127,id);
      if(type===0x80||(type===0x90&&v===0))this.off(id);
      if(type===0xe0)this.set('bend',(((v<<7)|n)-8192)/8192*2);
      if(type===0xb0){if(n===1)this.set('mod',v/127);if(n===64)this.sustainPedal(v>=64);if(n===120||n===123)this.panic();
        const map={7:['master',1],74:['cutoff',1],71:['resonance',.97],73:['attack',3],72:['release',4]};
        if(map[n]){const [key,max]=map[n];this.set(key,key==='cutoff'?20*1000**(v/127):v/127*max);this.dispatchEvent(new CustomEvent('control',{detail:{key,value:this.params[key]}}));}}
      this.dispatchEvent(new Event('notes'));
    };
    this.dispatchEvent(new CustomEvent('midistate',{detail:[...this.midiAccess.inputs.values()].map(i=>i.name)}));
  }
}
