# Session, performance and audio update

## Recovery

Patches, shared phrases, cabinet clips and chains, calibration profiles, tape settings, trims, fades and recordings are recovered automatically on this browser and origin. Recovery does not start audio, reopen a microphone or restart a sequence. Completed takes are stored once; unfinished recordings write an incremental audio journal. A renderer-crash test verifies recovery of the journal.

Patch edits save after a short pause; an active performance capture saves about once a second. A crash can lose edits or audio still waiting for a storage transaction. The most recent completed checkpoint and journal remain available. Only one open tab writes recovery for a studio; additional tabs explicitly show read-only recovery. Close the owner and reload another tab to transfer ownership. Keep storage requests persistent browser storage. Save session remains the portable file backup. Storage/quota failures are shown rather than silently deleting an older checkpoint.

## Play together

Transport **Play together** starts enabled cabinet parts (or the shared phrase when no part is enabled), the voltage sequencer and loaded tape on the same AudioContext frame. The tape worklet acknowledges its audio buffers before a start is scheduled. Continue resumes the transport position; Stop together releases sequenced notes and restores static parameter values. Tape and voltage sequence participation are selectable. Explicit external sequencer clock cables retain their authority.

Internal tempo can change during this transport. Tape follows tempo through varispeed, so its pitch changes as well. Choose a bar length in the Tape loop control for a musical loop region; unused space in that region is intentional silence. At Take length, the loop repeats its audio duration. Loop scheduling occurs in the audio worklet, without a main-thread end/restart gap. This does not automatically remove a discontinuity in the recording itself; use fades or a suitable edit point.

MIDI clock input and output are opt-in. Clock uses 24 pulses per quarter note, Start, Continue, Stop, and six-clock song-position units. Input tempo is filtered and phase correction is gradual; a 1.5-second loss of incoming clock stops the transport. Output messages use browser timestamps and an audio/output time mapping. This establishes the software schedule, not a measurement of USB, driver or physical MIDI jitter. MIDI clock input supports 35–220 BPM. Choose Internal to return to the local clock.

The individual Notes & motion buttons remain available for recording or auditioning a selected phrase. They stop the shared transport, use their own count-in, and hold tempo for that capture/playback run. The metronome remains monitor-only.

## Parts, clips and editing

Each of Moog, Buchla, ARP, EMS and Eurorack can have an independent part with a MIDI channel, mute/solo, up to 16 clips and a 32-slot repeating chain. The standalone 2600 has one part. A clip holds 1, 2, 4 or 8 bars. Cabinets retain their existing mono/duo behavior: multiple recorded notes do not turn each cabinet into a polyphonic synth.

Choose a part in Edit / play, enable it, set its channel and raise that cabinet's audio fader. The on-screen/computer keyboard and Notes & motion editor target that part. Shared keyboard keeps a separate phrase. Explicit pitch and gate cables override the part's normal connections. EMS independent notes replace its default sequencer pitch/gate matrix feeds; custom matrix sources and explicit cables remain in charge.

New clip, Duplicate, Delete clip and the editable chain list manage the bank. Recording replaces a clip unless Overdub is enabled; overdub plays the existing phrase and adds a pass. Undo can restore an earlier edit. Part automation is restricted to controls in that cabinet; the shared phrase supports the wider control surface. Master, tempo and mains are not automation lanes. Per-clip limits remain 512 notes, 32 lanes, 2,048 points per lane and 12,000 total points.

In Clip editor, double-click adds a note, dragging moves it, and its right edge or Shift-drag changes length. Arrow keys move selected notes; Shift-arrow changes length; Delete removes. Numeric note fields remain available in Notes & motion. Automation supports step, linear and smooth segments, draggable points and numeric point values. Linear/smooth values interpolate in parameter units before the instrument's parameter smoothing.

MIDI file import accepts SMF type 0/1 musical-tick files, notes, velocities, track names, channels and initial tempo. Long tracks become eight-bar clips; overflowing clip/note capacity rejects the import without changing the session. Imported clips retain each track's channel assignment; multiple tracks assigned to one cabinet are stored as separate clips. Mid-file tempo maps, controller events, program changes and SMPTE timing are not imported. Export writes type 1 notes at 960 ticks per quarter note, with one track per enabled cabinet and the selected clip/chain. Synth-control automation remains in Studio patch/session files rather than MIDI CCs.

## Tape and file formats

Take edits are nondestructive: trim in/out, fade in/out, gain, mute, offset, speed and reverse affect playback and the mixed export. Fades use source-time seconds and follow tape speed. Stem downloads retain original untrimmed audio. There are at most eight takes of three minutes each; mixed renders are capped at twelve minutes. The source recordings remain float audio in recovery and session files.

