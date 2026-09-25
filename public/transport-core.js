// One affine beat timeline, expressed in AudioContext sample frames.
export class TransportClock {
 constructor(rate){this.rate=rate;this.running=false;this.tempo=108;this.beat=0;this.frame=0;this.anchorBeat=0;this.anchorFrame=0;this.queue=[];this.generation=0;}
 command(m){this.queue.push({...m,frame:Math.max(0,Math.round(m.frame??this.frame))});this.queue.sort((a,b)=>a.frame-b.frame);}
 at(frame){return this.anchorBeat+(frame-this.anchorFrame)*this.tempo/(60*this.rate);}
 tick(frame){this.frame=frame;while(this.queue.length&&this.queue[0].frame<=frame){const m=this.queue.shift(),at=this.running?this.at(m.frame):this.beat;if(m.action==='start'){this.anchorBeat=Math.max(0,m.beat||0);this.anchorFrame=m.frame;this.running=true;this.generation++;}else if(m.action==='stop'){this.beat=at;this.running=false;}else if(m.action==='tempo'){this.anchorBeat=at;this.anchorFrame=m.frame;}if(Number.isFinite(m.tempo))this.tempo=Math.max(20,Math.min(300,m.tempo));}if(this.running)this.beat=this.at(frame);return this.running?this.beat:null;}
}
// MIDI song position is measured in six clocks (one sixteenth note).
export class MidiClockInput {
 constructor(){this.running=false;this.pulses=0;this.samples=[];this.tempo=108;this.last=null;}
 receive(data,time){const s=data[0];if(s===242){this.pulses=((data[2]<<7)|data[1])*6;return {action:'position',beat:this.pulses/24};}if(s===250||s===251){if(s===250)this.pulses=0;this.running=true;this.last=null;this.samples=[];return {action:'start',beat:this.pulses/24,tempo:this.tempo};}if(s===252){this.running=false;return {action:'stop'};}if(s!==248)return null;
  if(this.last!==null){const dt=time-this.last;if(dt>=5&&dt<=150){this.samples.push(dt);if(this.samples.length>24)this.samples.shift();const sorted=[...this.samples].sort((a,b)=>a-b);this.tempo=60000/(24*sorted[Math.floor(sorted.length/2)]);}}this.last=time;if(!this.running)return null;const beat=this.pulses++/24;return {action:'pulse',beat,tempo:this.tempo};}
}
