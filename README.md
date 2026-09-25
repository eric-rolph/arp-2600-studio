# 2600 Studio

A playable ARP 2600-inspired semi-modular browser instrument and voice/tape studio.

**Live:** https://arp-2600-studio.ericrolph.workers.dev

## Play

1. Open the site in current Chrome or Edge and press **Power on**.
2. Play the four-octave keyboard with touch/mouse or computer keys `A W S E D F T G Y H U J K`. `Z/X` shift octaves. MIDI supports note on/off, velocity, ±2-semitone pitch bend, modulation, sustain, and CC 7/71/72/73/74.
3. Select **Droid · voice + circuit**, put on headphones, and enable **Microphone**. Speak and play together. Vocal dynamics control the filter and VCA; the voice is multiplied by VCO 2's sine wave in the ring modulator.
4. Click an output jack and then an input jack to replace its internal connection. Click a connected input to restore its normal. **Show signal path** provides the equivalent accessible routing form. Output fan-out is allowed. Input ports accept one cable.
5. **Record** preserves stereo synth and a separate mono preamplified voice stem. **Stop** keeps the take. Existing takes can play while recording another pass; the previous take is not destructively baked into the new recording.
6. Tape speed links pitch and duration. Levels, speed, saturation, wow and flutter update during playback without restarting it. Reverse and start-offset changes restart transport. Each layer has an independent speed, offset, reverse and mute. Export a stereo WAV mix or original stems before closing the page.

The keyboard starts monophonic with last-note priority. **DUO** splits lower/upper held notes across oscillator pitches while retaining shared envelopes. **Gate** is a manual envelope trigger. Touch allows multiple fingers. **Panic** resets gates, feedback, and reverb.

Audio processing and recordings stay in the browser. No microphone audio is sent to Cloudflare or GitHub. The Worker serves static application files. Takes are in memory, up to eight takes of three minutes each, and are not persisted. Patches can be stored in localStorage or exported as JSON.

## Synthesis architecture

- Three oscillators with PolyBLEP saw and pulse edges; VCO 2 also offers sine and integrated triangle. Oscillators and the nonlinear four-pole filter run at 2× the device sample rate.
- Per-oscillator pitch/FM, low-frequency range, coarse/fine tune, pulse width and VCO 2 PWM.
- Normalled mixer inputs into the VCF; keyboard tracking, envelope and audio-rate cutoff modulation; resonance and input saturation.
- ADSR and AR envelopes with patchable gates. VCA initial gain and separate envelope depths; ring and filter audio inputs.
- Preamplifier, attack/release envelope follower, AC/DC ring multiplier, continuously colored noise, sample-and-hold, internal clock, electronic switch, signed voltage processor and lag.
- A stereo spring-like delay-network reverb, DC rejection, bounded instrument output and a final monitoring limiter.
- AudioWorklet-based capture into three PCM channels, non-destructive tape layers, variable-rate resampling, wow/flutter modulation, saturation, and offline WAV rendering.

## Fidelity boundary

This is an independently developed digital homage, not an official ARP/Korg product. Routing and performance concepts follow the 2600; it is **not certified as a circuit-exact reproduction**. There are no measurements of a physical reference instrument in this repository.

The oscillator spectra, 4012/4072 filter differences, envelope curves, component tolerances, physical spring dispersion and magnetic tape hysteresis are approximations. Arbitrary feedback connections have a causal processing delay. Control scaling and the panel layout are adapted for browser use. Stereo tape layers share the global tape coloration; each take can have its own speed and direction. The keyboard is duophonic, not independently polyphonic. Tape loops may have a short transport gap at the boundary. Hardware MIDI and microphone latency depend on device/browser settings.

Reference: [Korg original 2600 manual, patch book, and 3620 manual](https://www.korg.com/us/support/download/product/0/842/). The manual informs behavior; its artwork, scans, and proprietary software are not redistributed. Browser references: [AudioWorklet](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorklet), [Web MIDI](https://developer.mozilla.org/en-US/docs/Web/API/Web_MIDI_API).

## Local development

Requires Node.js 22+ and npm on Windows.

```powershell
npm.cmd ci
npm.cmd run dev
```

Open http://127.0.0.1:8787. No framework/build step is needed: `public/` is the complete site. `dsp.js` is an ES module used both by AudioWorklet and Node regression tests.

```powershell
npm.cmd run check
npx.cmd playwright install chromium
npm.cmd run test:browser
```

Browser tests need the local server running. They use a synthetic microphone, not physical hardware. They verify sound energy, patch/unpatch, voice input, two-stem recording, playback, WAV download and mobile layout. DSP tests check oscillator tuning, envelopes, voice gating, filter attenuation, feedback stability and WAV headers. These tests establish functionality, not measured analog equivalence.

## Deployment from the Windows PC

GitHub Actions runs on the private repository's self-hosted Windows runner `windows11-arp-2600`, label `arp-2600-studio`. Pushing to `main`, or manually running the deployment workflow, installs the lockfile dependencies, runs DSP checks, and deploys the Worker.

The deployment script loads the current Windows user's DPAPI-encrypted credentials from:

`%LOCALAPPDATA%\CodexPrivate\Cloudflare\cold-hill-01a7.credentials.xml`

No Cloudflare token is stored in source control, Actions secrets, or public browser assets. The process environment is cleared after deployment. R2 credentials are not needed by this application.

The PC must be awake, connected to the internet, and the runner must be running under the same Windows user who encrypted the credentials. The already-published website remains available when the PC is off. Restart the runner after a reboot with:

```powershell
.\scripts\start-runner.ps1
```

Runner binaries and configuration live outside this repository in `%LOCALAPPDATA%\CodexPrivate\GitHubRunner\arp-2600-studio`. It runs as a hidden user process, not an installed Windows service. No startup task is installed. Keep the repository private and restrict who can push workflow changes: self-hosted jobs execute locally as this user. Pull requests do not trigger this deployment workflow.

For a manual deployment:

```powershell
.\scripts\deploy-local.ps1
```
