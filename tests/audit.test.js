import test from 'node:test';
import assert from 'node:assert/strict';
import {Engine} from '../public/engine.js';
import {Tape} from '../public/tape.js';
import {SynthCore} from '../public/dsp.js';
test('unheld note-off is inert; releasing a held key never retriggers the remaining note',()=>{
 const engine=new Engine(),messages=[];engine.send=(type,data)=>messages.push({type,...data});engine.on(60);engine.on(64);messages.length=0;engine.off(99);assert.equal(messages.length,0);engine.off(64);assert.equal(messages.at(-1).note,60);assert.equal(messages.at(-1).retrigger,false);
});
test('removing one MIDI device releases only its notes and preserves another keyboard',()=>{
 const engine=new Engine(),a={id:'a',name:'A'},b={id:'b',name:'B'};engine.midiAccess={inputs:new Map([['a',a],['b',b]])};engine.send=()=>{};engine.bindMidi();a.onmidimessage({data:[144,60,100]});a.onmidimessage({data:[176,64,127]});b.onmidimessage({data:[144,67,100]});engine.midiAccess.inputs.delete('a');engine.bindMidi();assert.equal(engine.notes.size,1);assert.equal(engine.sustain,false);assert.equal([...engine.notes.values()][0].note,67);
});
test('an external gate remains authoritative when the keyboard pitch changes',()=>{
 const core=new SynthCore(24000);core.set({sustain:.3,clock:.1});core.params={...core.target};core.patch({adsrGate:'clock',arGate:'clock'});core.noteOn(60);for(let i=0;i<12000;i++)core.tick();assert.ok(Math.abs(core.adsr.value-.3)<.001);core.noteOn(64);for(let i=0;i<100;i++)core.tick();assert.ok(Math.abs(core.adsr.value-.3)<.001,'keyboard retriggered an external envelope');
});
test('zero tape saturation is linear',()=>{
 const tape=new Tape({});tape.saturation=0;const curve=tape.curve();for(let i=0;i<curve.length;i+=101)assert.ok(Math.abs(curve[i]-(2*i/(curve.length-1)-1))<1e-6);
});
test('ARP pitch and filters stay finite at 44.1, 48 and 96 kHz',()=>{
 for(const rate of [44100,48000,96000]){const core=new SynthCore(rate);core.noteOn(69);let crossings=0,last=0;for(let i=0;i<rate/4;i++){const v=core.tick(.1*Math.sin(i*.17));assert.ok(v.every(Number.isFinite));const sample=core.signals.v2sine;if(last<0&&sample>=0)crossings++;last=sample;}assert.ok(Math.abs(crossings*4-440)<=8,`${rate} Hz: ${crossings*4}`);}
});

test('ARP output DC rejection keeps the same bass response at all tested rates',()=>{
 const energies=[];for(const rate of [44100,48000,96000]){const c=new SynthCore(rate);c.params.vcaInitial=1;c.params.vcaAdsr=0;c.params.reverb=0;c.target={...c.params};c.patch({vcaAudio:'preamp'});let sum=0;for(let i=0;i<rate/3;i++){const y=c.tick(.1*Math.sin(i/rate*Math.PI*2*50))[0];if(i>rate/10)sum+=y*y;}energies.push(Math.sqrt(sum/(rate/3-rate/10)));}assert.ok(Math.max(...energies)/Math.min(...energies)<1.01,energies.join(','));
});

test('audio import reserves the current recording slot and checks the limit after decoding',async()=>{
 const tape=new Tape({ctx:{decodeAudioData:async()=>({duration:1,numberOfChannels:1})}});tape.init=async()=>{};const file={size:1,arrayBuffer:async()=>new ArrayBuffer(1)};tape.takes=Array(7).fill({});tape.recording=true;await assert.rejects(tape.importFile(file),/Maximum eight/);tape.recording=false;let finishDecode;tape.engine.ctx.decodeAudioData=()=>new Promise(resolve=>finishDecode=resolve);const pending=tape.importFile(file);await new Promise(resolve=>setTimeout(resolve,0));tape.takes.push({});finishDecode({duration:1,numberOfChannels:1});await assert.rejects(pending,/Maximum eight/);assert.equal(tape.takes.length,8);
});
