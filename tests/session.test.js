import test from 'node:test';
import assert from 'node:assert/strict';
import {packSession,unpackSession} from '../public/session.js';
const buffer=(channels,rate=48000)=>({numberOfChannels:channels.length,length:channels[0].length,sampleRate:rate,getChannelData:i=>Float32Array.from(channels[i])});
const tape=()=>({speed:.5,saturation:.2,wow:.002,flutter:.001,reverse:true,loop:true,takes:[{name:'Voice and synth',wet:buffer([[.1,-.2,.3],[-.3,.2,-.1]]),dry:buffer([[.5,-.5,0]],44100),wetGain:.8,dryGain:.2,rate:2,offset:.1,muted:false,reverse:true}]});
test('session round trip retains exact float samples, stereo/voice stems, rates, patch and tape settings',async()=>{
 const original=tape(),patch={params:{a:.3},routes:{b:'c'}};const file=packSession('test',patch,original),restored=await unpackSession(file,'test');assert.deepEqual(restored.patch,patch);assert.equal(restored.settings.speed,.5);assert.equal(restored.takes[0].wet.rate,48000);assert.equal(restored.takes[0].dry.rate,44100);assert.equal(restored.takes[0].offset,.1);assert.equal(restored.takes[0].reverse,true);for(let c=0;c<2;c++)assert.deepEqual(restored.takes[0].wet.channels[c],original.takes[0].wet.getChannelData(c));assert.deepEqual(restored.takes[0].dry.channels[0],original.takes[0].dry.getChannelData(0));
});
test('sessions reject wrong studio, corrupt headers, truncated audio and nonfinite samples',async()=>{
 const file=packSession('test',{},tape());await assert.rejects(unpackSession(file,'wrong'),/studio/);await assert.rejects(unpackSession(file.slice(0,file.size-4),'test'),/truncated/);await assert.rejects(unpackSession(new Blob(['invalid file!']),'test'),/not a synth/);const bytes=await file.arrayBuffer();new DataView(bytes).setFloat32(bytes.byteLength-4,NaN,true);await assert.rejects(unpackSession(new Blob([bytes]),'test'),/invalid audio/);
});
test('empty sessions retain a patch without allocating audio',async()=>{
 const original=tape();original.takes=[];const restored=await unpackSession(packSession('test',{notes:[]},original),'test');assert.equal(restored.takes.length,0);assert.deepEqual(restored.patch,{notes:[]});
});
