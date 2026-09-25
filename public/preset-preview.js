export function createPreview(notice){
 let ctx,worker,source,request=0;
 function stop(){request++;source?.stop();source=null;worker?.terminate();worker=null;}
 async function play(entry){stop();const id=request;ctx??=new AudioContext({sampleRate:48000});await ctx.resume();if(id!==request)return;notice('Rendering preview…');worker=new Worker('/preset-preview-worker.js',{type:'module'});
  worker.onerror=()=>{if(id===request){stop();notice('Preview could not render. You can still load and play this patch.');}};
  worker.onmessage=({data:r})=>{if(r.id!==request)return;worker.terminate();worker=null;if(r.error){notice(r.error);return;}const buffer=ctx.createBuffer(2,r.left.length,r.rate);buffer.copyToChannel(r.left,0);buffer.copyToChannel(r.right,1);source=ctx.createBufferSource();source.buffer=buffer;const gain=ctx.createGain();gain.gain.value=.3;source.connect(gain).connect(ctx.destination);source.onended=()=>{gain.disconnect();if(id===request){source=null;notice('Preview finished. Your current patch is unchanged.');}};source.start();notice(entry.mode==='Microphone'?'Previewing with a generated microphone test signal.':'Previewing '+entry.name+'.');};worker.postMessage({id,entry});
 }
 return {play,stop};
}
