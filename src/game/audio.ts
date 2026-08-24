let ctx: AudioContext | null = null;
let lastHit = 0;

function ac(): AudioContext | null {
  try {
    if (!ctx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, dur: number, type: OscillatorType, gain: number, slide = 0) {
  const a = ac();
  if (!a) return;
  try {
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, a.currentTime);
    if (slide !== 0) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), a.currentTime + dur);
    g.gain.setValueAtTime(gain, a.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);
    o.connect(g).connect(a.destination);
    o.start();
    o.stop(a.currentTime + dur + 0.02);
  } catch {
    /* noop */
  }
}

export const sfx = {
  unlock() {
    ac();
  },
  cast() {
    tone(520, 0.16, "sine", 0.08, 260);
  },
  nuke() {
    tone(220, 0.25, "sawtooth", 0.07, -140);
  },
  hit() {
    const now = performance.now();
    if (now - lastHit < 90) return;
    lastHit = now;
    tone(150, 0.07, "square", 0.035, -60);
  },
  arrow() {
    tone(760, 0.08, "triangle", 0.04, -300);
  },
  gold() {
    tone(880, 0.09, "triangle", 0.05, 120);
    setTimeout(() => tone(1320, 0.12, "triangle", 0.05, 60), 70);
  },
  levelup() {
    tone(440, 0.3, "sine", 0.08, 440);
    setTimeout(() => tone(660, 0.35, "sine", 0.07, 330), 110);
  },
  tower() {
    tone(90, 0.6, "sawtooth", 0.12, -40);
    tone(60, 0.8, "square", 0.08, -20);
  },
  death() {
    tone(200, 0.4, "sawtooth", 0.07, -150);
  },
  buy() {
    tone(600, 0.1, "triangle", 0.06, 200);
  },
  error() {
    tone(140, 0.12, "square", 0.05, -30);
  },
  streak() {
    [523, 659, 784].forEach((f, i) => setTimeout(() => tone(f, 0.2, "square", 0.07), i * 90));
  },
  victory() {
    [392, 494, 587, 784].forEach((f, i) => setTimeout(() => tone(f, 0.45, "triangle", 0.09), i * 160));
  },
  defeat() {
    [330, 262, 208, 156].forEach((f, i) => setTimeout(() => tone(f, 0.5, "sawtooth", 0.07), i * 190));
  },
};
