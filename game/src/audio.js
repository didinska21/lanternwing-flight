export function createAudio() {
  let context, master, engine, engineGain, wind, windGain, filter;
  let muted = false;
  function unlock() {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio || muted) return;
    if (!context) {
      context = new Audio();
      master = context.createGain();
      master.gain.value = 0.3;
      master.connect(context.destination);
      engine = context.createOscillator();
      engine.type = 'sawtooth';
      engine.frequency.value = 48;
      engineGain = context.createGain();
      engineGain.gain.value = 0;
      const engineFilter = context.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 220;
      engine.connect(engineFilter).connect(engineGain).connect(master);
      engine.start();
      // A local, repeatable noise buffer: no fetched samples or audio files.
      const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
      const data = buffer.getChannelData(0);
      let word = 982451653;
      for (let i = 0; i < data.length; i++) {
        word ^= word << 13; word ^= word >>> 17; word ^= word << 5;
        data[i] = (word >>> 0) / 2147483648 - 1;
      }
      wind = context.createBufferSource();
      wind.buffer = buffer;
      wind.loop = true;
      filter = context.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 460;
      windGain = context.createGain();
      windGain.gain.value = 0;
      wind.connect(filter).connect(windGain).connect(master);
      wind.start();
    }
    if (context.state === 'suspended') context.resume().catch(() => {});
  }
  function chime(type) {
    if (!context || muted || context.state !== 'running') return;
    const notes = type === 'ring' ? [523.25, 783.99, 1046.5]
      : type === 'village' || type === 'boss' || type === 'objective' ? [392, 523.25, 659.25, 1046.5]
        : type === 'warning' || type === 'thunder' || type === 'crash' ? [92.5, 87.3] : [329.63, 493.88];
    notes.forEach((frequency, i) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const start = context.currentTime + i * 0.075;
      oscillator.type = type === 'crash' || type === 'thunder' ? 'sawtooth' : 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.18, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.65);
      oscillator.connect(gain).connect(master);
      oscillator.start(start);
      oscillator.stop(start + 0.7);
    });
  }
  return {
    unlock, chime,
    update(plane, active) {
      if (!context) return;
      const now = context.currentTime;
      engine.frequency.setTargetAtTime(32 + plane.speed * 0.65 + plane.throttle * 15, now, 0.1);
      engineGain.gain.setTargetAtTime(active && !plane.crashed && plane.fuel > 0 ? 0.035 + plane.throttle * 0.045 : 0, now, 0.18);
      windGain.gain.setTargetAtTime(active ? Math.min(0.15, plane.speed / 1200) : 0, now, 0.2);
      filter.frequency.setTargetAtTime(240 + plane.speed * 6, now, 0.2);
    },
    toggle() {
      muted = !muted;
      if (master) master.gain.setTargetAtTime(muted ? 0 : 0.3, context.currentTime, 0.03);
      if (!muted) unlock();
      return muted;
    },
    get muted() { return muted; },
  };
}
