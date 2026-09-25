import {midiSelection} from './midi-input.js';
import {download} from './tape.js';

export function setupHardware({app, engine, power, safe, status}) {
  const storageKey = app + '-devices';
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(storageKey) || '{}') || {}; } catch {}
  const preferences = {...midiSelection(saved), microphone:typeof saved.microphone === 'string' ? saved.microphone : '', output:typeof saved.output === 'string' ? saved.output : ''};
  engine.midiFilter = midiSelection(preferences);
  const root = document.createElement('details');
  root.className = 'studio-editor'; root.id = 'hardware-panel';
  root.innerHTML = `<summary>Keyboard, microphone &amp; output</summary>
    <p>Select a keyboard and channel, then play a key or move a wheel. Received messages appear here even when the input filter excludes them. MIDI clock has its own source in Transport.</p>
    <div class="editor-toolbar"><button id="hardware-midi-enable">Connect MIDI</button><label>Keyboard <select id="hardware-midi-input"></select></label><label>Channel <select id="hardware-midi-channel"><option value="0">All channels</option>${Array.from({length:16},(_,i)=>`<option value="${i+1}">${i+1}</option>`).join('')}</select></label><button id="hardware-reset">Clear activity</button></div>
    <p id="hardware-midi-state" role="status">MIDI not connected.</p>
    <div class="hardware-readings"><output id="hardware-midi-count">0 messages</output><output id="hardware-notes">0 held notes</output><output id="hardware-velocity">Velocity —</output><output id="hardware-wheels">Pitch — · Mod — · Sustain —</output></div>
    <ol id="hardware-midi-log" aria-label="Recent MIDI messages"></ol>
    <div class="editor-toolbar"><button id="hardware-refresh">Refresh audio devices</button><label>Microphone <select id="hardware-mic-input"></select></label><button id="hardware-mic-enable">Enable microphone</button><label>Output <select id="hardware-output"></select></label></div>
    <p id="hardware-audio-state" role="status">Audio not started. Microphone permission is requested only when you enable it.</p>
    <div class="hardware-readings"><label>Microphone <meter id="hardware-mic-meter" min="0" max="1" value="0"></meter><output id="hardware-mic-level">No signal yet</output></label></div>
    <p id="hardware-output-note">The browser uses the system output unless a supported device is selected.</p>
    <button id="hardware-export">Export device check</button><p>The report contains device names, capabilities and activity counts. It contains no recordings or device identifiers. Input and output choices stay in this browser, separate from patches.</p>`;
  document.querySelector('#studio-transport').after(root);
  const $ = selector => root.querySelector(selector);
  let devices = [], events = [], count = 0, accepted = 0, noteOns = 0, noteOffs = 0, velocity = null, bend = null, mod = null, sustain = null, micPeak = 0, outputBusy = false, audioRefresh = 0;
  const persist = () => { try { localStorage.setItem(storageKey, JSON.stringify(preferences)); } catch { status('Device choices work for this visit; browser storage is unavailable.', true); } };
  function options(select, entries, selected, empty) {
    select.replaceChildren(new Option(empty, ''));
    for (const item of entries) if (item.id && item.id !== 'default') select.add(new Option(item.name || 'Unnamed device', item.id));
    if (selected && ![...select.options].some(o => o.value === selected)) select.add(new Option('Saved device · unavailable', selected));
    select.value = selected;
  }
  function midiDevices() {
    const inputs = [...(engine.midiAccess?.inputs.values() || [])].filter(p => p.state !== 'disconnected');
    options($('#hardware-midi-input'), inputs, preferences.device, 'All MIDI inputs');
    $('#hardware-midi-channel').value = preferences.channel;
    const missing = preferences.device && !inputs.some(p => p.id === preferences.device);
    $('#hardware-midi-state').textContent = !engine.midiAccess ? 'MIDI not connected.' : missing ? 'Selected keyboard is disconnected. Reconnect it or choose another input.' : inputs.length ? `${inputs.length} input port(s) connected. Play a key to check note delivery.` : 'MIDI enabled. No input ports connected.';
  }
  function readings() {
    $('#hardware-midi-count').textContent = `${count} messages · ${accepted} accepted`;
    $('#hardware-notes').textContent = `${[...engine.notes.keys()].filter(id => String(id).startsWith('midi-')).length} held notes · ${noteOns} on / ${noteOffs} off`;
    $('#hardware-velocity').textContent = 'Velocity ' + (velocity ?? '—');
    $('#hardware-wheels').textContent = `Pitch ${bend ?? '—'} · Mod ${mod ?? '—'} · Sustain ${sustain ?? '—'}`;
    $('#hardware-midi-log').replaceChildren(...events.map(event => { const li = document.createElement('li'); li.textContent = `${event.name} · ${event.channel ? 'Ch ' + event.channel + ' · ' : ''}${event.kind} ${event.text}${event.accepted ? '' : ' · filtered'}`; return li; }));
    const context = engine.ctx, track = engine.micStream?.getAudioTracks()[0];
    $('#hardware-audio-state').textContent = context ? `${context.state} · ${context.sampleRate} Hz · ${context.destination.maxChannelCount} output channels available · ${track ? track.label : 'microphone off'}` : 'Audio not started.';
    $('#hardware-mic-enable').textContent = engine.micPending ? 'Connecting…' : track ? 'Disable microphone' : 'Enable microphone';
    $('#hardware-mic-enable').disabled = !!engine.micPending;
    const level = Number(document.querySelector('#mic-meter')?.value || 0); micPeak = Math.max(micPeak, level);
    $('#hardware-mic-meter').value = level;
    $('#hardware-mic-level').textContent = track ? (level > 0 ? `${(20 * Math.log10(level)).toFixed(1)} dBFS` : 'Listening · no signal') : 'Microphone off';
  }
  async function refreshAudio() {
    const request = ++audioRefresh;
    const available = await navigator.mediaDevices?.enumerateDevices() || [];
    if (request !== audioRefresh) return;
    devices = available;
    const choices = kind => devices.filter(d => d.kind === kind).map(d => ({id:d.deviceId, name:d.label}));
    options($('#hardware-mic-input'), choices('audioinput'), preferences.microphone, 'System default input');
    options($('#hardware-output'), choices('audiooutput'), preferences.output, 'System default output');
    const supportsOutput = typeof globalThis.AudioContext?.prototype.setSinkId === 'function';
    $('#hardware-output').disabled = !supportsOutput || outputBusy;
    $('#hardware-output-note').textContent = supportsOutput ? 'Output choices may require microphone permission before device names are available. Selecting an output changes the monitor device.' : 'This browser cannot select an output here. Choose the output in your operating system sound settings.';
    const original = document.querySelector('#mic-device');
    if (preferences.microphone && ![...original.options].some(o => o.value === preferences.microphone)) original.add(new Option(choices('audioinput').find(d => d.id === preferences.microphone)?.name || 'Saved microphone', preferences.microphone));
    original.value = preferences.microphone;
    readings();
  }
  engine.prepareOutput = async context => {
    if (!preferences.output || !context.setSinkId) return;
    try { await context.setSinkId(preferences.output); }
    catch { status('Saved output is unavailable. Using the system output; choose a device in Keyboard, microphone & output.', true); }
  };
  $('#hardware-midi-enable').onclick = safe(async () => { await engine.midi(); midiDevices(); });
  for (const selector of ['#hardware-midi-input', '#hardware-midi-channel']) $(selector).onchange = () => {
    preferences.device = $('#hardware-midi-input').value; preferences.channel = +$('#hardware-midi-channel').value;
    engine.setMidiFilter(preferences); persist(); readings();
  };
  $('#hardware-reset').onclick = () => { events = []; count = accepted = noteOns = noteOffs = micPeak = 0; velocity = bend = mod = sustain = null; readings(); };
  engine.addEventListener('midimessage', event => {
    const message = event.detail; count++; if (message.accepted) accepted++;
    if (message.kind === 'Note on') { noteOns++; velocity = message.velocity; }
    if (message.kind === 'Note off') noteOffs++;
    if (message.kind === 'Pitch bend') bend = message.value;
    if (message.cc === 1) mod = message.value;
    if (message.cc === 64) sustain = message.value >= 64 ? 'Down' : 'Up';
    if (message.channel !== null) { events.unshift(message); events.length = Math.min(events.length, 8); }
  });
  engine.addEventListener('midistate', midiDevices);
  $('#hardware-refresh').onclick = safe(refreshAudio);
  $('#hardware-mic-input').onchange = () => {
    preferences.microphone = $('#hardware-mic-input').value; persist();
    const original = document.querySelector('#mic-device');
    if (preferences.microphone && ![...original.options].some(o => o.value === preferences.microphone)) original.add(new Option($('#hardware-mic-input').selectedOptions[0].textContent, preferences.microphone));
    original.value = preferences.microphone; original.dispatchEvent(new Event('change', {bubbles:true}));
  };
  document.querySelector('#mic-device').addEventListener('change', event => { preferences.microphone = event.target.value; persist(); void refreshAudio().catch(error => status(error.message, true)); });
  $('#hardware-mic-enable').onclick = () => document.querySelector('#mic').click();
  document.querySelector('#mic').addEventListener('click', () => setTimeout(() => refreshAudio().catch(error => status(error.message, true)), 500));
  navigator.mediaDevices?.addEventListener?.('devicechange', () => { void refreshAudio().catch(error => status(error.message, true)); });
  engine.addEventListener('ready', () => { void refreshAudio().catch(error => status(error.message, true)); });
  $('#hardware-output').onchange = safe(async () => {
    if (outputBusy) return;
    const selected = $('#hardware-output').value; outputBusy = true; $('#hardware-output').disabled = true;
    let wasQuad = false;
    try {
      await power(); if (!engine.ctx.setSinkId) throw new Error('Output selection is unavailable in this browser.');
      wasQuad = engine.quadEnabled; if (wasQuad) engine.setQuad(false);
      await engine.ctx.setSinkId(selected); preferences.output = selected; persist();
      if (wasQuad && engine.ctx.destination.maxChannelCount >= 4) engine.setQuad(true);
      const layout = document.querySelector('#output-layout'); if (layout) layout.value = engine.quadEnabled ? 'quad' : 'stereo';
      engine.dispatchEvent(new Event('outputchange')); status('Monitor output changed.');
    } catch (error) { if (wasQuad && engine.ctx.destination.maxChannelCount >= 4) engine.setQuad(true); $('#hardware-output').value = preferences.output; throw error; }
    finally { outputBusy = false; await refreshAudio(); }
  });
  $('#hardware-export').onclick = () => {
    readings(); const context = engine.ctx, track = engine.micStream?.getAudioTracks()[0], settings = track?.getSettings() || {};
    const report = {app, checkedAt:new Date().toISOString(), audio:context ? {sampleRate:context.sampleRate,state:context.state,maximumOutputChannels:context.destination.maxChannelCount,baseLatency:context.baseLatency,outputLatency:context.outputLatency} : null, microphone:track ? {name:track.label,sampleRate:settings.sampleRate,channelCount:settings.channelCount,peak:micPeak} : null, midi:{inputs:[...(engine.midiAccess?.inputs.values() || [])].map(p=>({name:p.name,state:p.state,connection:p.connection})),channel:preferences.channel||'All',received:count,accepted,noteOns,noteOffs,lastVelocity:velocity,lastPitchBend:bend,lastModulation:mod,lastSustain:sustain}, limits:'Reported browser latency is not measured round-trip latency. MIDI counts establish received messages, not physical timing accuracy.'};
    download(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}),app+'-device-check.json');
  };
  setInterval(() => { if (root.open) readings(); }, 100);
  midiDevices(); void refreshAudio().catch(error => status(error.message, true));
  return {refresh:refreshAudio};
}
