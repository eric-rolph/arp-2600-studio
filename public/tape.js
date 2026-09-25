export function encodeWav(channels,rate){
  const length=channels[0].length,n=channels.length,buffer=new ArrayBuffer(44+length*n*2),v=new DataView(buffer);
  const str=(o,s)=>[...s].forEach((c,i)=>v.setUint8(o+i,c.charCodeAt(0)));
  str(0,'RIFF');v.setUint32(4,36+length*n*2,true);str(8,'WAVE');str(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,n,true);v.setUint32(24,rate,true);v.setUint32(28,rate*n*2,true);v.setUint16(32,n*2,true);v.setUint16(34,16,true);str(36,'data');v.setUint32(40,length*n*2,true);
  for(let i=0;i<length;i++)for(let c=0;c<n;c++){const x=Math.max(-1,Math.min(1,channels[c][i]));v.setInt16(44+(i*n+c)*2,x<0?x*32768:x*32767,true);}return new Blob([buffer],{type:'audio/wav'});
}
export function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}

export class Tape extends EventTarget {
  constructor(engine){super();this.engine=engine;this.takes=[];this.speed=1;this.saturation=.15;this.wow=.002;this.flutter=.001;this.reverse=false;this.loop=false;this.playing=false;this.recording=false;this.nodes=[];}
  changed(){this.dispatchEvent(new Event('change'));}
  async init(){await this.engine.start();if(this.capture)return;const ctx=this.engine.ctx;
    this.capture=new AudioWorkletNode(ctx,'tape-capture',{numberOfInputs:2,numberOfOutputs:1,outputChannelCount:[1]});
    this.engine.synth.connect(this.capture,0,0);this.engine.synth.connect(this.capture,1,1);this.capture.connect(ctx.destination);
    this.capture.port.onmessage=({data:m})=>{if(m.type==='chunk')this.chunks.push(m.channels);if(m.type==='stopped'||m.type==='limit'){this.finish();if(m.type==='limit')this.dispatchEvent(new CustomEvent('notice',{detail:'The three-minute take limit was reached. Your recording was kept.'}));}};
  }
  async record(){await this.init();if(this.recording)return;if(this.takes.length>=8)throw new Error('Eight takes are loaded. Export or remove a take before recording another.');this.chunks=[];this.recording=true;this.recordStart=this.engine.ctx.currentTime;this.capture.port.postMessage('start');this.changed();}
  stopRecord(){if(!this.recording)return Promise.resolve();if(!this.stopping){this.stopping=new Promise(resolve=>this.resolveStop=resolve);this.capture.port.postMessage('stop');}return this.stopping;}
  finish(){if(!this.recording)return;this.recording=false;
    const frames=this.chunks.reduce((n,c)=>n+c[0].length,0);if(frames){const ctx=this.engine.ctx,wet=ctx.createBuffer(2,frames,ctx.sampleRate),dry=ctx.createBuffer(1,frames,ctx.sampleRate);let pos=0;
      for(const ch of this.chunks){wet.copyToChannel(ch[0],0,pos);wet.copyToChannel(ch[1],1,pos);dry.copyToChannel(ch[2],0,pos);pos+=ch[0].length;}
      this.takes.push({id:crypto.randomUUID(),name:`Take ${this.takes.length+1}`,wet,dry,wetGain:1,dryGain:0,offset:0,muted:false,rate:1,reverse:false});}
    this.chunks=[];this.resolveStop?.();this.resolveStop=null;this.stopping=null;this.changed();
  }
  async importFile(file){await this.init();if(this.takes.length+(this.recording?1:0)>=8)throw new Error('Maximum eight takes, including the current recording.');if(file.size>50*1024*1024)throw new Error('Choose an audio file smaller than 50 MB.');
    const b=await this.engine.ctx.decodeAudioData(await file.arrayBuffer());if(b.numberOfChannels>2)throw new Error('Choose a mono or stereo audio file.');if(b.duration>180)throw new Error('Choose a recording of three minutes or less.');
    if(this.takes.length+(this.recording?1:0)>=8)throw new Error('Maximum eight takes, including the current recording.');this.takes.push({id:crypto.randomUUID(),name:file.name,wet:b,dry:null,wetGain:1,dryGain:0,offset:0,muted:false,rate:1,reverse:false});this.changed();
  }
  duration(){return Math.max(0,...this.takes.filter(t=>!t.muted).map(t=>t.offset+t.wet.duration/(this.speed*t.rate)));}
  reversed(ctx,b){const out=ctx.createBuffer(b.numberOfChannels,b.length,b.sampleRate);for(let c=0;c<b.numberOfChannels;c++)out.copyToChannel(b.getChannelData(c).slice().reverse(),c);return out;}
  curve(){const curve=new Float32Array(8192),d=1+this.saturation*5;for(let i=0;i<curve.length;i++){const x=i*2/(curve.length-1)-1;curve[i]=x*(1-this.saturation)+this.saturation*Math.tanh(x*d)/Math.tanh(d);}return curve;}
  updatePlayback(){
    if(!this.playing)return;const now=this.engine.ctx.currentTime;
    for(const layer of this.layers||[]){const rate=this.speed*layer.take.rate;layer.src.playbackRate.setTargetAtTime(rate,now,.015);layer.wg.gain.setTargetAtTime(rate*this.wow,now,.015);layer.fg.gain.setTargetAtTime(rate*this.flutter,now,.015);layer.gain.gain.setTargetAtTime(layer.take.muted?0:layer.take[layer.levelKey],now,.015);}
    this.checkEnded();if(this.liveSat)this.liveSat.curve=this.curve();if(this.liveColor)this.liveColor.frequency.setTargetAtTime(18000/(1+this.saturation*.6),now,.015);
  }
  build(ctx,destination,start,forExport=false){
    const nodes=[],duration=this.duration(),bus=ctx.createGain(),color=ctx.createBiquadFilter(),sat=ctx.createWaveShaper();
    color.type='lowpass';color.frequency.value=18000/(1+this.saturation*.6);sat.curve=this.curve();sat.oversample='2x';bus.connect(color).connect(sat).connect(destination);nodes.push(bus,color,sat);
    if(!forExport){this.layers=[];this.liveSat=sat;this.liveColor=color;}
    for(const take of this.takes)for(const [buffer,levelKey] of [[take.wet,'wetGain'],[take.dry,'dryGain']]){
      if(!buffer||(forExport&&(take.muted||!take[levelKey])))continue;
      const src=ctx.createBufferSource(),gain=ctx.createGain();src.buffer=this.reverse!==take.reverse?this.reversed(ctx,buffer):buffer;
      const rate=this.speed*take.rate;src.playbackRate.value=rate;gain.gain.value=take.muted?0:take[levelKey];src.connect(gain).connect(bus);
      const wow=ctx.createOscillator(),flutter=ctx.createOscillator(),wg=ctx.createGain(),fg=ctx.createGain();
      wow.frequency.value=.63;flutter.frequency.value=8.7;wg.gain.value=rate*this.wow;fg.gain.value=rate*this.flutter;
      wow.connect(wg).connect(src.playbackRate);flutter.connect(fg).connect(src.playbackRate);wow.start(start);flutter.start(start);
      src.start(start+take.offset);if(forExport){wow.stop(start+duration+.5);flutter.stop(start+duration+.5);}else{const layer={src,gain,take,levelKey,wg,fg,ended:false};this.layers.push(layer);src.onended=()=>{layer.ended=true;this.checkEnded();};}nodes.push(src,gain,wow,flutter,wg,fg);
    }
    return nodes;
  }
  async play(){await this.init();this.stop();if(!this.takes.some(t=>!t.muted))throw new Error('Record or import a take first.');this.playing=true;this.playStart=this.engine.ctx.currentTime+.03;this.nodes=this.build(this.engine.ctx,this.engine.bus,this.playStart);this.remaining=this.layers.length;this.changed();}
  checkEnded(){if(this.playing&&this.layers?.length&&!this.layers.some(layer=>!layer.take.muted&&!layer.ended)){if(this.loop&&this.layers.some(layer=>!layer.take.muted)){this.playing=false;this.play().catch(()=>this.stop());}else this.stop();}}
  stop(){this.playing=false;for(const n of this.nodes){if('onended' in n)n.onended=null;try{n.stop?.();}catch{}try{n.disconnect();}catch{}}this.nodes=[];this.layers=[];this.changed();}
  async export(){await this.init();const duration=this.duration();if(!duration)throw new Error('Record a take before exporting.');
    if(duration>720)throw new Error('The mix exceeds 12 minutes. Increase tape speed or shorten track offsets.');
    const ctx=new OfflineAudioContext(2,Math.ceil((duration+.15)*this.engine.ctx.sampleRate),this.engine.ctx.sampleRate);
    const limiter=ctx.createDynamicsCompressor();limiter.threshold.value=-2;limiter.ratio.value=20;limiter.knee.value=0;limiter.connect(ctx.destination);
    this.build(ctx,limiter,0,true);const b=await ctx.startRendering();return encodeWav([b.getChannelData(0),b.getChannelData(1)],b.sampleRate);
  }
  stem(take,type){const b=type==='dry'?take.dry:take.wet;if(!b)throw new Error('This imported take has no separate microphone stem.');return encodeWav(Array.from({length:b.numberOfChannels},(_,i)=>b.getChannelData(i)),b.sampleRate);}
}
