// Listens to whatever is playing near the laptop, through its microphone.
// Audio is analyzed in the browser and never recorded, stored or sent.
//
// Echo cancellation and noise suppression are turned off: otherwise the
// browser treats the laptop's own speakers as noise and removes the music.
//
// Every channel adapts to the room: it is mapped between its noise floor (a
// slowly rising running minimum) and a decaying running peak, so a quiet
// laptop mic and loud playback both drive the full range, and room hiss reads
// as silence.
//
// What it reports, like a music visualizer splits a song:
//   spectrum   18 log-spaced bands, bass to treble, with a fast attack, one
//              per letter of the headline
//   kicks      count of kick drums: a jump in the lowest band
//   snares     count of snares: a jump in the bright crack (1.5-5 kHz) with
//              some body under it
//   hats       count of hi-hats: a jump in the air above 7 kHz
//   tone       how much sustained, pitched sound (synths, keys, voice) there
//              is, slow to rise and fall, so it reads as colour, not hits
//   brightness where that energy sits, 0 dark to 1 bright
//   level, bass, mid, high, beat, beats: the eased summaries raly's body uses
// The counters only go up, so a reader on another frame clock never misses one.

const clamp01 = v => Math.max(0, Math.min(1, v));
export const SPECTRUM_BANDS = 18;
const LOW_HZ = 45, HIGH_HZ = 12000;

