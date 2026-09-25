# 2600 Studio audit — September 25, 2026

## Repairs

- Unheld note-off messages are ignored. Removing a MIDI input releases its own notes and pedal state, while preserving other inputs. Losing browser focus clears local keys without silencing a connected MIDI keyboard. Panic also cancels pending local key starts.
- A keyboard pitch change no longer retriggers an ADSR or AR envelope driven by an external clock, microphone envelope or other patched gate.
- Suspending audio waits for the recording worklet to flush its final samples. A muted long layer no longer prevents tape transport from finishing. Concurrent imports recheck the eight-take limit and reserve an active recording's slot.
- Zero tape saturation now has a linear transfer curve. Tape filtering and resampling still apply.
- The output meter reads the post-master analyser, including tape playback. Output and microphone traces use equal time windows; stopped meters clear.
- ARP DC rejection and spring damping are normalized for sample rate. Repeated DSP coefficients are cached and the output sample buffer is reused.

Live audio requests a 48 kHz context. Oscillator/filter oversampling remains 2× internally; the browser handles conversion to the output device. The standalone DSP is also tested at 44.1 and 96 kHz.

## Save and reopen recordings

**Save session** finishes an active take and downloads a `.synthsession` file with the patch, tape settings and full-resolution float32 synth/voice samples. **Open session** restores it in 2600 Studio. Opening asks before replacing current recordings. Controls are keyboard accessible.

Patch JSON still contains controls and routes only. WAV export remains 16-bit PCM for playback in other software. Session files preserve exact internal float samples and their individual rates. They are local files; no audio is uploaded. Sessions from TONTO must be opened in TONTO.

The loader validates dimensions, duration, byte lengths, studio/version and finite samples before replacing existing data. Limits: eight takes, three minutes per buffer, mono/stereo, 8–192 kHz, 1 GB per session. Large files need sufficient browser memory. There is no automatic recording backup: save before closing or reloading.

## Verification and boundaries

`npm run check`: 20 Node tests. `npm run test:browser`: 17 Chromium tests. GitHub Actions now runs both suites before deploying, with an isolated browser-test server on port 8788.

Coverage includes oscillator pitch, envelopes, filter attenuation, feedback, all 21 factory presets, WAV headers, three sample rates, MIDI note priority/disconnection/sustain, fake microphone processing and permission denial, mouse/touch/keyboard patching, recording/suspend/playback, tape-aware meters, session save/reload with exact stereo and voice samples, malformed-session rejection and mobile layout.

The shared audit found and repaired two additional problems in TONTO's ARP wrapper: collapsed stereo and incorrect duophonic pitches. These do not change the standalone 2600's existing duo architecture.

The tests use synthetic microphone and MIDI inputs. The user's physical audio/MIDI hardware, Safari/Firefox, maximum-length recording stress and analog hardware calibration were not tested. These repairs do not establish waveform equivalence to a physical ARP 2600. Spring/tape/filter behavior remains an approximation, and tape loops can have a short transport gap.
