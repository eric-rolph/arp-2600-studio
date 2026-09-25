import {TapePlaybackCore} from './tape-core.js';
import {encodeWav} from './wav.js';
self.onmessage=({data:m})=>{try{const core=new TapePlaybackCore(m.rate);core.configure(m.takes,{...m.settings,loop:false,loopBars:0});core.start();const frames=Math.ceil((core.duration+.15)*m.rate),channels=[new Float32Array(frames),new Float32Array(frames)];for(let i=0;i<frames;i++){const out=core.tick(i);channels[0][i]=out[0];channels[1][i]=out[1];}self.postMessage({blob:encodeWav(channels,m.rate,m.bits,{dither:m.dither})});}catch(e){self.postMessage({error:e.message});}};
