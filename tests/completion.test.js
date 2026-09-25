import test from 'node:test';
import assert from 'node:assert/strict';
import {Engine} from '../public/engine.js';
import {Tape} from '../public/tape.js';
import {describeMidi, midiSelection} from '../public/midi-input.js';
import {fitTracking, offsetAtPitch} from '../public/calibration-fit.js';
const input = (id, name=id) => ({id, name, state:'connected'});
const fixture = () => {const engine=new Engine(),a=input('A'),b=input('B');engine.midiAccess={inputs:new Map([['A',a],['B',b]])};engine.bindMidi();return {engine,a,b};};

test('MIDI filters expose raw activity while excluding other devices and channels',()=>{
 const {engine,a,b}=fixture(),events=[];engine.addEventListener('midimessage',e=>events.push(e.detail));engine.setMidiFilter({device:'A',channel:2});
 a.onmidimessage({data:[144,60,100]});b.onmidimessage({data:[145,60,100]});a.onmidimessage({data:[145,64,91]});
 assert.deepEqual([...engine.notes.values()].map(n=>n.note),[64]);assert.deepEqual(events.map(e=>e.accepted),[false,false,true]);assert.equal(events[2].channel,2);
 engine.on(55,1,'key-a',false);engine.setMidiFilter({device:'B',channel:0});assert.deepEqual([...engine.notes.keys()],['key-a']);
});
test('MIDI channel all-notes-off does not stop another channel or keyboard',()=>{
 const {engine,a,b}=fixture();a.onmidimessage({data:[144,60,100]});a.onmidimessage({data:[145,64,100]});b.onmidimessage({data:[144,67,100]});a.onmidimessage({data:[176,64,127]});a.onmidimessage({data:[176,123,0]});
 assert.deepEqual([...engine.notes.values()].map(n=>n.note),[64,67]);assert.equal(engine.sustain,false);
});
test('MIDI clock remains available to its dedicated selector when keyboard filtering is enabled',()=>{
 const {engine,b}=fixture();engine.setMidiFilter({device:'A',channel:1});let clock;engine.addEventListener('midirealtime',e=>clock=e.detail);b.onmidimessage({data:[248],timeStamp:100});assert.equal(clock.device,'B');assert.equal(clock.time,100);
 assert.equal(describeMidi([144,128,50]),null);assert.equal(describeMidi([224,0,64]).value,0);assert.equal(describeMidi([144,60,0]).kind,'Note off');assert.deepEqual(midiSelection({channel:99,device:42}),{channel:0,device:''});
});
test('stopping tape while preparation is pending prevents a later start',async()=>{
 const tape=new Tape({ctx:{sampleRate:48000,currentTime:0}}),messages=[];let resolve;tape.player={port:{postMessage:m=>messages.push(m)}};tape.prepare=()=>new Promise(r=>resolve=r);
 const playing=tape.play();tape.stop();resolve();assert.equal(await playing,false);assert.equal(tape.playing,false);assert.equal(messages.some(m=>m.type==='start'),false);
});
test('stopping during recorder initialization cancels that recording request',async()=>{
 const tape=new Tape({});let resolve,started=false;tape.init=()=>new Promise(r=>resolve=r);tape.addEventListener('recordstart',()=>started=true);const request=tape.record();await tape.stopRecord();resolve();await request;assert.equal(started,false);assert.equal(tape.recording,false);
});
const measurements=(cents=12,tracking=1.003)=>[110,220,440,880].map((nominalHz,i)=>({unit:'arp',sha256:String(i+1).padStart(64,'0'),settings:'Synthetic fixture; no hardware claim',method:'Isolated oscillator autocorrelation; one pitch',nominalHz,measuredHz:130.81278265*(nominalHz/130.81278265)**tracking*2**(cents/1200)}));
test('multi-pitch calibration separates tuning offset from tracking across octaves',()=>{
 const fit=fitTracking(measurements(),'arp');assert.ok(Math.abs(fit.cents-12)<1e-8);assert.ok(Math.abs(fit.tracking-1.003)<1e-10);assert.ok(fit.rmsCents<1e-8);assert.equal(fit.spanSemitones,36);
 const nominal=440,tracking=1.003,measuredCents=12+(tracking-1)*1200*Math.log2(nominal/130.81278265);assert.ok(Math.abs(offsetAtPitch(measuredCents,nominal,tracking)-12)<1e-10);
});
test('tracking rejects duplicate files, narrow ranges, outliers and out-of-range fits',()=>{
 const repeated=measurements().map(p=>({...p,sha256:'a'.repeat(64)}));assert.throws(()=>fitTracking(repeated,'arp'),/three different/);
 const narrow=measurements().map((p,i)=>({...p,nominalHz:400+i}));assert.throws(()=>fitTracking(narrow,'arp'),/octave/);
 const bad=measurements();bad[1].measuredHz*=2**(90/1200);assert.throws(()=>fitTracking(bad,'arp'),/disagree/);
 assert.throws(()=>fitTracking(measurements(12,1.2),'arp'),/outside/);
});

test('microphone switching discards late streams and Stop cancels pending permission',async t=>{
 const pending=new Map(),connected=[],engine=new Engine();
 const makeStream=id=>{const track={stopped:false,stop(){this.stopped=true;}};return {id,track,getTracks:()=>[track],getAudioTracks:()=>[track]};};
 Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:({audio})=>new Promise(resolve=>pending.set(audio.deviceId.exact,resolve))}});
 t.after(()=>delete navigator.mediaDevices);engine.start=async()=>{};engine.ctx={createMediaStreamSource:stream=>({connect:()=>connected.push(stream.id),disconnect(){}})};
 const a=makeStream('A'),b=makeStream('B'),c=makeStream('C');
 const first=engine.microphone('A');await Promise.resolve();const second=engine.microphone('B');await Promise.resolve();pending.get('B')(b);assert.equal(await second,true);pending.get('A')(a);assert.equal(await first,false);
 assert.equal(engine.micStream,b);assert.equal(a.track.stopped,true);assert.deepEqual(connected,['B']);
 const third=engine.microphone('C');await Promise.resolve();engine.stopMicrophone();pending.get('C')(c);assert.equal(await third,false);assert.equal(b.track.stopped,true);assert.equal(c.track.stopped,true);assert.equal(engine.micStream,null);assert.equal(engine.micPending,false);
});
