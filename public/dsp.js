import {calibrationDefaults,calibratedParameters,calibratedFrequency} from './calibration.js';
import {PerformanceRuntime} from './performance-runtime.js';
import { defaults, normal } from './model.js';

const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const TAU=Math.PI*2;
export function polyBlep(t,dt) {
  if(t<dt){t/=dt;return t+t-t*t-1;}
  if(t>1-dt){t=(t-1)/dt;return t*t+t+t+1;}
  return 0;
}
export class Envelope {
  constructor(){this.value=0;this.stage=0;this.gate=false;}
  tick(gate,a,d,s,r,rate,retrigger=false){
    if(d!==this.decay||r!==this.release||rate!==this.rate){this.decay=d;this.release=r;this.rate=rate;this.decayPole=Math.exp(-5/(Math.max(.002,d)*rate));this.releasePole=Math.exp(-5/(Math.max(.002,r)*rate));}
    if(gate&&(!this.gate||retrigger))this.stage=1;
    if(!gate&&this.gate)this.stage=4;
    this.gate=gate;
    if(this.stage===1){this.value+=1/(Math.max(.001,a)*rate);if(this.value>=1){this.value=1;this.stage=2;}}
    else if(this.stage===2){this.value=s+(this.value-s)*this.decayPole;if(Math.abs(this.value-s)<.0005)this.stage=3;}
    else if(this.stage===3)this.value=s;
    else if(this.stage===4){this.value*=this.releasePole;if(this.value<.00001){this.value=0;this.stage=0;}}
    return this.value;
  }
}

// Oversampled, saturating four-pole ladder approximation; not a component-level SPICE model.
export class Ladder {
  constructor(){this.z=new Float64Array(4);}
  tick(input,cutoff,resonance,rate,drive){
    if(cutoff!==this.cutoff||rate!==this.rate){this.cutoff=cutoff;this.rate=rate;this.g=1-Math.exp(-TAU*clamp(cutoff,15,rate*.19)/rate);}const g=this.g;
    let x=Math.tanh(input*(1+drive*3)-this.z[3]*resonance*4.1);
    for(let k=0;k<4;k++){this.z[k]+=g*(Math.tanh(x)-Math.tanh(this.z[k]));x=this.z[k];}
    return x;
  }
}

class Spring {
  constructor(rate){
    this.buffers=[.0297,.0371,.0411,.0437,.0531,.0617].map(t=>new Float32Array(Math.floor(t*rate)));
    this.damping=1-.78**(48000/rate);this.pos=new Int32Array(6);this.low=new Float64Array(6);
    this.ap=[new Float32Array(Math.floor(rate*.0047)),new Float32Array(Math.floor(rate*.0013))];this.apos=[0,0];
  }
  tick(x,decay){
    let sum=0;
    for(let k=0;k<6;k++){let b=this.buffers[k],p=this.pos[k],v=b[p];this.low[k]+=this.damping*(v-this.low[k]);b[p]=x*.16+this.low[k]*(.48+decay*.44);this.pos[k]=(p+1)%b.length;sum+=v;}
    for(let k=0;k<2;k++){const p=this.apos[k],b=this.ap[k],v=b[p];b[p]=sum+v*.58;sum=v-sum*.58;this.apos[k]=(p+1)%b.length;}
    return sum*.5;
  }
}