export function createAudio() {
  const state = {
    enabled: false, level: 0, bass: 0, mid: 0, high: 0, beat: 0, beats: 0, onset: false, error: '',
    spectrum: new Float32Array(SPECTRUM_BANDS), kicks: 0, snares: 0, hats: 0, tone: 0, brightness: 0.5,
  };
  let context = null, analyser = null, stream = null, data = null;
  let primed = false, settling = 0, pulse = 0;
  const channels = new Map();
  const edges = Array.from({ length: SPECTRUM_BANDS + 1 }, (_, i) => LOW_HZ * (HIGH_HZ / LOW_HZ) ** (i / SPECTRUM_BANDS));
  // Each percussive voice: its own flux average and refractory time.
  const hits = {
    kick: { average: 0.02, wait: 0, gap: 0.3 },
    snare: { average: 0.02, wait: 0, gap: 0.2 },
    hat: { average: 0.02, wait: 0, gap: 0.1 },
  };

  function band(fromHz, toHz) {
    const hzPerBin = context.sampleRate / analyser.fftSize;
    const a = Math.max(1, Math.floor(fromHz / hzPerBin)), b = Math.max(a, Math.min(data.length - 1, Math.ceil(toHz / hzPerBin)));
    let sum = 0;
    for (let i = a; i <= b; i++) sum += data[i];
    return sum / ((b - a + 1) * 255);
  }

  // Maps a raw channel between its floor and peak. Returns 0..1, the positive
  // jump since the last frame in those units (spectral flux), and the same
  // jump unscaled, which compares fairly across bands.
  function track(key, raw, dt, minRange = 0.15, dead = 0.035) {
    let c = channels.get(key);
    if (!c) { c = { smoothed: raw, floor: raw, peak: raw, last: raw }; channels.set(key, c); }
    // The floor follows a smoothed signal, so frame-to-frame hiss does not
    // drag it down: it drops at once and creeps back up. For the first second
    // it follows both ways, a short calibration to the room.
    c.smoothed += (raw - c.smoothed) * (1 - Math.exp(-dt * 4));
    const rise = settling > 0 ? 8 : 0.08;
    c.floor = c.smoothed < c.floor ? c.smoothed : c.floor + (c.smoothed - c.floor) * (1 - Math.exp(-dt * rise));
    c.peak = Math.max(raw, c.floor + (c.peak - c.floor) * Math.exp(-dt * 0.5));
    // A minimum range and a dead zone just above the hiss keep an empty room
    // from being stretched into "music".
    const range = Math.max(minRange, c.peak - c.floor);
    const value = clamp01((raw - c.floor - dead) / range);
    const jump = Math.max(0, raw - c.last);
    c.last = raw;
    return [value, jump / range, jump];
  }

  function hit(name, flux, threshold, present, dt) {
    const h = hits[name];
    h.average += (flux - h.average) * (1 - Math.exp(-dt * 1.5));
    h.wait -= dt;
    if (settling > 0 || !present || h.wait > 0 || flux < h.average * 1.5 + threshold) return false;
    h.wait = h.gap;
    return true;
  }

  return {
    state,
    async enable() {
      if (state.enabled) return true;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
        });
        context = new AudioContext();
        analyser = context.createAnalyser();
        analyser.fftSize = 2048;
        // Light smoothing: the visuals should land on the hit, not after it.
        analyser.smoothingTimeConstant = 0.4;
        // Laptop mics hear music from the room very quietly: loud playback
        // measured about -77 dBFS, which the stock -100..-30 dB window maps to
        // almost nothing. A window 30 dB lower puts it in the middle.
        analyser.minDecibels = -130;
        analyser.maxDecibels = -60;
        // The analyser is a dead end: nothing is played back.
        context.createMediaStreamSource(stream).connect(analyser);
        data = new Uint8Array(analyser.frequencyBinCount);
        state.enabled = true; state.error = '';
        return true;
      } catch (error) {
        state.error = error?.name === 'NotAllowedError' ? 'Microphone access was declined.' : 'No microphone is available.';
        return false;
      }
    },
    disable() {
      stream?.getTracks().forEach(track => track.stop());
      context?.close();
      context = analyser = stream = data = null;
      pulse = 0; primed = false; channels.clear();
      state.spectrum.fill(0);
      Object.assign(state, { enabled: false, level: 0, bass: 0, mid: 0, high: 0, beat: 0, onset: false, tone: 0, brightness: 0.5 });
    },
    update(dt) {
      state.onset = false;
      // The beat eases up to each kick and settles back over about a second.
      pulse *= Math.exp(-dt * 2.6);
      state.beat += (pulse - state.beat) * (1 - Math.exp(-dt * (pulse > state.beat ? 22 : 6)));
      if (!state.enabled || !analyser || dt <= 0) return state;
      analyser.getByteFrequencyData(data);
      // The mic opens with silent frames and the analyser ramps up from zero.
      if (!primed) {
        if (band(30, 9000) === 0) return state;
        primed = true; settling = 1;
      }
      settling -= dt;

      // The spectrum: snaps up with the sound, falls back a little slower.
      // Narrow bands are noisier, so they get a wider gate, and the whole
      // spectrum is held down while the room is quiet.
      const present = clamp01((state.level - 0.06) / 0.15);
      let energy = 0, weighted = 0;
      for (let i = 0; i < SPECTRUM_BANDS; i++) {
        const [value] = track(`band${i}`, band(edges[i], edges[i + 1]), dt, 0.25, 0.07);
        const v = value ** 0.8 * present;
        state.spectrum[i] += (v - state.spectrum[i]) * (1 - Math.exp(-dt * (v > state.spectrum[i] ? 20 : 5)));
        energy += state.spectrum[i]; weighted += state.spectrum[i] * i;
      }

      // The eased summaries raly's body uses.
      const [bass, kickFlux, kickJump] = track('kick', band(40, 110), dt);
      const [mid] = track('mid', band(160, 2000), dt);
      const [high, hatFlux, hatJump] = track('hat', band(7000, 14000), dt);
      const [body, , bodyJump] = track('snareBody', band(150, 350), dt);
      const [crack, crackFlux, crackJump] = track('snareCrack', band(1500, 5000), dt);
      for (const [key, value] of [['bass', bass], ['mid', mid], ['high', high]]) {
        const target = value ** 0.75;
        state[key] += (target - state[key]) * (1 - Math.exp(-dt * (target > state[key] ? 12 : 3)));
      }
      const level = clamp01(state.bass * 0.5 + state.mid * 0.35 + state.high * 0.15);
      state.level += (level - state.level) * (1 - Math.exp(-dt * 4));

      // Percussion, each voice on its own, told apart by where a hit lands in
      // the spectrum (compared unscaled, since a click raises every band
      // alike): a kick lifts the low end more than the snare's body; a snare
      // lifts its body more than the kick band and its crack more than the air
      // above; a hi-hat is mostly air.
      if (hit('kick', kickFlux, 0.12, state.bass > 0.25 && kickJump > bodyJump, dt)) {
        state.kicks++; state.beats++; state.onset = true;
        pulse = Math.min(1, 0.65 + 0.35 * state.bass);
      }
      if (hit('snare', crackFlux, 0.1, crack > 0.25 && body > 0.1 && bodyJump > kickJump && crackJump > hatJump * 0.9, dt)) state.snares++;
      if (hit('hat', hatFlux, 0.08, high > 0.2 && hatJump > crackJump * 0.9, dt)) state.hats++;

      // Sustained, pitched sound: the mids that stay up between hits. Slow on
      // purpose, so a synth pad or a voice reads as colour rather than motion.
      const tone = clamp01(mid * 1.2 - 0.1);
      state.tone += (tone - state.tone) * (1 - Math.exp(-dt * (tone > state.tone ? 2.5 : 1)));
      const centroid = energy > 0.05 ? weighted / energy / (SPECTRUM_BANDS - 1) : state.brightness;
      state.brightness += (centroid - state.brightness) * (1 - Math.exp(-dt * 2));
      return state;
    },
  };
}
