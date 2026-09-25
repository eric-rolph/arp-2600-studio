// Signals use normalized audio ±1 and control voltages in volts (1 V/octave).
export const defaults = {
  v1coarse:0,v1fine:0,v1level:.65,v1fm:0,v1lf:0,v1pw:.5,
  v2coarse:0,v2fine:3,v2level:.28,v2fm:0,v2lf:0,v2pw:.5,v2pwm:0,
  v3coarse:-12,v3fine:-3,v3level:0,v3fm:0,v3lf:0,v3pw:.5,
  cutoff:2200,resonance:.18,filterEnv:2,filterFM:0,filterKey:1,drive:.15,
  noiseLevel:0,noiseColor:.5,ringLevel:0,ringX:1,ringY:1,ringAC:1,
  attack:.012,decay:.28,sustain:.65,release:.32,arAttack:.015,arRelease:.25,
  vcaInitial:0,vcaAdsr:1,vcaAr:0,vcaRing:0,
  preamp:1,efGain:1,efAttack:.008,efRelease:.12,micLevel:0,
  clock:6,shLevel:1,lag:.08,procA:1,procB:0,offset:0,
  reverb:.18,reverbTime:.55,pan:0,master:.6,
  glide:0,vibrato:0,vibratoRate:5.5,bend:0,mod:0,octave:0,duo:0,
};
export const sources = [
 ['v1saw','VCO 1 · saw'],['v1pulse','VCO 1 · pulse'],
 ['v2saw','VCO 2 · saw'],['v2pulse','VCO 2 · pulse'],['v2sine','VCO 2 · sine'],['v2tri','VCO 2 · triangle'],
 ['v3saw','VCO 3 · saw'],['v3pulse','VCO 3 · pulse'],
 ['noise','Noise'],['preamp','Preamp'],['ef','Envelope follower'],['ring','Ring modulator'],
 ['vcf','Filter'],['vca','Amplifier'],['adsr','ADSR'],['ar','AR'],['sh','Sample & hold'],
 ['clock','Clock'],['switch','Electronic switch'],['processor','Voltage processor'],['lag','Lag'],
 ['keyboard','Keyboard CV / lower'],['keyboardUpper','Keyboard upper CV'],['gate','Keyboard gate'],['lfo','Keyboard LFO']
];
export const destinations = [
 ['v1pitch','VCO 1 · keyboard','keyboard'],['v1fm','VCO 1 · FM','sh'],
 ['v2pitch','VCO 2 · keyboard','keyboard'],['v2fm','VCO 2 · FM','adsr'],['v2pwm','VCO 2 · pulse width','noise'],
 ['v3pitch','VCO 3 · keyboard','keyboard'],['v3fm','VCO 3 · FM','adsr'],
 ['ringA','Ring · input A','v1saw'],['ringB','Ring · input B','v2sine'],
 ['efInput','Follower · input','preamp'],
 ['filter1','Filter · VCO 1','v1saw'],['filter2','Filter · VCO 2','v2pulse'],['filter3','Filter · VCO 3','v3saw'],
 ['filterNoise','Filter · noise','noise'],['filterRing','Filter · ring','ring'],['filterMic','Filter · preamp','preamp'],
 ['filterPitch','Filter · keyboard CV','keyboard'],['filterEnv','Filter · envelope CV','adsr'],['filterFM','Filter · FM','v2sine'],
 ['vcaAudio','VCA · audio','vcf'],['vcaRing','VCA · ring audio','ring'],['vcaCV','VCA · envelope CV','adsr'],['vcaAR','VCA · AR CV','ar'],
 ['adsrGate','ADSR · gate','gate'],['arGate','AR · gate','gate'],
 ['shInput','S&H · signal','noise'],['shClock','S&H · trigger','clock'],
 ['switchA','Switch · A','v1saw'],['switchB','Switch · B','v2sine'],
 ['procA','Processor · A','keyboard'],['procB','Processor · B','ef'],['lagInput','Lag · input','processor']
];
export const normal = Object.fromEntries(destinations.map(([id,,src])=>[id,src]));
export const presets = {
 'Init · classic lead': {params:{},routes:{}},
 'Droid · voice + circuit': {params:{v1coarse:12,v1level:.08,v2level:.12,v2coarse:12,ringLevel:.75,micLevel:.3,preamp:6,efGain:3.5,filterEnv:3,cutoff:1800,resonance:.32,vcaAdsr:.95,filterFM:.08,vibrato:.05,reverb:.12},routes:{ringA:'preamp',ringB:'v2sine',filterEnv:'ef',vcaCV:'ef'}},
 'Droid · questioning chirp': {params:{v1level:0,v2level:.8,v2coarse:24,v2fm:1.7,attack:.004,decay:.18,sustain:0,release:.08,filterEnv:3,cutoff:1800,resonance:.6,reverb:.25},routes:{filter2:'v2sine'}},
 'Droid · sample & chatter': {params:{v1level:.6,v1coarse:12,v1fm:1.8,v2level:.18,v2coarse:24,clock:13,cutoff:2800,resonance:.35,attack:.002,decay:.1,sustain:.7,release:.06},routes:{}},
 'Warm · three oscillators': {params:{v1level:.45,v2level:.32,v3level:.25,v3coarse:0,v2fine:7,v3fine:-8,cutoff:950,filterEnv:2.4,attack:.35,release:1.8,reverb:.3},routes:{filter2:'v2saw'}},
 'Metal · ring percussion': {params:{v1level:0,v2level:0,ringLevel:.9,v1coarse:-7,v2coarse:13,attack:.001,decay:.5,sustain:0,release:.15,cutoff:5000,filterEnv:0,reverb:.25},routes:{}},
 'Voice · filter follower': {params:{v1level:0,v2level:0,micLevel:1,preamp:4,efGain:4,vcaAdsr:1,cutoff:350,filterEnv:4,resonance:.6,reverb:.15},routes:{filterEnv:'ef',vcaCV:'ef'}},
 'Bass · plucked saw': {
   params:{v1coarse:-12,v1level:.8,v2level:0,cutoff:130,filterEnv:3.5,resonance:.3,attack:.002,decay:.22,sustain:.12,release:.1,reverb:.04},routes:{}
 },
 'Bass · sine sub': {
   params:{v1level:0,v2level:.85,v2coarse:-24,v2fine:0,cutoff:1400,filterEnv:0,resonance:0,attack:.008,decay:.15,sustain:.85,release:.12,reverb:0},routes:{filter2:'v2sine'}
 },
 'Bass · resonant pulse': {
   params:{v1level:.65,v1coarse:-12,v1pw:.3,v2level:0,cutoff:110,resonance:.72,filterEnv:4,attack:.002,decay:.18,sustain:.15,release:.07,drive:.3,reverb:0},routes:{filter1:'v1pulse'}
 },
 'Lead · pulse width': {
   params:{v1level:0,v2level:.75,v2pw:.35,v2pwm:.65,cutoff:2600,resonance:.2,filterEnv:1,attack:.012,decay:.2,sustain:.7,release:.25,reverb:.18},routes:{v2pwm:'lfo'}
 },
 'Lead · portamento': {
   params:{v1level:.65,v2level:.3,v2coarse:-12,v2fine:0,glide:.12,cutoff:1800,resonance:.28,filterEnv:1.5,attack:.015,decay:.25,sustain:.75,release:.18,reverb:.12},routes:{filter2:'v2sine'}
 },
 'Lead · duophonic': {
   params:{duo:1,v1level:.4,v2level:.45,v2fine:0,cutoff:2300,filterEnv:1,attack:.015,release:.3,reverb:.2},routes:{v2pitch:'keyboardUpper',filter2:'v2saw'}
 },
 'Keys · pluck': {
   params:{v1level:.35,v2level:.45,v2coarse:12,v2fine:0,cutoff:400,filterEnv:3,attack:.002,decay:.4,sustain:0,release:.2,reverb:.25},routes:{filter2:'v2tri'}
 },
 'Keys · electric piano': {
   params:{v1level:0,v2level:.65,v2fine:0,ringLevel:.18,v1coarse:12,cutoff:1800,filterEnv:1.5,resonance:.1,attack:.003,decay:1.4,sustain:.08,release:.35,reverb:.22},routes:{filter2:'v2sine',ringA:'v2sine',ringB:'v1pulse'}
 },
 'Pad · slow strings': {
   params:{v1level:.35,v2level:.3,v3level:.25,v3coarse:0,v2fine:8,v3fine:-8,cutoff:600,filterEnv:2,attack:1.2,decay:.8,sustain:.7,release:2.8,reverb:.4,reverbTime:.8},routes:{filter2:'v2saw'}
 },
 'Percussion · kick': {
   params:{v1level:0,v2level:.9,v2coarse:-24,v2fine:0,v2fm:.08,cutoff:1400,filterEnv:0,resonance:0,attack:.001,decay:.15,sustain:0,release:.08,reverb:0,drive:.25},routes:{filter2:'v2sine'}
 },
 'Percussion · snare': {
   params:{v1level:0,v2level:.18,v2coarse:-12,v2fine:0,noiseLevel:.8,noiseColor:.08,cutoff:3400,filterEnv:0,filterKey:0,attack:.001,decay:.12,sustain:0,release:.06,reverb:.08},routes:{filter2:'v2sine'}
 },
 'Percussion · hi-hat': {
   params:{v1level:0,v2level:0,noiseLevel:.8,noiseColor:0,cutoff:15000,filterEnv:0,filterKey:0,attack:.001,decay:.035,sustain:0,release:.025,reverb:.025},routes:{}
 },
 'Modulation · random filter': {
   params:{v1level:.55,v2level:.2,clock:8,cutoff:1000,filterEnv:0,filterFM:2,resonance:.68,attack:.02,sustain:.8,release:.25,reverb:.18},routes:{filterFM:'sh'}
 },
 'Modulation · siren': {
   params:{v1level:0,v2level:.75,v2fine:0,v2coarse:12,v2fm:.5,vibratoRate:.65,cutoff:5000,filterEnv:0,attack:.1,sustain:1,release:.25,reverb:.2},routes:{v2fm:'lfo',filter2:'v2sine'}
 },
};

