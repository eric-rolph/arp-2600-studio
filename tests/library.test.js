import test from 'node:test';
import assert from 'node:assert/strict';
import {arpLibrary,normal,sources} from '../public/model.js';
import {renderPreview} from '../public/preset-preview-render.js';
test('ARP library contains 64 distinct memories with named destinations and complete notes',()=>{assert.equal(arpLibrary.length,64);assert.equal(new Set(arpLibrary.map(e=>e.id)).size,64);assert.equal(new Set(arpLibrary.map(e=>JSON.stringify(e.patch))).size,64);for(const e of arpLibrary){assert.ok(e.description&&e.play);for(const [d,s]of Object.entries(e.patch.routes)){assert.ok(Object.hasOwn(normal,d),e.name+' '+d);assert.ok(sources.some(([id])=>id===s),e.name+' '+s);}}});
test('all 64 previews produce finite bounded audio including synthesized microphone input',()=>{for(const e of arpLibrary){const r=renderPreview(e);assert.ok(Number.isFinite(r.rms)&&r.peak<=1,e.name);assert.ok(r.rms>.0005,e.name+' audible '+r.rms);assert.equal(Math.abs(r.left[0]),0);assert.ok(Math.abs(r.left.at(-1))<.002);}});
