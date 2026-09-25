import test from 'node:test';
import assert from 'node:assert/strict';
import {SynthCore,Envelope,Ladder} from '../public/dsp.js';
import {presets,defaults} from '../public/model.js';
import {encodeWav} from '../public/tape.js';
const rms=a=>Math.sqrt(a.reduce((n,v)=>n+v*v,0)/a.length);
test('unpatched instrument is silent until gated, then responds to notes and release',()=>{
  const s=new SynthCore(48000);let out=Array.from({length:4800},()=>s.tick()[0]);assert.equal(rms(out),0);
  s.noteOn(60);out=Array.from({length:24000},()=>s.tick()[0]);assert.ok(rms(out)>.03);
  s.noteOff();for(let i=0;i<192000;i++)s.tick();assert.ok(Math.abs(s.signals.vca)<.0001);
});
test('oscillator tuning doubles per octave',()=>{
  for(const [note,hz] of [[57,220],[69,440],[81,880]]){const s=new SynthCore(48000);s.noteOn(note);for(let i=0;i<2000;i++)s.tick();let crossings=0,prev=0;for(let i=0;i<48000;i++){s.tick();const v=s.signals.v1saw;if(prev<0&&v>=0)crossings++;prev=v;}assert.ok(Math.abs(crossings-hz)<=1,`${note}: ${crossings}`);}
});
test('voice envelope opens the droid patch and silence releases it',()=>{
  const s=new SynthCore(48000),p=presets['Droid · voice + circuit'];s.set(p.params);s.patch(p.routes);s.noteOn(60);
  let out=Array.from({length:8000},()=>s.tick(0)[0]);assert.equal(rms(out),0);
  out=Array.from({length:24000},(_,i)=>s.tick(Math.sin(i/48000*2*Math.PI*170)*.35)[0]);assert.ok(s.signals.ef>.5);assert.ok(rms(out)>.003);
  for(let i=0;i<48000;i++)s.tick(0);assert.ok(s.signals.ef<.01);
});
test('patching overrides normal routing and unpatching restores it',()=>{const s=new SynthCore();s.signals.v1saw=.25;s.signals.preamp=.7;assert.equal(s.input('ringA'),.25);s.patch({ringA:'preamp'});assert.equal(s.input('ringA'),.7);s.patch({});assert.equal(s.input('ringA'),.25);});
test('duophonic mode exposes distinct lower and upper keyboard CV',()=>{const s=new SynthCore();s.set({duo:1});s.noteOn(67,1,true,60,67);for(let i=0;i<8000;i++)s.tick();assert.ok(Math.abs(s.signals.keyboard-1)<.001);assert.ok(Math.abs(s.signals.keyboardUpper-19/12)<.001);});
test('ADSR sustains and releases; a held gate does not continuously retrigger',()=>{const e=new Envelope();for(let i=0;i<48000;i++)e.tick(true,.01,.1,.4,.1,48000);assert.ok(Math.abs(e.value-.4)<.001);for(let i=0;i<48000;i++)e.tick(false,.01,.1,.4,.1,48000);assert.equal(e.value,0);});
test('resonant filter and audio feedback stay finite at extreme settings',()=>{const s=new SynthCore();s.set({...defaults,cutoff:18000,resonance:.98,vcaInitial:1,filterFM:3,drive:1});s.patch({filter1:'vca',filter2:'noise',filterFM:'vcf'});for(let i=0;i<48000;i++){const out=s.tick();assert.ok(out.every(Number.isFinite));assert.ok(Math.abs(out[0])<=1);}});
test('four-pole filter attenuates high frequencies',()=>{function energy(hz){const f=new Ladder();let sum=0;for(let i=0;i<48000;i++){const y=f.tick(Math.sin(i/48000*2*Math.PI*hz)*.1,800,0,48000,0);if(i>10000)sum+=y*y;}return sum;}assert.ok(energy(6000)<energy(100)*.002);});
test('WAV export has correct PCM format, channels, length and clipping',async()=>{const blob=encodeWav([new Float32Array([0,1,-2]),new Float32Array([.5,-1,0])],48000);const v=new DataView(await blob.arrayBuffer());assert.equal(v.byteLength,56);assert.equal(v.getUint16(22,true),2);assert.equal(v.getUint32(24,true),48000);assert.equal(v.getInt16(52,true),-32768);});
test('every built-in preset produces finite, audible output',()=>{
  for(const [name,patch]of Object.entries(presets)){
    const synth=new SynthCore(48000);synth.params={...defaults,...patch.params};synth.target={...synth.params};synth.patch(patch.routes);synth.noteOn(60);
    let energy=0,peak=0;
    const needsMic=name.toLowerCase().includes('voice');
    for(let i=0;i<60000;i++){const mic=needsMic?.2*Math.sin(i/48000*Math.PI*2*170):0;const [value]=synth.tick(mic);energy+=value*value;peak=Math.max(peak,Math.abs(value));}
    assert.ok(Number.isFinite(energy),`${name}: finite samples`);assert.ok(peak<=1,`${name}: bounded output`);assert.ok(Math.sqrt(energy/60000)>.0005,`${name}: audible output`);
  }
});
