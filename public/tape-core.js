import {TransportClock} from './transport-core.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function trimBounds(t){const duration=t.wet.channels[0].length/t.wet.rate,start=clamp(t.trimStart||0,0,Math.max(0,duration-1/t.wet.rate)),end=clamp(t.trimEnd??duration,start+1/t.wet.rate,duration);return {start,end,length:end-start};}
export function tapeDuration(takes,settings){return Math.max(0,...takes.filter(t=>!t.muted).map(t=>(t.offset||0)+trimBounds(t).length/((settings.speed||1)*(t.rate||1))));}
export class TapePlaybackCore{
 constructor(rate=48000){this.rate=rate;this.takes=[];this.settings={speed:1,saturation:0,wow:0,flutter:0,loop:false};this.running=false;this.position=0;this.cycle=0;this.positions=new Map();this.low=[0,0];this.out=new Float32Array(2);}
 configure(takes,settings){if(takes){const old=new Map(this.takes.map(t=>[t.id,t]));this.takes=takes.map(t=>({...old.get(t.id),...t})).filter(t=>t.wet);}Object.assign(this.settings,settings);this.duration=tapeDuration(this.takes,this.settings);if(this.running&&this.positions.size&&!this.settings.loopBars)this.duration=this.position+Math.max(0,...this.takes.filter(t=>!t.muted).map(t=>Math.max(0,(t.offset||0)-this.position)+(trimBounds(t).length-(this.positions.get(t.id)||0))/((this.settings.speed||1)*(t.rate||1))));this.loopDuration=this.settings.loopBars?this.settings.loopBars*4*60/(this.settings.tempo||108):this.duration;this.color=1-Math.exp(-2*Math.PI*((this.settings.calibration?.bandwidth||18000)/(1+this.settings.saturation*.6))/this.rate);}
 start(frame=0,seconds=0){this.startFrame=frame;this.position=seconds;this.running=true;this.cycle=0;this.positions.clear();this.low.fill(0);}
 stop(){this.running=false;this.out.fill(0);}
 tick(frame){this.out.fill(0);if(!this.running||frame<this.startFrame)return this.out;if(!this.takes.some(t=>!t.muted)){this.stop();return this.out;}const p=this.settings,period=Math.max(1/this.rate,this.loopDuration);if(this.position>=period){if(p.loop){this.position%=period;this.positions.clear();this.cycle++;this.duration=tapeDuration(this.takes,this.settings);this.loopDuration=this.settings.loopBars?this.settings.loopBars*4*60/(this.settings.tempo||108):this.duration;}else {this.stop();return this.out;}}
  const wobble=1+(p.wow||0)*Math.sin(2*Math.PI*(p.calibration?.wowHz||.63)*frame/this.rate)+(p.flutter||0)*Math.sin(2*Math.PI*(p.calibration?.flutterHz||8.7)*frame/this.rate);
  for(const t of this.takes){if(t.muted||this.position<(t.offset||0))continue;const bounds=trimBounds(t),rate=(p.speed||1)*(t.rate||1)*(p.clockRatio||1),elapsed=this.positions.get(t.id)??Math.max(0,this.position-(t.offset||0))*rate;this.positions.set(t.id,elapsed+rate*wobble/this.rate);if(elapsed>=bounds.length)continue;const fade=Math.min(1,t.fadeIn?elapsed/t.fadeIn:1,t.fadeOut?(bounds.length-elapsed)/t.fadeOut:1),time=(!!p.reverse!==!!t.reverse)?bounds.end-elapsed-1/t.wet.rate:bounds.start+elapsed;
   for(const [b,level]of [[t.wet,t.wetGain],[t.dry,t.dryGain]])if(b&&level){const index=clamp(time*b.rate,0,b.channels[0].length-1),i=Math.floor(index),mix=index-i;for(let c=0;c<2;c++){const data=b.channels[Math.min(c,b.channels.length-1)],v=data[i]*(1-mix)+data[Math.min(i+1,data.length-1)]*mix;this.out[c]+=v*level*fade;}}
  }
  const sat=p.saturation||0,d=1+sat*5*(p.calibration?.tapeDrive||1),bias=p.calibration?.tapeBias||0;for(let c=0;c<2;c++){this.low[c]+=(this.out[c]-this.low[c])*this.color;const x=this.low[c];this.out[c]=sat?x*(1-sat)+sat*(Math.tanh((x+bias)*d)-Math.tanh(bias*d))/Math.tanh(d):x;}this.position+=(p.clockRatio||1)/this.rate;return this.out;
 }
}
if(typeof AudioWorkletProcessor!=='undefined'){
 class TapePlayer extends AudioWorkletProcessor{
  constructor(){super();this.run=0;this.core=new TapePlaybackCore(sampleRate);this.clock=new TransportClock(sampleRate);this.port.onmessage=({data:m})=>{if(m.type==='configure'){this.core.configure(m.takes,m.settings);if(m.token)this.port.postMessage({ready:m.token});}if(m.type==='transport'){this.clock.command(m);if(m.action==='start')this.baseTempo=m.tempo;}if(m.type==='start'){this.run=m.run;this.linked=m.linked;this.core.start(m.frame,m.seconds);this.core.settings.clockRatio=1;}if(m.type==='stop'){this.run=m.run;this.core.stop();}};}
  process(inputs,outputs){const was=this.core.running,a=outputs[0];for(let i=0;i<a[0].length;i++){this.clock.tick(currentFrame+i);if(this.linked)this.core.settings.clockRatio=this.clock.tempo/(this.baseTempo||108);const v=this.core.tick(currentFrame+i);a[0][i]=v[0];a[1][i]=v[1];}if(currentFrame%2048===0||was&&!this.core.running)this.port.postMessage({run:this.run,running:this.core.running,position:this.core.position,cycle:this.core.cycle});return true;}
 }
 registerProcessor('studio-tape-player',TapePlayer);
}