export class SynthCore {
  constructor(rate=48000){
    this.calibration=calibrationDefaults();this.rate=rate;this.osRate=rate*2;this.params={...defaults};this.target={...defaults};this.routes={};
    this.signals=Object.fromEntries(Object.values(normal).map(s=>[s,0]));
    this.phases=[0,.23,.51];this.tri=0;this.pink=[0,0,0];this.lowNoise=0;this.seed=173812;
    this.filter=new Ladder();this.springL=new Spring(rate);this.springR=new Spring(rate*1.013);
    this.adsr=new Envelope();this.ar=new Envelope();this.note=48;this.lowerNote=48;this.upperNote=48;this.pitch=0;this.upperPitch=0;this.velocity=1;this.gate=false;this.retrigger=false;
    this.follow=0;this.clockPhase=0;this.lfoPhase=0;this.sh=0;this.shHigh=false;this.switchState=false;this.lag=0;
    this.ringPole=.9985**(48000/rate);this.outputPole=.995**(48000/rate);this.ringPrev=0;this.ringDC=0;this.outPrev=0;this.outDC=0;this.result=new Float32Array(3);this.frame=0;this.peak=0;this.micPeak=0;
  }
  set(values){for(const [k,v] of Object.entries(values))if(Object.hasOwn(defaults,k)&&Number.isFinite(v))this.target[k]=v;}
  patch(routes){this.routes={...routes};}
  input(id){return clamp(this.signals[this.routes[id]||normal[id]]||0,-20,20);}
  keyboardRetrigger(id){return !this.routes[id]||this.routes[id]==='gate';}
  noteOn(note,velocity=1,retrigger=true,lower=note,upper=note){this.note=note;this.lowerNote=lower;this.upperNote=upper;this.velocity=velocity;this.gate=true;this.retrigger=retrigger;}
  noteOff(){this.gate=false;}
  random(){let x=this.seed;x^=x<<13;x^=x>>>17;x^=x<<5;this.seed=x;return (x>>>0)/2147483648-1;}
  tick(mic=0){
    let p=this.params;const s=this.signals;
    // Smooth all continuous controls on the audio thread to avoid zipper noise.
    if((this.frame&15)===0){for(const k in p)p[k]+=(this.target[k]-p[k])*.07;this.glideStep=p.glide>.001?1-Math.exp(-1/(p.glide*this.rate)):1;this.followAttack=1-Math.exp(-1/(this.rate*Math.max(.001,p.efAttack)));this.followRelease=1-Math.exp(-1/(this.rate*Math.max(.001,p.efRelease)));this.lagStep=1-Math.exp(-1/(this.rate*Math.max(.001,p.lag)));}
    const wanted=((p.duo>.5?this.lowerNote:this.note)-48)/12+p.octave+p.bend/12;
    this.pitch+=(wanted-this.pitch)*this.glideStep;
    const upperWanted=(this.upperNote-48)/12+p.octave+p.bend/12;
    this.upperPitch+=(upperWanted-this.upperPitch)*this.glideStep;
    this.lfoPhase=(this.lfoPhase+p.vibratoRate/this.rate)%1;
    s.lfo=Math.sin(TAU*this.lfoPhase);
    s.keyboard=this.pitch+s.lfo*(p.vibrato+p.mod*.2)/12;
    s.keyboardUpper=this.upperPitch+s.lfo*(p.vibrato+p.mod*.2)/12;
    s.gate=this.gate?10:0;
    s.preamp=Math.tanh(mic*p.preamp);
    const ef=Math.abs(this.input('efInput'));
    this.follow+=(ef-this.follow)*(ef>this.follow?this.followAttack:this.followRelease);
    s.ef=clamp(this.follow*p.efGain*5,0,10);
    if(this.calibration.enabled){if((this.frame&15)===0||!this.corrected)this.corrected=calibratedParameters(this.params,this.calibration,'arp');p=this.corrected;}
    s.adsr=10*this.adsr.tick(this.input('adsrGate')>1,p.attack,p.decay,p.sustain,p.release,this.rate,this.retrigger&&this.keyboardRetrigger('adsrGate'));
    s.ar=10*this.ar.tick(this.input('arGate')>1,p.arAttack,.002,1,p.arRelease,this.rate,this.retrigger&&this.keyboardRetrigger('arGate'));
    this.retrigger=false;
    let white=this.random();
    this.pink[0]=.99765*this.pink[0]+white*.099046;
    this.pink[1]=.963*this.pink[1]+white*.2965164;
    this.pink[2]=.57*this.pink[2]+white*1.0526913;
    const pink=(this.pink[0]+this.pink[1]+this.pink[2]+white*.1848)*.18;
    this.lowNoise+=.006*(white-this.lowNoise);
    s.noise=p.noiseColor<.5?white*(1-p.noiseColor*2)+pink*p.noiseColor*2:pink*(2-p.noiseColor*2)+this.lowNoise*6*(p.noiseColor*2-1);
    this.clockPhase+=p.clock/this.rate;
    if(this.clockPhase>=1){this.clockPhase-=1;this.switchState=!this.switchState;}
    s.clock=this.clockPhase<.5?10:0;
    const shHigh=this.input('shClock')>1;
    if(shHigh&&!this.shHigh)this.sh=this.input('shInput');
    this.shHigh=shHigh;s.sh=this.sh*p.shLevel;
    s.switch=this.input(this.switchState?'switchA':'switchB');
    s.processor=this.input('procA')*p.procA+this.input('procB')*p.procB+p.offset;
    this.lag+=(this.input('lagInput')-this.lag)*this.lagStep;s.lag=this.lag;
    let filtered=0;
    for(let sub=0;sub<2;sub++){
      for(let k=0;k<3;k++){
        const n=k+1,base='v'+n;
        const pitch=p[base+'lf']>.5?0:this.input(base+'pitch');
        let hz=clamp((p[base+'lf']>.5?.5:130.81278265)*2**clamp(pitch+p[base+'coarse']/12+p[base+'fine']/1200+this.input(base+'fm')*p[base+'fm'], -16,12),.01,this.rate*.4);if(this.calibration.enabled&&p[base+'lf']<.5)hz=clamp(calibratedFrequency(hz,this.calibration.units.arp),.01,this.rate*.4);
        const dt=hz/this.osRate,t=this.phases[k];
        const pw=clamp(p[base+'pw']+(k===1?this.input('v2pwm')*p.v2pwm*.1:0),.03,.97);
        const saw=2*t-1-polyBlep(t,dt);
        const pulse=(t<pw?1:-1)+polyBlep(t,dt)-polyBlep((t-pw+1)%1,dt);
        s[base+'saw']=saw;s[base+'pulse']=pulse;
        if(k===1){s.v2sine=Math.sin(TAU*t);this.tri=dt*4*((t<.5?1:-1)+polyBlep(t,dt)-polyBlep((t+.5)%1,dt))+(1-dt*4)*this.tri;s.v2tri=this.tri*3;}
        this.phases[k]=(t+dt)%1;
      }
      let ring=this.input('ringA')*p.ringX*this.input('ringB')*p.ringY;
      if(p.ringAC>.5){const hp=ring-this.ringPrev+this.ringPole*this.ringDC;this.ringPrev=ring;this.ringDC=hp;ring=hp;}
      s.ring=ring;
      const mix=this.input('filter1')*p.v1level+this.input('filter2')*p.v2level+this.input('filter3')*p.v3level+this.input('filterNoise')*p.noiseLevel+this.input('filterRing')*p.ringLevel+this.input('filterMic')*p.micLevel;
      const cutoff=p.cutoff*2**clamp(this.input('filterEnv')*.1*p.filterEnv+this.input('filterPitch')*p.filterKey+this.input('filterFM')*p.filterFM,-12,10);
      filtered+=this.filter.tick(mix,cutoff,p.resonance,this.osRate,p.drive)*.5;
    }
    s.vcf=filtered;
    const gain=clamp(p.vcaInitial+this.input('vcaCV')*.1*p.vcaAdsr+this.input('vcaAR')*.1*p.vcaAr,0,2);
    s.vca=(this.input('vcaAudio')+this.input('vcaRing')*p.vcaRing)*gain*(.4+.6*this.velocity);
    // DC rejection, modest saturation and hard safety bound on the final instrument bus.
    const hp=s.vca-this.outPrev+this.outputPole*this.outDC;this.outPrev=s.vca;this.outDC=hp;
    const dry=Math.tanh(hp*1.2);
    const wetL=this.springL.tick(dry,p.reverbTime),wetR=this.springR.tick(dry,p.reverbTime);
    const l=(dry*(1-p.reverb*.6)+wetL*p.reverb)*Math.sqrt((1-p.pan)*.5);
    const r=(dry*(1-p.reverb*.6)+wetR*p.reverb)*Math.sqrt((1+p.pan)*.5);
    this.frame++;this.peak=Math.max(this.peak,Math.abs(l),Math.abs(r));this.micPeak=Math.max(this.micPeak,Math.abs(s.preamp));
    this.result[0]=clamp(l,-1,1);this.result[1]=clamp(r,-1,1);this.result[2]=s.preamp;return this.result;
  }
}

