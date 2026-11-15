// Procedural sound: one AudioContext, created on the first click (browser
// autoplay rules). Every effect is an oscillator + noise buffer + filter +
// envelope from one table — no audio files, no network. Nodes are created per
// play but the noise buffer is built once; volumes scale with 1/distance for
// bot shots so far gunfire sounds far.
const DEFS = {
  shotRifle: { type: 'noise', freq: 1800, dur: 0.09, vol: 0.5, tone: 160 },
  shotSmg: { type: 'noise', freq: 2200, dur: 0.06, vol: 0.4, tone: 220 },
  shotShotgun: { type: 'noise', freq: 900, dur: 0.18, vol: 0.7, tone: 90 },
  shotPistol: { type: 'tone', freq: 300, dur: 0.05, vol: 0.4 },
  reload: { type: 'tone', freq: 2000, dur: 0.03, vol: 0.25 },
  step: { type: 'noise', freq: 400, dur: 0.05, vol: 0.12 },
  hit: { type: 'tone', freq: 1200, dur: 0.04, vol: 0.3 },
  kill: { type: 'tone', freq: 1200, dur: 0.08, vol: 0.35, slide: 1800 },
  hurt: { type: 'tone', freq: 90, dur: 0.12, vol: 0.5 },
  beep: { type: 'tone', freq: 880, dur: 0.06, vol: 0.25 },
  defuseBeep: { type: 'tone', freq: 660, dur: 0.06, vol: 0.25 },
  blast: { type: 'noise', freq: 300, dur: 0.8, vol: 0.8, tone: 60 },
  win: { type: 'arp', notes: [523, 659, 784], dur: 0.12, vol: 0.3 },
  lose: { type: 'arp', notes: [392, 330, 262], dur: 0.12, vol: 0.3 },
  buy: { type: 'tone', freq: 2400, dur: 0.03, vol: 0.25 },
  plant: { type: 'tone', freq: 1000, dur: 0.06, vol: 0.3 },
};

export function createAudio() {
  let ctx = null;
  let noiseBuffer = null;
  let master = null;

  function ensure() {
    if (ctx) return true;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.6;
      master.connect(ctx.destination);
      const length = Math.floor(ctx.sampleRate * 0.5);
      noiseBuffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
      // Harbour wind: a quiet looped lowpass noise, built once.
      const windSource = ctx.createBufferSource();
      windSource.buffer = noiseBuffer;
      windSource.loop = true;
      const windFilter = ctx.createBiquadFilter();
      windFilter.type = 'lowpass';
      windFilter.frequency.value = 200;
      const windGain = ctx.createGain();
      windGain.gain.value = 0.03;
      windSource.connect(windFilter).connect(windGain).connect(master);
      windSource.start();
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, vol, slideTo) {
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(gain).connect(master);
    osc.start();
    osc.stop(ctx.currentTime + dur);
  }

  function noise(freq, dur, vol, toneFreq) {
    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    source.connect(filter).connect(gain).connect(master);
    source.start();
    source.stop(ctx.currentTime + dur);
    if (toneFreq) tone(toneFreq, dur, vol * 0.6, toneFreq * 0.5);
  }

  function play(name, distance) {
    if (!ensure()) return;
    if (ctx.state === 'suspended') ctx.resume();
    const def = DEFS[name];
    if (!def) return;
    const scale = distance === undefined ? 1 : Math.max(0.05, Math.min(1, 12 / Math.max(1, distance)));
    if (def.type === 'arp') {
      def.notes.forEach((freq, index) => {
        setTimeout(() => tone(freq, def.dur, def.vol * scale), index * 110);
      });
      return;
    }
    if (def.type === 'tone') tone(def.freq, def.dur, def.vol * scale, def.slide);
    else noise(def.freq, def.dur, def.vol * scale, def.tone);
  }

  return {
    ensure,
    play,
    shot(weaponId, distance) {
      play(weaponId === 'kancil' ? 'shotSmg' : weaponId === 'badak' ? 'shotShotgun' : weaponId === 'p9' ? 'shotPistol' : 'shotRifle', distance);
    },
  };
}
