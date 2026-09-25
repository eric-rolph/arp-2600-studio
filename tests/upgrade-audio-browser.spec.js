import {test,expect} from '@playwright/test';
test('stale tape status cannot stop a newer playback and the current take still ends naturally',async({page})=>{
 await page.goto('/');await page.locator('#power').click();
 const result=await page.evaluate(async()=>{const {engine:e,tape:t}=studio,b=e.ctx.createBuffer(1,24000,48000);b.getChannelData(0).fill(.2);t.takes=[{id:'stale-meter',wet:b,wetGain:1,dryGain:0,offset:0,rate:1}];t.loop=true;await t.play();t.player.port.onmessage({data:{run:t.playGeneration-1,running:false,position:99,cycle:99}});return {playing:t.playing,position:t.position};});
 expect(result.playing).toBe(true);expect(result.position).not.toBe(99);await expect.poll(()=>page.evaluate(()=>studio.tape.position)).toBeGreaterThan(.05);
 const stopped=await page.evaluate(()=>{const t=studio.tape;t.stop();t.player.port.onmessage({data:{run:t.playGeneration-1,running:true,position:99,cycle:99}});return {playing:t.playing,position:t.position};});expect(stopped.playing).toBe(false);expect(stopped.position).not.toBe(99);
 await page.evaluate(async()=>{studio.tape.loop=false;await studio.tape.play();});await expect.poll(()=>page.evaluate(()=>studio.tape.playing)).toBe(false);expect(await page.evaluate(()=>studio.tape.position)).toBeGreaterThan(.4);
});