Mixed WAV and stem exports offer 16-bit PCM, 24-bit PCM (default), or 32-bit IEEE float. Optional TPDF dither applies only to PCM; float preserves samples beyond full scale instead of integer clipping. A render worker keeps export off the UI thread. Higher bit depth preserves numerical precision; it does not establish hardware fidelity.

## Processors and output

TONTO's Spectral studio adds a signed frequency shifter and six-stage phaser, with patchable inputs and outputs and monitor selections. The shifter uses a 127-tap windowed Hilbert pair with a matched 63-sample delay. It translates frequencies in hertz. Opposite-sideband rejection is tested at ±200 Hz shifts of a 1 kHz tone, not claimed uniformly across the audio band. The phaser uses six all-pass stages, modulated frequency, feedback and wet/dry mix.

Each audio cabinet has a Rear control. Quad monitoring sends front L/R and rear L/R to output channels 1–4 and requires the selected browser output to expose four channels. Stereo monitoring uses the cabinet stereo mixes independent of Rear position. The live scope in quad mode shows the synth's stereo mix; tape playback and click remain in the front pair. Tape recording/export remains stereo. The channel-identification WAV uses an explicit four-channel WAVEFORMATEXTENSIBLE mask. A two-channel device refuses quad selection and keeps stereo active.

## Calibration and what is still unverified

Calibration profiles apply oscillator offset/tracking, filter cutoff/resonance and envelope time multipliers, plus tape bandwidth, drive, bias, wow rate and flutter rate. Nominal profiles are neutral and disabled. Import/export and session recovery preserve profiles. Isolated-tone measurement uses autocorrelation near a documented nominal frequency and stores a file SHA-256, hardware/settings notes and measurement result. That measurement establishes tuning at one pitch only. It cannot establish an oscillator spectrum, filter response, envelope curve or tape transfer function.

For a hardware comparison, record the instrument revision, warm-up time, waveform, note, control settings, gate duration, gain staging, interface and native file sample rate. Use unprocessed WAVs. Measure oscillator pitch at several octaves and pulse widths; filter responses at several cutoff/resonance/drive levels; envelope rise/decay/release at several settings; and tape speed, noise, frequency response and modulation over sustained tones. Use Reference lab's local waveform/spectrum/envelope comparison for matched model renders. Keep the original recording and exported report beside the profile. No undocumented commercial sample or artist patch is treated as circuit calibration.

Near-identical analog recreation remains **unverified**. Circuit topology, nonlinear behavior, component variation, vactrol memory, spring dispersion and tape hysteresis remain approximations. The existing Easel percussion fit is still a single-recording approximation, not a hardware model certification.

## Validation — September 25, 2026

- Both apps completed real-time 180-second capture stress tests at 48 kHz: 8,640,000 frames, finite nonzero audio, recovery after reload, eight-take capacity and 69,177,656-byte 32-bit float mixed exports. Observed recording wall time was approximately 180.2 seconds. This tests a full-length take plus seven short layers, not eight simultaneous three-minute recordings.
- Automated tests cover renderer crashes, tab ownership, tape loop boundaries, six-hour mathematical clock continuity, MIDI messages/timestamps, MIDI files, part isolation, clip chains, overdub, dragged notes, calibration persistence, processor spectra, quad channel math and 2600 performance/MIDI-learn/history parity. Microphone and MIDI behavior in these tests uses synthetic inputs.
- Windows reports a Keystation 49 MK3, RØDE NT-USB Mini and ADAM D3V. A separate browser check reported 48 kHz audio, two output channels, 10 ms base latency and 42 ms output latency. Those are browser-reported values, not a measured round-trip. After granting the Chromium test context its MIDI permissions, the browser opened both Keystation input ports and enumerated both output ports. The app still requests sysex:false and sent no hardware MIDI messages during this check. Physical key presses, microphone response, MIDI jitter and quad speaker routing are not certified.
- `npm run check` runs syntax/DSP/model tests; `npm run test:browser` runs normal browser regressions; `npm run test:stress` runs the three-minute recording test separately. The release workflow runs normal checks before deployment. Full-length stress tests are manual to avoid repeating recording allocations on every push.

Still outside this update: cloud collaboration, arbitrary module loading, per-cabinet polyphonic voice allocation, freeform multitrack audio arrangement, tempo-map MIDI import and physical analog-model verification.

Protocol references: [MIDI Association SMF specification](https://midi.org/standard-midi-files-specification), [MIDI messages](https://midi.org/about-midi-part-3midi-messages), [Web Audio output timestamps](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/getOutputTimestamp).
