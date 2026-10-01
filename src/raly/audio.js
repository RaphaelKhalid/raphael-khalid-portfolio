// Listens to whatever is playing near the laptop, through its microphone.
// Audio is analyzed in the browser and never recorded, stored or sent.
//
// Echo cancellation and noise suppression are turned off: otherwise the
// browser treats the laptop's own speakers as noise and removes the music.
//
// Bands adapt to the room: each is mapped between its noise floor (a slowly
// rising running minimum) and a decaying running peak, so a quiet laptop mic
// and loud playback both drive the full range, and room hiss reads as
// silence. A beat is a jump in bass energy above its recent average.
// Everything is eased: the bands glide rather than twitch, and a beat swells
// and fades like a breath.

const clamp01 = v => Math.max(0, Math.min(1, v));

export function createAudio() {
  const state = { enabled: false, level: 0, bass: 0, mid: 0, high: 0, beat: 0, onset: false, error: '' };
  let context = null, analyser = null, stream = null, data = null;
  const peaks = {}, floors = {}, smoothed = {};
  let primed = false, settling = 0;
  let fluxAverage = 0.02, lastBass = 0, refractory = 0, pulse = 0;

  function band(fromHz, toHz) {
    const hzPerBin = context.sampleRate / analyser.fftSize;
    const a = Math.max(1, Math.floor(fromHz / hzPerBin)), b = Math.min(data.length - 1, Math.ceil(toHz / hzPerBin));
    let sum = 0;
    for (let i = a; i <= b; i++) sum += data[i];
    return sum / ((b - a + 1) * 255);
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
        analyser.smoothingTimeConstant = 0.6;
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
      pulse = 0;
      primed = false;
      Object.assign(state, { enabled: false, level: 0, bass: 0, mid: 0, high: 0, beat: 0, onset: false });
    },
    update(dt) {
      state.onset = false;
      // The beat eases up to each pulse and settles back over about a second.
      pulse *= Math.exp(-dt * 2.6);
      state.beat += (pulse - state.beat) * (1 - Math.exp(-dt * (pulse > state.beat ? 22 : 6)));
      if (!state.enabled || !analyser) return state;
      analyser.getByteFrequencyData(data);
      const raw = { bass: band(30, 160), mid: band(160, 2000), high: band(2000, 9000) };
      // The mic opens with silent frames and the analyser ramps up from zero.
      // For its first second the floor follows the room both ways (a short
      // calibration), or it would start below the room's own hiss.
      if (!primed) {
        if (raw.bass + raw.mid + raw.high === 0) return state;
        Object.assign(smoothed, raw); Object.assign(floors, raw); Object.assign(peaks, raw);
        primed = true; settling = 1;
      }
      settling -= dt;
      const ranges = {};
      for (const key of Object.keys(raw)) {
        // The floor follows a smoothed signal, so frame-to-frame hiss does not
        // drag it down: it drops at once and creeps back up. The peak jumps and decays.
        smoothed[key] += (raw[key] - smoothed[key]) * (1 - Math.exp(-dt * 4));
        const rise = settling > 0 ? 8 : 0.08;
        floors[key] = smoothed[key] < floors[key] ? smoothed[key] : floors[key] + (smoothed[key] - floors[key]) * (1 - Math.exp(-dt * rise));
        peaks[key] = Math.max(raw[key], floors[key] + (peaks[key] - floors[key]) * Math.exp(-dt * 0.5));
        // A minimum range and a dead zone just above the hiss keep an empty
        // room from being stretched into "music".
        ranges[key] = Math.max(0.15, peaks[key] - floors[key]);
        // A gentle curve lifts quieter passages.
        const target = clamp01((raw[key] - floors[key] - 0.035) / ranges[key]) ** 0.75;
        // A quick attack and a softer release, so the body moves with the music.
        const rate = target > state[key] ? 12 : 3;
        state[key] += (target - state[key]) * (1 - Math.exp(-dt * rate));
      }
      const level = clamp01(state.bass * 0.5 + state.mid * 0.35 + state.high * 0.15);
      state.level += (level - state.level) * (1 - Math.exp(-dt * 4));
      const flux = Math.max(0, raw.bass - lastBass) / ranges.bass;
      lastBass = raw.bass;
      fluxAverage += (flux - fluxAverage) * (1 - Math.exp(-dt * 1.5));
      refractory -= dt;
      if (settling <= 0 && flux > fluxAverage * 1.6 + 0.06 && state.bass > 0.25 && refractory <= 0) {
        state.onset = true; pulse = Math.min(1, 0.65 + 0.35 * state.bass); refractory = 0.22;
      }
      return state;
    },
  };
}
