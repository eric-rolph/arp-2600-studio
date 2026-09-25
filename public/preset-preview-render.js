import {SynthCore} from './dsp.js';
export function renderPreview(entry,rate=48000){
 const core=new SynthCore(rate);core.set(entry.patch.params);Object.assign(core.params,core.target);core.patch(entry.patch.routes);core.noteOn(entry.note||60,.8,true,entry.note||60,(entry.note||60)+7);
 const frames=rate*3,left=new Float32Array(frames),right=new Float32Array(frames),release=Math.round(rate*(entry.gate??(entry.category==='Percussion'?.15:1.6)));let peak=0,energy=0;
 for(let i=0;i<frames;i++){if(i===release)core.noteOff();const t=i/rate,mic=entry.mode==='Microphone'?.14*(Math.sin(t*2*Math.PI*170)+.35*Math.sin(t*2*Math.PI*510))*(.55+.45*Math.sin(t*2*Math.PI*2)):0,out=core.tick(mic),fade=Math.min(1,i/(rate*.008),(frames-i)/(rate*.035));left[i]=out[0]*fade;right[i]=out[1]*fade;peak=Math.max(peak,Math.abs(left[i]),Math.abs(right[i]));energy+=left[i]**2+right[i]**2;}
 return {left,right,rate,peak,rms:Math.sqrt(energy/(frames*2))};
}
