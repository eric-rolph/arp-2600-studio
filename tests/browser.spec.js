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
 await page.locator('#loop').check();await page.locator('#tape-play').click();await expect(page.locator('#tape-status')).toHaveText('PLAYING');await page.locator('#tape-stop').click();await page.locator('#loop').uncheck();
 const downloadPromise=page.waitForEvent('download');await page.locator('#export-mix').click();const download=await downloadPromise;expect(download.suggestedFilename()).toBe('2600-tape-mix.wav');
 await page.locator('#panic').click();await page.locator('#mic').click();expect(await page.evaluate(()=>studio.engine.micStream)).toBeNull();
 await page.screenshot({path:'test-results/desktop.png',fullPage:true});expect(errors).toEqual([]);
});
test('small screens retain all controls without page overflow',async({page})=>{await page.setViewportSize({width:390,height:844});await page.goto('/');expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);await page.locator('#preset').selectOption('Droid · voice + circuit');await page.screenshot({path:'test-results/mobile.png',fullPage:true});await expect(page.locator('#record')).toBeVisible();});
test('live tape speed and gain changes preserve transport and pitch-duration relationship',async({page})=>{
 await page.goto('/');await page.locator('#power').click();
 await page.evaluate(async()=>{const ctx=studio.engine.ctx,b=ctx.createBuffer(1,48000*4,48000);for(let i=0;i<b.length;i++)b.getChannelData(0)[i]=.15*Math.sin(i/48000*Math.PI*2*440);studio.tape.takes.push({id:'test',name:'Calibration',wet:b,dry:null,wetGain:1,dryGain:0,offset:0,muted:false,rate:1,reverse:false});studio.tape.changed();await studio.tape.play();window.originalSource=studio.tape.player;window.originalStart=studio.tape.playStart;});
 await page.waitForTimeout(300);await page.locator('[data-speed="2"]').click();
 expect(await page.evaluate(()=>studio.tape.player===window.originalSource&&studio.tape.playStart===window.originalStart)).toBe(true);
 expect(await page.evaluate(async()=>{const wav=await studio.tape.export(),v=new DataView(await wav.arrayBuffer());return v.getUint32(40,true)/v.getUint32(28,true);})).toBeCloseTo(2.15,1);
 await page.locator('#tape-stop').click();
});
test('MIDI note, sustain, bend and controller messages affect the instrument',async({page})=>{
 await page.goto('/');await page.evaluate(()=>{window.fakeMidi={id:'fake',name:'Test keyboard'};navigator.requestMIDIAccess=async()=>({inputs:new Map([['fake',window.fakeMidi]])});});
 await page.locator('#midi').click();await expect(page.locator('#midi')).toContainText('●');await page.evaluate(()=>{fakeMidi.onmidimessage({data:[0x90,64,100]});fakeMidi.onmidimessage({data:[0xb0,64,127]});fakeMidi.onmidimessage({data:[0x80,64,0]});});
 expect(await page.evaluate(()=>studio.engine.notes.size)).toBe(1);
 await page.evaluate(()=>{fakeMidi.onmidimessage({data:[0xb0,64,0]});fakeMidi.onmidimessage({data:[0xe0,127,127]});fakeMidi.onmidimessage({data:[0xb0,74,64]});});
 expect(await page.evaluate(()=>studio.engine.notes.size)).toBe(0);expect(await page.evaluate(()=>studio.engine.params.bend)).toBeGreaterThan(1.99);expect(await page.evaluate(()=>studio.engine.params.cutoff)).toBeGreaterThan(500);
});

const jack=(page,id,type)=>page.locator(`[data-jack="${id}"][data-type="${type}"]`);
const midpoint=async locator=>{const b=await locator.boundingBox();return{x:b.x+b.width/2,y:b.y+b.height/2};};

