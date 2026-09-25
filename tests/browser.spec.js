import {test,expect} from '@playwright/test';
test('instrument, patching, voice, tape capture and WAV export work end to end',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');
 await expect(page.locator('.key')).toHaveCount(49);await expect(page.locator('.module')).toHaveCount(12);
 await page.getByRole('button',{name:'Power on'}).click();await expect(page.locator('#audio-state')).toHaveText('ENGINE RUNNING');
 await page.keyboard.down('a');await page.waitForTimeout(500);
 const energy=await page.evaluate(()=>{const a=new Float32Array(2048);studio.engine.analyser.getFloatTimeDomainData(a);return Math.sqrt(a.reduce((n,x)=>n+x*x,0)/a.length);});expect(energy).toBeGreaterThan(.005);await page.keyboard.up('a');
 await page.locator('[data-jack="v2sine"][data-type="output"]').click();await page.locator('[data-jack="filter1"][data-type="input"]').click();await expect(page.locator('#cables .cable')).toHaveCount(1);
 await page.locator('[data-jack="filter1"][data-type="input"]').click();await expect(page.locator('#cables .cable')).toHaveCount(0);
 await page.locator('#preset').selectOption('Droid · voice + circuit');await expect(page.locator('#cables .cable')).toHaveCount(4);
 await page.locator('#mic').click();await expect(page.locator('#mic')).toContainText('●');await page.waitForTimeout(600);
 expect(await page.evaluate(()=>!!studio.engine.micStream)).toBe(true);
 await page.locator('#record').click();await page.keyboard.down('g');await page.waitForTimeout(1200);await page.keyboard.up('g');await page.locator('#tape-stop').click();await expect(page.locator('.take')).toHaveCount(1);
 const capture=await page.evaluate(()=>{const t=studio.tape.takes[0];return {seconds:t.wet.duration,channels:t.wet.numberOfChannels,dry:t.dry.numberOfChannels,wetPeak:Math.max(...t.wet.getChannelData(0).slice(1000,10000).map(Math.abs))};});expect(capture.seconds).toBeGreaterThan(.8);expect(capture.channels).toBe(2);expect(capture.dry).toBe(1);
 await page.locator('[data-speed="2"]').click();await expect(page.locator('#speed-readout')).toContainText('+12.0 st');
 await page.locator('#tape-play').click();await expect(page.locator('#tape-status')).toHaveText('PLAYING');await page.locator('#tape-stop').click();
 const downloadPromise=page.waitForEvent('download');await page.locator('#export-mix').click();const download=await downloadPromise;expect(download.suggestedFilename()).toBe('2600-tape-mix.wav');
 await page.locator('#panic').click();await page.locator('#mic').click();expect(await page.evaluate(()=>studio.engine.micStream)).toBeNull();
 await page.screenshot({path:'test-results/desktop.png',fullPage:true});expect(errors).toEqual([]);
});
test('small screens retain all controls without page overflow',async({page})=>{await page.setViewportSize({width:390,height:844});await page.goto('/');expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);await page.locator('#preset').selectOption('Droid · voice + circuit');await page.screenshot({path:'test-results/mobile.png',fullPage:true});await expect(page.locator('#record')).toBeVisible();});
test('live tape speed and gain changes preserve transport and pitch-duration relationship',async({page})=>{
 await page.goto('/');await page.locator('#power').click();
 await page.evaluate(async()=>{const ctx=studio.engine.ctx,b=ctx.createBuffer(1,48000*4,48000);for(let i=0;i<b.length;i++)b.getChannelData(0)[i]=.15*Math.sin(i/48000*Math.PI*2*440);studio.tape.takes.push({id:'test',name:'Calibration',wet:b,dry:null,wetGain:1,dryGain:0,offset:0,muted:false,rate:1,reverse:false});studio.tape.changed();await studio.tape.play();window.originalSource=studio.tape.layers[0].src;window.originalStart=studio.tape.playStart;});
 await page.waitForTimeout(300);await page.locator('[data-speed="2"]').click();
 expect(await page.evaluate(()=>studio.tape.layers[0].src===window.originalSource&&studio.tape.playStart===window.originalStart)).toBe(true);
 expect(await page.evaluate(async()=>{const wav=await studio.tape.export(),v=new DataView(await wav.arrayBuffer());return v.getUint32(40,true)/4/studio.engine.ctx.sampleRate;})).toBeCloseTo(2.15,1);
 await page.locator('#tape-stop').click();
});
test('MIDI note, sustain, bend and controller messages affect the instrument',async({page})=>{
 await page.goto('/');await page.evaluate(()=>{window.fakeMidi={id:'fake',name:'Test keyboard'};navigator.requestMIDIAccess=async()=>({inputs:new Map([['fake',window.fakeMidi]])});});
 await page.locator('#midi').click();await expect(page.locator('#midi')).toContainText('●');await page.evaluate(()=>{fakeMidi.onmidimessage({data:[0x90,64,100]});fakeMidi.onmidimessage({data:[0xb0,64,127]});fakeMidi.onmidimessage({data:[0x80,64,0]});});
 expect(await page.evaluate(()=>studio.engine.notes.size)).toBe(1);
 await page.evaluate(()=>{fakeMidi.onmidimessage({data:[0xb0,64,0]});fakeMidi.onmidimessage({data:[0xe0,127,127]});fakeMidi.onmidimessage({data:[0xb0,74,64]});});
 expect(await page.evaluate(()=>studio.engine.notes.size)).toBe(0);expect(await page.evaluate(()=>studio.engine.params.bend)).toBeGreaterThan(1.99);expect(await page.evaluate(()=>studio.engine.params.cutoff)).toBeGreaterThan(500);
});
