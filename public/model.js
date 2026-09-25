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
 'Droid · voice + circuit': {params:{v1coarse:12,v1level:.08,v2level:.12,v2coarse:12,ringLevel:.75,micLevel:.3,preamp:2.5,efGain:2.2,filterEnv:3,cutoff:1800,resonance:.32,vcaAdsr:.95,filterFM:.08,vibrato:.05,reverb:.12},routes:{ringA:'preamp',ringB:'v2sine',filterEnv:'ef',vcaCV:'ef'}},
 'Droid · questioning chirp': {params:{v1level:0,v2level:.8,v2coarse:24,v2fm:1.7,attack:.004,decay:.18,sustain:0,release:.08,filterEnv:3,cutoff:1800,resonance:.6,reverb:.25},routes:{filter2:'v2sine'}},
 'Droid · sample & chatter': {params:{v1level:.6,v1coarse:12,v1fm:1.8,v2level:.18,v2coarse:24,clock:13,cutoff:2800,resonance:.35,attack:.002,decay:.1,sustain:.7,release:.06},routes:{}},
 'Warm · three oscillators': {params:{v1level:.45,v2level:.32,v3level:.25,v3coarse:0,v2fine:7,v3fine:-8,cutoff:950,filterEnv:2.4,attack:.35,release:1.8,reverb:.3},routes:{filter2:'v2saw'}},
 'Metal · ring percussion': {params:{v1level:0,v2level:0,ringLevel:.9,v1coarse:-7,v2coarse:13,attack:.001,decay:.5,sustain:0,release:.15,cutoff:5000,filterEnv:0,reverb:.25},routes:{}},
 'Voice · filter follower': {params:{v1level:0,v2level:0,micLevel:1,preamp:2,efGain:2,vcaAdsr:1,cutoff:350,filterEnv:4,resonance:.6,reverb:.15},routes:{filterEnv:'ef',vcaCV:'ef'}},
};