// These are starting sounds built for this model, not transcriptions of factory patches.
export const presetNotes = {
 'Init · classic lead':'Saw and pulse oscillators through the filter. Play a note to hear the unpatched signal path.',
 'Droid · voice + circuit':'Requires a microphone. Your voice drives the ring modulator and controls the filter and amplifier.',
 'Droid · questioning chirp':'A short sine-wave note with an envelope-driven pitch sweep.',
 'Droid · sample & chatter':'Hold a key for stepped, random pitch changes from sample-and-hold.',
 'Warm · three oscillators':'Three detuned saws with a slow attack and release. Hold a note for a sustained sound.',
 'Metal · ring percussion':'Two oscillators feed the ring modulator. Each key triggers a decaying metallic tone.',
 'Voice · filter follower':'Requires a microphone. Voice level controls the filter cutoff and amplifier.',
 'Bass · plucked saw':'A low saw with a short filter sweep. Try C3 through C4.',
 'Bass · sine sub':'A sine oscillator two octaves below the keyboard. Raise its frequency for smaller speakers.',
 'Bass · resonant pulse':'A narrow pulse and a resonant filter sweep with a short decay.',
 'Lead · pulse width':'The keyboard LFO varies VCO 2 pulse width. Hold a note to hear the change.',
 'Lead · portamento':'A saw lead with a sine one octave below. Hold one key while pressing another to hear the glide.',
 'Lead · duophonic':'Hold two keys. VCO 1 follows the lower note and VCO 2 follows the upper note.',
 'Keys · pluck':'Saw and triangle oscillators with a short filter envelope and no sustain.',
 'Keys · electric piano':'A sine tone with a quieter ring-modulated attack and a long decay.',
 'Pad · slow strings':'Three detuned saws with a 1.2-second attack. Hold a key to let the sound build.',
 'Percussion · kick':'A low sine with a brief downward pitch sweep. Play C4 for the starting drum pitch.',
 'Percussion · snare':'White noise and a low sine with a short decay.',
 'Percussion · hi-hat':'A short white-noise burst. The filter is open and keyboard tracking is off.',
 'Modulation · random filter':'Sample-and-hold changes the cutoff eight times per second. Hold a note.',
 'Modulation · siren':'A slow LFO sweeps the sine oscillator pitch. Hold a note.',
};
