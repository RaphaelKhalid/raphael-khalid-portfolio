// Listens to whatever is playing near the laptop, through its microphone.
// Audio is analyzed in the browser and never recorded, stored or sent.
//
// Echo cancellation and noise suppression are turned off: otherwise the
// browser treats the laptop's own speakers as noise and removes the music.
//
// Bands adapt to the room: each is normalized by a slowly decaying running
// peak, so quiet and loud playback both drive the full range. A beat is a
// jump in bass energy above its recent average. Everything is eased: the
// bands glide rather than twitch, and a beat swells and fades like a breath.

const clamp01 = v => Math.max(0, Math.min(1, v));

export function createAudio() {
  const state = { enabled: false, level: 0, bass: 0, mid: 0, high: 0, beat: 0, onset: false, error: '' };
  let context = null, analyser = null, stream = null, data = null;
  const peaks = { bass: 0.05, mid: 0.05, high: 0.05 };
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
        analyser.smoothingTimeConstant = 0.78;
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
      for (const key of Object.keys(raw)) {
        peaks[key] = Math.max(raw[key], peaks[key] * Math.exp(-dt * 0.25), 0.03);
        const target = clamp01(raw[key] / peaks[key]);
        // A soft attack and a long release, so the body glides with the music.
        const rate = target > state[key] ? 7 : 2.2;
        state[key] += (target - state[key]) * (1 - Math.exp(-dt * rate));
      }
      const level = clamp01(state.bass * 0.5 + state.mid * 0.35 + state.high * 0.15);
      state.level += (level - state.level) * (1 - Math.exp(-dt * 3));
      const flux = Math.max(0, raw.bass - lastBass) / peaks.bass;
      lastBass = raw.bass;
      fluxAverage += (flux - fluxAverage) * (1 - Math.exp(-dt * 1.5));
      refractory -= dt;
      if (flux > fluxAverage * 2.2 + 0.06 && state.bass > 0.35 && refractory <= 0) {
        state.onset = true; pulse = Math.min(1, 0.55 + 0.45 * state.bass); refractory = 0.28;
      }
      return state;
    },
  };
}