test('a loose cable follows the pointer and highlights only compatible inputs',async({page})=>{
 await page.goto('/');const output=jack(page,'v2sine','output'),input=jack(page,'filter1','input');
 await output.click();await expect(page.locator('.pending-cable')).toBeVisible();
 const start=await page.locator('.pending-cable').getAttribute('d');
 await page.mouse.move(1000,400);
 await expect(page.locator('.pending-cable')).not.toHaveAttribute('d',start);
 const count=await page.locator('.jack.input').count();await expect(page.locator('.jack.input.patch-target')).toHaveCount(count);await expect(page.locator('.jack.output.patch-target')).toHaveCount(0);
 await input.hover();await expect(input).toHaveClass(/patch-hover/);
 await page.screenshot({path:'test-results/patch-preview.png'});
 await input.click();await expect(page.locator('.pending-cable')).toHaveCount(0);await expect(page.locator('.patch-target')).toHaveCount(0);
 expect(await page.evaluate(()=>studio.engine.routes.filter1)).toBe('v2sine');
});

test('dragging works in either direction and replaces only the chosen input',async({page})=>{
 await page.goto('/');
 const drag=async(from,to)=>{const a=await midpoint(from),b=await midpoint(to);await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:12});await page.mouse.up();};
 await drag(jack(page,'v1saw','output'),jack(page,'filter1','input'));
 expect(await page.evaluate(()=>studio.engine.routes.filter1)).toBe('v1saw');
 await drag(jack(page,'v2sine','output'),jack(page,'filter1','input'));
 expect(await page.evaluate(()=>studio.engine.routes.filter1)).toBe('v2sine');
 await drag(jack(page,'filter2','input'),jack(page,'v1pulse','output'));
 expect(await page.evaluate(()=>studio.engine.routes)).toEqual({filter1:'v2sine',filter2:'v1pulse'});
 await expect(page.locator('#cables .cable')).toHaveCount(2);
});

test('cancelling or dropping on an output preserves existing routing and held notes',async({page})=>{
 await page.goto('/');await page.locator('#power').click();await expect(page.locator('#audio-state')).toHaveText('ENGINE RUNNING');await page.keyboard.down('a');await expect.poll(()=>page.evaluate(()=>studio.engine.notes.size)).toBe(1);
 await jack(page,'v1saw','output').click();await page.keyboard.press('Escape');
 await expect(page.locator('.pending-cable')).toHaveCount(0);expect(await page.evaluate(()=>studio.engine.notes.size)).toBe(1);await page.keyboard.up('a');
 const a=await midpoint(jack(page,'v1saw','output')),b=await midpoint(jack(page,'v2sine','output'));
 await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:8});await page.mouse.up();
 expect(await page.evaluate(()=>studio.engine.routes)).toEqual({});await expect(page.locator('.patch-target')).toHaveCount(0);
 await jack(page,'filter1','input').focus();await page.keyboard.press('Enter');await expect(page.locator('.jack.output.patch-target')).not.toHaveCount(0);
 await jack(page,'v2sine','output').focus();await page.keyboard.press('Space');
 expect(await page.evaluate(()=>studio.engine.routes.filter1)).toBe('v2sine');
 // A cancelled drag from an occupied input must keep its existing cable.
 const c=await midpoint(jack(page,'filter1','input'));await page.mouse.move(c.x,c.y);await page.mouse.down();await page.mouse.move(c.x-40,c.y-40,{steps:5});await page.keyboard.press('Escape');await page.mouse.up();
 expect(await page.evaluate(()=>studio.engine.routes.filter1)).toBe('v2sine');
 await jack(page,'v2sine','output').click();await page.locator('#preset').selectOption('Bass · plucked saw');await expect(page.locator('.pending-cable')).toHaveCount(0);
});

