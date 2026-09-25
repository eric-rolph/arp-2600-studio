const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const performanceDefaults=()=>({bars:2,loop:true,countIn:4,click:true,notes:[],lanes:{}});
export const automatable=(id,controls)=>Object.hasOwn(controls,id)&&!['master','tempo','mains'].includes(id);
export function validatePerformance(raw={},controls={}){
 const p=performanceDefaults();if(!raw||typeof raw!=='object')return p;
 p.bars=[1,2,4,8].includes(raw.bars)?raw.bars:2;p.loop=raw.loop!==false;p.countIn=[0,4,8].includes(raw.countIn)?raw.countIn:4;p.click=raw.click!==false;
 const beats=p.bars*4;
 for(const n of (Array.isArray(raw.notes)?raw.notes:[]).slice(0,512)){
  if(!n||![n.at,n.length,n.note,n.velocity].every(Number.isFinite)||n.at<0||n.at>=beats||n.length<=0)continue;
  p.notes.push({at:n.at,length:Math.min(beats-n.at,Math.max(1/128,n.length)),note:Math.round(clamp(n.note,0,127)),velocity:clamp(n.velocity,.01,1)});
 }
 p.notes.sort((a,b)=>a.at-b.at);
 let remaining=12000;
 for(const [id,points] of Object.entries(raw.lanes||{})){
  if(!automatable(id,controls)||!Array.isArray(points)||!remaining||Object.keys(p.lanes).length>=32)continue;
  const c=controls[id],clean=points.slice(0,Math.min(2048,remaining)).filter(p=>p&&Number.isFinite(p.at)&&p.at>=0&&p.at<=beats&&Number.isFinite(p.value)).map(p=>({at:p.at,value:clamp(p.value,c.min,c.max),...(['linear','smooth'].includes(p.curve)?{curve:p.curve}:{})})).sort((a,b)=>a.at-b.at);
  if(clean.length){p.lanes[id]=clean.filter((p,i)=>i===clean.length-1||clean[i+1].at!==p.at);remaining-=p.lanes[id].length;}
 }
 return p;
}
export function quantizeNotes(notes,grid,beats){
 if(!grid)return notes.map(n=>({...n}));
 return notes.map(n=>{const at=clamp(Math.round(n.at/grid)*grid,0,beats-grid),end=clamp(Math.round((n.at+n.length)/grid)*grid,at+grid,beats);return {...n,at,length:end-at};}).sort((a,b)=>a.at-b.at);
}

// Audio-thread transport: note boundaries and the monitor click use sample frames.
// Main-thread timers are used only to display position and collect gestures.
export class PerformanceClock{
 constructor(rate,voice,parameter){this.rate=rate;this.voice=voice;this.parameter=parameter;this.running=false;this.live=null;this.held=new Map();this.values={};}
 start(clip,{tempo=108,startFrame=0,countIn=0,recording=false}={}){
  this.stop();this.clip=clip;this.recording=recording;this.framesPerBeat=this.rate*60/tempo;this.startFrame=Math.round(startFrame);this.countIn=countIn;this.countFrames=Math.round(countIn*this.framesPerBeat);this.duration=Math.round(clip.bars*4*this.framesPerBeat);this.running=true;this.cycle=-1;this.lastBeat=null;this.clickAge=Infinity;this.position=-countIn;this.events=[];this.values={};
  if(!recording)clip.notes.forEach((n,id)=>{this.events.push({frame:Math.round(n.at*this.framesPerBeat),on:true,id,n});this.events.push({frame:Math.round((n.at+n.length)*this.framesPerBeat),on:false,id,n});});
  this.events.sort((a,b)=>a.frame-b.frame||Number(a.on)-Number(b.on));
  this.lanes=Object.entries(recording?{}:clip.lanes).map(([id,points])=>({id,points,index:0}));
 }
 liveOn(data){this.live=data;this.emit(data.retrigger!==false);}
 liveOff(){this.live=null;this.emit(false);}
 emit(retrigger){const notes=[...this.held.values()],last=this.live||notes.at(-1);this.voice(last?{...last,retrigger,lower:this.live?.lower??Math.min(...notes.map(n=>n.note)),upper:this.live?.upper??Math.max(...notes.map(n=>n.note))}:null);}
 stop(){const had=this.held.size;this.held.clear();this.running=false;this.clickAge=Infinity;if(had)this.emit(false);}
 tick(frame){
  if(!this.running)return 0;const elapsed=frame-this.startFrame;if(elapsed<0)return 0;
  const music=elapsed-this.countFrames;
  if(music>=this.duration&&(this.recording||!this.clip.loop)){this.stop();this.position=this.clip.bars*4;return 0;}
  const cycle=music<0?-1:Math.floor(music/this.duration),local=music<0?music:music%this.duration;
  this.position=local/this.framesPerBeat;
  if(cycle!==this.cycle){this.cycle=cycle;this.held.clear();this.emit(false);this.index=0;this.values={};for(const lane of this.lanes)lane.index=0;}
  if(music>=0){
   while(this.index<this.events.length&&this.events[this.index].frame<=local){const e=this.events[this.index++];if(e.on){this.held.delete(e.id);this.held.set(e.id,e.n);}else this.held.delete(e.id);if(!this.live)this.emit(e.on);}
   if(local%32===0||local===0)for(const lane of this.lanes){const points=lane.points;while(lane.index+1<points.length&&points[lane.index+1].at<=this.position)lane.index++;const point=points[lane.index],next=points[lane.index+1];if(this.position<point.at)continue;let value=point.value;if(next&&['linear','smooth'].includes(point.curve)){let t=clamp((this.position-point.at)/(next.at-point.at),0,1);if(point.curve==='smooth')t=t*t*(3-2*t);value=point.value+(next.value-point.value)*t;}if(this.values[lane.id]!==value){this.values[lane.id]=value;this.parameter(lane.id,value);}}
  }
  const beat=music<0?Math.floor(elapsed/this.framesPerBeat):Math.floor(local/this.framesPerBeat),tag=music<0?beat:this.countIn+cycle*this.clip.bars*4+beat;
  if(tag!==this.lastBeat){this.lastBeat=tag;this.clickAge=0;this.clickHz=beat%4===0?1400:950;}
  const age=this.clickAge++/this.rate;
  return (music<0||this.clip.click)&&age<.035?.12*Math.sin(2*Math.PI*this.clickHz*age)*Math.exp(-age*150):0;
 }
}
