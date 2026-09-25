export function midiSelection(raw) {
  return {
    device: typeof raw?.device === 'string' ? raw.device.slice(0, 300) : '',
    channel: Number.isInteger(raw?.channel) && raw.channel >= 0 && raw.channel <= 16 ? raw.channel : 0,
  };
}

export function describeMidi(data) {
  const [status, a, b] = data;
  if (!Number.isInteger(status) || status < 128 || status > 255) return null;
  if (status >= 240) return {channel: null, kind: ({248:'Clock',250:'Start',251:'Continue',252:'Stop',242:'Song position'})[status] || 'System', text: ''};
  const type = status & 240, channel = (status & 15) + 1;
  if (!Number.isInteger(a) || a < 0 || a > 127 || (![192,208].includes(type) && (!Number.isInteger(b) || b < 0 || b > 127))) return null;
  const note = ['C','Câ™¯','D','Dâ™¯','E','F','Fâ™¯','G','Gâ™¯','A','Aâ™¯','B'][a % 12] + (Math.floor(a / 12) - 1);
  if (type === 144 && b) return {channel, kind:'Note on', text:`${note} Â· velocity ${b}`, note:a, velocity:b};
  if (type === 128 || type === 144) return {channel, kind:'Note off', text:note, note:a};
  if (type === 176) return {channel, kind:'Control', text:`CC ${a} Â· ${b}`, cc:a, value:b};
  if (type === 224) return {channel, kind:'Pitch bend', text:String(((b << 7) | a) - 8192), value:((b << 7) | a) - 8192};
  return {channel, kind:({160:'Key pressure',192:'Program',208:'Pressure'})[type], text:String(a)};
}

export function setMidiSelection(engine, raw) {
  engine.midiFilter = midiSelection(raw);
  for (const owner of [...(engine.pedals || [])]) if (owner.startsWith('midi-')) engine.sustainPedal(false, owner);
  engine.dropNotes(id => String(id).startsWith('midi-'));
  engine.dispatchEvent(new Event('midifilter'));
}

export function bindMidiInputs(engine) {
  const inputs = [...engine.midiAccess.inputs.values()].filter(input => input.state !== 'disconnected');
  for (const input of engine.boundMidi || []) if (!inputs.some(next => next.id === input.id)) {
    input.onmidimessage = null;
    engine.dropNotes(id => String(id).startsWith('midi-' + input.id + '-'));
    for (const owner of [...(engine.pedals || [])]) if (owner.startsWith('midi-' + input.id + '-')) engine.sustainPedal(false, owner);
  }
  engine.boundMidi = inputs;
  for (const input of inputs) input.onmidimessage = ({data, timeStamp}) => {
    const message = describeMidi(data);
    if (!message) return;
    const selection = engine.midiFilter || midiSelection();
    const accepted = message.channel === null || ((!selection.device || selection.device === input.id) && (!selection.channel || selection.channel === message.channel));
    const detail = {device:input.id, name:input.name || 'MIDI input', data:Array.from(data), time:timeStamp ?? performance.now(), accepted, ...message};
    engine.dispatchEvent(new CustomEvent('midimessage', {detail}));
    // Clock sources have their own explicit selection, independent of keyboard filtering.
    if (data[0] >= 240) { engine.dispatchEvent(new CustomEvent('midirealtime', {detail})); return; }
    if (!accepted) return;
    const [status, n, v] = data, type = status & 240, channel = status & 15;
    const owner = `midi-${input.id}-${channel}`, id = `${owner}-${n}`;
    if (type === 144 && v) engine.routeMidiOn ? engine.routeMidiOn(n, v / 127, id, channel) : engine.on(n, v / 127, id, false);
    if (type === 128 || (type === 144 && !v)) engine.routeMidiOff ? engine.routeMidiOff(id) : engine.off(id);
    if (type === 224) engine.set('bend', (((v << 7) | n) - 8192) / 8192 * 2);
    if (type === 176) {
      if (n === 64) engine.sustainPedal(v >= 64, owner);
      if (n === 120 || n === 123) {
        engine.sustainPedal(false, owner);
        engine.dropNotes(key => String(key).startsWith(owner + '-'));
      }
      if (n === 121) { engine.sustainPedal(false, owner); engine.set('bend', 0); engine.set('expression', 0); }
      const useDefault = engine.dispatchEvent(new CustomEvent('midicc', {cancelable:true, detail:{device:input.id,name:input.name,channel,cc:n,value:v}}));
      if (useDefault) {
        if (n === 1 || n === 11) engine.set('expression', v / 127);
        if (n === 7) engine.set('master', v / 127);
      }
      engine.dispatchEvent(new Event('control'));
    }
  };
  engine.dispatchEvent(new CustomEvent('midistate', {detail:inputs.map(input => input.name)}));
}