// Kept importable in Node for DSP regression tests.
if(typeof AudioWorkletProcessor!=='undefined'){
  class Instrument extends AudioWorkletProcessor {
    constructor(){super();this.core=new SynthCore(sampleRate);this.runtime=new PerformanceRuntime(sampleRate,{ids:['arp'],voice:n=>{if(!this.runtime.state.parts.arp.enabled)n?this.core.noteOn(n.note,n.velocity,n.retrigger,n.lower,n.upper):this.core.noteOff();},partVoice:(id,n)=>n?this.core.noteOn(n.note,n.velocity,n.retrigger,n.lower,n.upper):this.core.noteOff(),parameter:(key,value)=>this.core.set(key?{[key]:value}:value)});this.performance=this.runtime.performance;this.port.onmessage=({data:m})=>{this.runtime.message(m);if(m.type==='configure'){this.runtime.configure(m.state);this.core.calibration=m.state.calibration;}
      if(m.type==='params')this.core.set(m.values);
      if(m.type==='routes')this.core.patch(m.routes);
      if(m.type==='panic'){this.runtime.stop();this.core=new SynthCore(sampleRate);this.core.calibration=this.runtime.state.calibration||calibrationDefaults();this.core.set(m.values||{});this.core.patch(m.routes||{});}
    };}
    process(inputs,outputs){const a=outputs[0],b=outputs[1],mic=inputs[0]?.[0];for(let i=0;i<a[0].length;i++){const click=this.runtime.tick(currentFrame+i),v=this.core.tick(mic?.[i]||0);if(outputs[2])outputs[2][0][i]=click;a[0][i]=v[0];a[1][i]=v[1];b[0][i]=v[2];}
      if(this.core.frame%2048===0){this.port.postMessage({type:'meter',peak:this.core.peak,mic:this.core.micPeak,ef:this.core.signals.ef,adsr:this.core.signals.adsr,transport:{running:this.runtime.transport.running,beat:this.runtime.transport.beat},performance:{running:this.performance.running,position:this.performance.position||0,values:this.performance.values,notes:[...this.performance.held.values()].map(n=>n.note)}});this.core.peak=0;this.core.micPeak=0;}return true;}
  }
  class Capture extends AudioWorkletProcessor {
    constructor(){super();this.recording=false;this.cursor=0;this.count=0;this.buffers=[new Float32Array(4096),new Float32Array(4096),new Float32Array(4096)];this.port.onmessage=({data:m})=>{if(m==='start'){this.cursor=0;this.count=0;this.recording=true;}if(m==='stop'){this.flush();this.recording=false;this.port.postMessage({type:'stopped'});}};}
    flush(){if(!this.cursor)return;const channels=this.buffers.map(b=>b.slice(0,this.cursor));this.port.postMessage({type:'chunk',channels},channels.map(b=>b.buffer));this.cursor=0;}
    process(inputs,outputs){outputs[0][0].fill(0);if(this.recording){const size=outputs[0][0].length;for(let i=0;i<size;i++){this.buffers[0][this.cursor]=inputs[0]?.[0]?.[i]||0;this.buffers[1][this.cursor]=inputs[0]?.[1]?.[i]||0;this.buffers[2][this.cursor]=inputs[1]?.[0]?.[i]||0;this.cursor++;this.count++;if(this.cursor===4096)this.flush();if(this.count>=sampleRate*180){this.flush();this.recording=false;this.port.postMessage({type:'limit'});break;}}}return true;}
  }
  registerProcessor('synth-2600',Instrument);registerProcessor('tape-capture',Capture);
}
