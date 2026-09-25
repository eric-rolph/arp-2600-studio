import {encodeWav} from './wav.js';
export {encodeWav} from './wav.js';
import {tapeDuration} from './tape-core.js';
export function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}

export class Tape extends EventTarget {
  constructor(engine){super();this.engine=engine;this.takes=[];this.speed=1;this.saturation=.15;this.wow=.002;this.flutter=.001;this.reverse=false;this.loop=false;this.playing=false;this.recording=false;this.nodes=[];this.playGeneration=0;this.playRequest=0;this.recordRequest=0;this.exportFormat=24;this.dither=true;this.loopBars=0;}
  changed(){this.dispatchEvent(new Event('change'));}
  async init(){if(this.initializing)return this.initializing;this.initializing=this.initialize();try{return await this.initializing;}finally{this.initializing=null;}}
  async initialize(){await this.engine.start();if(this.capture)return;const ctx=this.engine.ctx;
    await ctx.audioWorklet.addModule('/tape-core.js');this.player=new AudioWorkletNode(ctx,'studio-tape-player',{numberOfInputs:0,numberOfOutputs:1,outputChannelCount:[2]});this.player.connect(this.engine.bus);this.player.port.onmessage=({data:m})=>{if(m.ready){this.preparations?.get(m.ready)?.();this.preparations?.delete(m.ready);return;}if(m.run!==this.playGeneration)return;this.position=m.position;this.cycle=m.cycle;if(this.playing&&!m.running){this.playing=false;this.changed();}};
    this.capture=new AudioWorkletNode(ctx,'tape-capture',{numberOfInputs:2,numberOfOutputs:1,outputChannelCount:[1]});
    this.engine.synth.connect(this.capture,0,0);this.engine.synth.connect(this.capture,1,1);this.capture.connect(ctx.destination);
    this.capture.port.onmessage=({data:m})=>{if(m.type==='chunk'){this.chunks.push(m.channels);this.dispatchEvent(new CustomEvent('recordchunk',{detail:{channels:m.channels}}));}if(m.type==='stopped'||m.type==='limit'){this.finish();if(m.type==='limit')this.dispatchEvent(new CustomEvent('notice',{detail:'The three-minute take limit was reached. Your recording was kept.'}));}};
  }
  async record(){const request=++this.recordRequest;await this.init();if(request!==this.recordRequest||this.recording)return false;if(this.takes.length>=8)throw new Error('Eight takes are loaded. Export or remove a take before recording another.');this.chunks=[];this.recordId=crypto.randomUUID();this.recording=true;this.dispatchEvent(new CustomEvent('recordstart',{detail:{id:this.recordId,rate:this.engine.ctx.sampleRate}}));this.recordStart=this.engine.ctx.currentTime;this.capture.port.postMessage('start');this.changed();return true;}
  stopRecord(){this.recordRequest++;if(!this.recording)return Promise.resolve();if(!this.stopping){this.stopping=new Promise(resolve=>this.resolveStop=resolve);this.capture.port.postMessage('stop');}return this.stopping;}
  finish(){if(!this.recording)return;this.recording=false;
    const frames=this.chunks.reduce((n,c)=>n+c[0].length,0);if(frames){const ctx=this.engine.ctx,wet=ctx.createBuffer(2,frames,ctx.sampleRate),dry=ctx.createBuffer(1,frames,ctx.sampleRate);let pos=0;
      for(const ch of this.chunks){wet.copyToChannel(ch[0],0,pos);wet.copyToChannel(ch[1],1,pos);dry.copyToChannel(ch[2],0,pos);pos+=ch[0].length;}
      this.takes.push({id:this.recordId,name:`Take ${this.takes.length+1}`,wet,dry,wetGain:1,dryGain:0,offset:0,muted:false,rate:1,reverse:false});}
    this.chunks=[];this.resolveStop?.();this.resolveStop=null;this.stopping=null;this.changed();this.dispatchEvent(new Event('recordend'));
  }
  async importFile(file){await this.init();if(this.takes.length+(this.recording?1:0)>=8)throw new Error('Maximum eight takes, including the current recording.');if(file.size>50*1024*1024)throw new Error('Choose an audio file smaller than 50 MB.');
    const b=await this.engine.ctx.decodeAudioData(await file.arrayBuffer());if(b.numberOfChannels>2)throw new Error('Choose a mono or stereo audio file.');if(b.duration>180)throw new Error('Choose a recording of three minutes or less.');
    if(this.takes.length+(this.recording?1:0)>=8)throw new Error('Maximum eight takes, including the current recording.');this.takes.push({id:crypto.randomUUID(),name:file.name,wet:b,dry:null,wetGain:1,dryGain:0,offset:0,muted:false,rate:1,reverse:false});this.changed();
  }
  audio(b){return b?{rate:b.sampleRate,channels:Array.from({length:b.numberOfChannels},(_,i)=>b.getChannelData(i))}:null;}
  packed(){return this.takes.map(t=>({...t,wet:this.audio(t.wet),dry:this.audio(t.dry)}));}
  settings(){return Object.fromEntries(['speed','saturation','wow','flutter','reverse','loop','loopBars'].map(k=>[k,this[k]]).concat([['tempo',this.engine.params.tempo||108],['calibration',this.engine.state.calibration?.enabled?this.engine.state.calibration.units.tape:null]]));}
  duration(){return tapeDuration(this.packed(),this.settings());}
  reversed(ctx,b){const out=ctx.createBuffer(b.numberOfChannels,b.length,b.sampleRate);for(let c=0;c<b.numberOfChannels;c++)out.copyToChannel(b.getChannelData(c).slice().reverse(),c);return out;}
  curve(){const curve=new Float32Array(8192),d=1+this.saturation*5;for(let i=0;i<curve.length;i++){const x=i*2/(curve.length-1)-1;curve[i]=x*(1-this.saturation)+this.saturation*Math.tanh(x*d)/Math.tanh(d);}return curve;}
  updatePlayback(){this.dispatchEvent(new Event('edit'));if(this.playing)this.player.port.postMessage({type:'configure',takes:this.takes.map(({wet,dry,...t})=>t),settings:{...this.settings(),tempo:this.linked?this.baseTempo:this.engine.params.tempo}});}
  async prepare(){await this.init();if(!this.takes.some(t=>!t.muted))throw new Error('Record or import a take first.');this.preparations??=new Map();const token=crypto.randomUUID();await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{this.preparations.delete(token);reject(new Error('Tape player did not acknowledge the audio.'));},10000);this.preparations.set(token,()=>{clearTimeout(timer);resolve();});this.player.port.postMessage({type:'configure',token,takes:this.packed(),settings:this.settings()});});}
  startPrepared(when,seconds=0,linked=false){this.playRequest++;const run=++this.playGeneration;this.linked=linked;this.baseTempo=this.engine.params.tempo;this.playing=true;this.playStart=when;this.position=seconds;this.player.port.postMessage({type:'start',run,frame:Math.round(when*this.engine.ctx.sampleRate),seconds,linked});this.changed();}
  async play({when,seconds=0}={}){const request=++this.playRequest;await this.prepare();if(request!==this.playRequest)return false;this.startPrepared(when??this.engine.ctx.currentTime+.03,seconds);return true;}

  checkEnded(){if(this.playing&&!this.takes.some(t=>!t.muted))this.stop();}
  stop(){this.playRequest++;const run=++this.playGeneration;this.player?.port.postMessage({type:'stop',run});this.playing=false;this.changed();}
  async export(){await this.init();const duration=this.duration();if(!duration)throw new Error('Record a take before exporting.');if(duration>720)throw new Error('The mix exceeds 12 minutes. Increase speed or trim the takes.');return new Promise((resolve,reject)=>{const worker=new Worker('/tape-render-worker.js',{type:'module'});worker.onmessage=({data})=>{worker.terminate();data.error?reject(new Error(data.error)):resolve(data.blob);};worker.onerror=e=>{worker.terminate();reject(new Error(e.message||'WAV rendering failed.'));};worker.postMessage({takes:this.packed(),settings:this.settings(),rate:this.engine.ctx.sampleRate,bits:this.exportFormat,dither:this.dither});});}
  stem(take,type){const b=type==='dry'?take.dry:take.wet;if(!b)throw new Error('This imported take has no separate microphone stem.');return encodeWav(Array.from({length:b.numberOfChannels},(_,i)=>b.getChannelData(i)),b.sampleRate,this.exportFormat,{dither:this.dither});}
}