test('touch dragging patches without scrolling the page',async({browser,baseURL})=>{
 const context=await browser.newContext({hasTouch:true,isMobile:true,viewport:{width:390,height:900}});const page=await context.newPage();await page.goto(baseURL);
 const output=jack(page,'v1saw','output'),input=jack(page,'v1fm','input');
 // Keep the gesture clear of the intentional 55px edge-scroll zones.
 await input.evaluate(el=>el.scrollIntoView({block:'center',behavior:'instant'}));
 const a=await midpoint(output),b=await midpoint(input),scroll=await page.evaluate(()=>scrollY),cdp=await context.newCDPSession(page);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[a]});
 for(let i=1;i<=8;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:a.x+(b.x-a.x)*i/8,y:a.y+(b.y-a.y)*i/8}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 expect(await page.evaluate(()=>studio.engine.routes.v1fm)).toBe('v1saw');expect(await page.evaluate(()=>scrollY)).toBe(scroll);await context.close();
});

test('expanded patch memory loads parameters, routes and descriptions',async({page})=>{
 await page.goto('/');await expect(page.locator('#preset option')).toHaveCount(64);await expect(page.locator('.empty-tape')).toContainText('No recordings yet.');
 await page.locator('#preset').selectOption('Lead · pulse width');await expect(page.locator('#preset-note')).toContainText('pulse width');
 expect(await page.evaluate(()=>({route:studio.engine.routes.v2pwm,depth:studio.engine.params.v2pwm}))).toEqual({route:'lfo',depth:.65});
 await page.locator('#preset').selectOption('Lead · duophonic');await expect(page.locator('#duo')).toBeChecked();
 expect(await page.evaluate(()=>studio.engine.routes.v2pitch)).toBe('keyboardUpper');
});

test('microphone shortcut highlights every input and supports multiple destinations',async({page})=>{
 await page.goto('/');
 await expect(page.getByRole('button',{name:'Output: Microphone · MIC OUT',exact:true})).toBeVisible();
 await expect(page.locator('#route-source option[value="preamp"]')).toHaveText('Microphone · MIC OUT');
 for(const dest of ['filter1','v2pwm','v1pitch','adsrGate','shClock']){
   await page.locator('#patch-mic').click();
   await expect(page.locator('.jack.input.patch-target')).toHaveCount(await page.locator('.jack.input').count());
   await jack(page,dest,'input').click();
   expect(await page.evaluate(id=>studio.engine.routes[id],dest)).toBe('preamp');
 }
 await expect(page.locator('#cables .cable')).toHaveCount(5);
 await expect(page.locator('#status')).toContainText('Enable Microphone');
 expect(await page.evaluate(()=>studio.engine.micStream)).toBeNull();
});

test('a microphone cable sends actual audio through the VCA and survives disconnection',async({page})=>{
 await page.goto('/');await page.locator('#power').click();
 await page.evaluate(()=>{
   const ctx=studio.engine.ctx,osc=ctx.createOscillator(),gain=ctx.createGain(),stream=ctx.createMediaStreamDestination();
   osc.frequency.value=220;gain.gain.value=.2;osc.connect(gain).connect(stream);osc.start();
   navigator.mediaDevices.getUserMedia=async()=>stream.stream;
   window.testMicrophone={osc,gain,stream};
   studio.engine.set('vcaInitial',1);studio.engine.set('vcaAdsr',0);studio.engine.set('reverb',0);
 });
 await page.locator('#mic-enable').click();await expect(page.locator('#mic-enable')).toHaveText('Disable mic');
 await page.locator('#patch-mic').click();await jack(page,'vcaAudio','input').click();
 await page.waitForTimeout(500);
 expect(await page.evaluate(()=>{const a=new Float32Array(2048);studio.engine.analyser.getFloatTimeDomainData(a);return Math.sqrt(a.reduce((sum,x)=>sum+x*x,0)/a.length);})).toBeGreaterThan(.01);
 await page.locator('#mic-enable').click();await expect(page.locator('#mic-patch-status')).toContainText('Microphone off');
 expect(await page.evaluate(()=>studio.engine.routes.vcaAudio)).toBe('preamp');
 await page.waitForTimeout(600);
 expect(await page.evaluate(()=>{const a=new Float32Array(2048);studio.engine.analyser.getFloatTimeDomainData(a);return Math.max(...a.map(Math.abs));})).toBeLessThan(.001);
});
