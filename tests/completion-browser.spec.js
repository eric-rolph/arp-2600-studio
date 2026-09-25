import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';

test('device panel filters MIDI, shows real message activity, persists selection and exports a report',async({page})=>{
 await page.addInitScript(()=>{window.deviceA={id:'a',name:'Keyboard A',state:'connected'},window.deviceB={id:'b',name:'Keyboard B',state:'connected'};navigator.requestMIDIAccess=async()=>({inputs:new Map([['a',deviceA],['b',deviceB]]),outputs:new Map()});});
 await page.goto('/');await page.locator('#hardware-panel > summary').click();await page.locator('#hardware-midi-enable').click();await expect(page.locator('#hardware-midi-state')).toContainText('2 input');
 await page.locator('#hardware-midi-input').selectOption('a');await page.locator('#hardware-midi-channel').selectOption('2');
 await page.evaluate(()=>{deviceB.onmidimessage({data:[145,67,100]});deviceA.onmidimessage({data:[145,60,91]});deviceA.onmidimessage({data:[225,0,96]});deviceA.onmidimessage({data:[177,1,77]});});
 await expect(page.locator('#hardware-midi-count')).toHaveText('4 messages · 3 accepted');await expect(page.locator('#hardware-velocity')).toContainText('91');await expect(page.locator('#hardware-wheels')).toContainText('4096');await expect(page.locator('#hardware-midi-log')).toContainText('filtered');expect(await page.evaluate(()=>[...studio.engine.notes.values()].map(n=>n.note))).toEqual([60]);
 await page.locator('#hardware-midi-channel').selectOption('3');await expect(page.locator('#hardware-notes')).toContainText('0 held notes');
 const download=page.waitForEvent('download');await page.locator('#hardware-export').click();const report=JSON.parse(await readFile(await(await download).path(),'utf8'));expect(report.midi.received).toBe(4);expect(report.midi.noteOns).toBe(2);expect(JSON.stringify(report)).not.toContain('"deviceId"');
 await page.reload();await page.locator('#hardware-panel > summary').click();await page.locator('#hardware-midi-enable').click();await expect(page.locator('#hardware-midi-input')).toHaveValue('a');await expect(page.locator('#hardware-midi-channel')).toHaveValue('3');
 await page.locator('#hardware-panel').screenshot({path:'test-results/devices-desktop.png'});await page.setViewportSize({width:390,height:900});await page.locator('#hardware-panel').screenshot({path:'test-results/devices-mobile.png'});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('output selection persists successful changes and preserves the prior output after failure',async({page})=>{
 await page.addInitScript(()=>{navigator.mediaDevices.enumerateDevices=async()=>[{kind:'audiooutput',deviceId:'speaker',label:'Test speakers'},{kind:'audiooutput',deviceId:'denied',label:'Unavailable output'}];AudioContext.prototype.setSinkId=async function(id){if(id==='denied')throw new DOMException('Output permission denied','NotAllowedError');Object.defineProperty(this,'sinkId',{value:id,writable:true,configurable:true});};});
 await page.goto('/');await page.locator('#hardware-panel > summary').click();await expect(page.locator('#hardware-output option')).toHaveCount(3);await page.locator('#hardware-output').selectOption('speaker');await expect.poll(()=>page.evaluate(()=>studio.engine.ctx?.sinkId)).toBe('speaker');
 await expect(page.locator('#hardware-output')).toBeEnabled();await page.locator('#hardware-output').selectOption('denied');await expect(page.locator('#status')).toContainText('permission denied');await expect(page.locator('#hardware-output')).toHaveValue('speaker');expect(await page.evaluate(()=>studio.engine.ctx.sinkId)).toBe('speaker');
 await page.reload();await page.locator('#power').click();await expect.poll(()=>page.evaluate(()=>studio.engine.ctx?.sinkId)).toBe('speaker');
});

test('unsupported output selection gives a usable system-settings fallback',async({page})=>{
 await page.addInitScript(()=>{AudioContext.prototype.setSinkId=undefined;});await page.goto('/');await page.locator('#hardware-panel > summary').click();await expect(page.locator('#hardware-output')).toBeDisabled();await expect(page.locator('#hardware-output-note')).toContainText('operating system sound settings');
});

test('documented pitch recordings fit tracking, survive recovery and can be removed',async({page})=>{
 const evidence=[110,220,440,880].map((nominalHz,i)=>({file:`fixture-${i}.wav`,unit:'arp',sha256:String(i+1).padStart(64,'0'),settings:'Synthetic test fixture, not a hardware measurement',method:'Isolated oscillator autocorrelation; one pitch',sampleRate:48000,nominalHz,measuredHz:130.81278265*(nominalHz/130.81278265)**1.003*2**(12/1200)}));
 await page.goto('/');await expect(page.locator('#recovery-status')).toContainText('ready');await page.locator('#calibration-panel > summary').click();await page.locator('#calibration-unit').selectOption('arp');await page.locator('#calibration-file').setInputFiles({name:'measurement-fixture.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({version:1,name:'Tracking fixture',units:{},evidence}))});
 await expect(page.locator('#calibration-evidence li')).toHaveCount(4);await page.locator('#calibration-fit').click();await expect(page.locator('#calibration-fit-result')).toContainText('Stored');expect(await page.evaluate(()=>studio.engine.state.calibration.units.arp.tracking)).toBeCloseTo(1.003,8);expect(await page.evaluate(()=>studio.engine.state.calibration.units.arp.cents)).toBeCloseTo(12,6);
 await page.locator('#recovery-save').click();await expect(page.locator('#recovery-status')).toContainText('saved locally');await page.reload();await expect(page.locator('#recovery-status')).toContainText('Recovered');await page.locator('#calibration-panel > summary').click();await page.locator('#calibration-unit').selectOption('arp');await expect(page.locator('#calibration-evidence li')).toHaveCount(4);await page.getByRole('button',{name:'Remove measurement fixture-0.wav'}).click();await expect(page.locator('#calibration-evidence li')).toHaveCount(3);
});

test('clearing recovery cancels queued saves and a late completion cannot lose audio on the next save',async({page})=>{
 await page.goto('/');await expect(page.locator('#recovery-status')).toContainText('ready');await page.locator('#power').click();
 await page.evaluate(async()=>{const {engine:e,tape:t}=studio,b=e.ctx.createBuffer(1,4800,48000);b.getChannelData(0).fill(.2);t.takes=[{id:'clear-test',name:'Keep open',wet:b,dry:null,wetGain:1,dryGain:0,offset:0,rate:1}];const store=e.recovery.store,checkpoint=store.checkpoint.bind(store);store.checkpoint=async(...args)=>{await checkpoint(...args);await new Promise(resolve=>window.releaseOldSave=resolve);};window.pendingSave=e.recovery.save();window.restoreCheckpoint=()=>store.checkpoint=checkpoint;});
 await expect.poll(()=>page.evaluate(()=>!!window.releaseOldSave)).toBe(true);page.once('dialog',dialog=>dialog.accept());await page.locator('#recovery-clear').click();await expect(page.locator('#recovery-status')).toContainText('cleared');await page.evaluate(async()=>{releaseOldSave();await pendingSave;restoreCheckpoint();});expect(await page.evaluate(async()=>!!(await studio.engine.recovery.store.read()).state)).toBe(false);
 await page.locator('#recovery-save').click();await expect(page.locator('#recovery-status')).toContainText('saved locally');page.once('dialog',dialog=>dialog.accept());await page.reload();await expect(page.locator('.take')).toHaveCount(1);expect(await page.evaluate(()=>studio.tape.takes[0].wet.length)).toBe(4800);
 await page.evaluate(()=>{const e=studio.engine;e.set(e.params.cutoff===undefined?'moog.cutoff':'cutoff',1000);});page.once('dialog',dialog=>dialog.accept());await page.locator('#recovery-clear').click();await expect(page.locator('#recovery-status')).toContainText('cleared');await page.waitForTimeout(400);expect(await page.evaluate(async()=>!!(await studio.engine.recovery.store.read()).state)).toBe(false);
});

test('a failed recovery write can be retried without discarding the open session',async({page})=>{
 await page.goto('/');await expect(page.locator('#recovery-status')).toContainText('ready');await page.evaluate(()=>{const store=studio.engine.recovery.store;window.restoreRecoveryWrite=store.checkpoint.bind(store);store.checkpoint=async()=>{throw new DOMException('Storage full','QuotaExceededError');};studio.engine.set(studio.engine.params.cutoff===undefined?'moog.cutoff':'cutoff',876);});
 await page.locator('#recovery-save').click();await expect(page.locator('#recovery-status')).toContainText('paused');await expect(page.locator('#recovery-retry')).toBeVisible();await page.evaluate(()=>studio.engine.recovery.store.checkpoint=restoreRecoveryWrite);await page.locator('#recovery-retry').click();await expect(page.locator('#recovery-status')).toContainText('saved locally');await expect(page.locator('#recovery-retry')).toBeHidden();await page.reload();await expect(page.locator('#recovery-status')).toContainText('Recovered');expect(await page.evaluate(()=>studio.engine.params.cutoff??studio.engine.params['moog.cutoff'])).toBe(876);
});

test('Stop during tape preparation leaves playback stopped after buffers become ready',async({page})=>{
 await page.goto('/');await page.locator('#power').click();await page.evaluate(()=>{const {engine:e,tape:t}=studio,b=e.ctx.createBuffer(1,48000,48000);b.getChannelData(0).fill(.2);t.takes=[{id:'pending',wet:b,wetGain:1,dryGain:0,offset:0,rate:1}];t.changed();const prepare=t.prepare.bind(t);t.prepare=async()=>{await prepare();await new Promise(resolve=>window.releaseTape=resolve);};});
 await page.locator('#tape-play').click();await expect.poll(()=>page.evaluate(()=>!!window.releaseTape)).toBe(true);await page.locator('#tape-stop').click();await page.evaluate(()=>releaseTape());await page.waitForTimeout(200);await expect(page.locator('#tape-status')).toHaveText('STOPPED');expect(await page.evaluate(()=>studio.tape.playing)).toBe(false);
});

test('Stop cancels tape buttons while audio startup is pending',async({page})=>{
 await page.goto('/');await page.locator('#power').click();
 for(const button of ['#record','#tape-play']){
  await page.evaluate(()=>{window.originalStart=studio.engine.start;studio.engine.start=()=>new Promise(resolve=>window.resumeStart=resolve);});
  await page.locator(button).click();await expect.poll(()=>page.evaluate(()=>typeof window.resumeStart)).toBe('function');await page.locator('#tape-stop').click();
  await page.evaluate(()=>{studio.engine.start=window.originalStart;window.resumeStart();delete window.resumeStart;});
  await expect.poll(()=>page.evaluate(()=>[studio.tape.recording,studio.tape.playing])).toEqual([false,false]);
 }
});
