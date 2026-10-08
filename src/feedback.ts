/** Small, tasteful rewards: a click per rep, a chord when the day closes, a short burst of confetti. */

const SOUND_KEY = "sets:sound";
let ctx: AudioContext | null = null;

export function soundOn(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setSoundOn(on: boolean) {
  try {
    localStorage.setItem(SOUND_KEY, on ? "on" : "off");
  } catch {
    // private mode: keep the default
  }
}

function audio(): AudioContext | null {
  if (!soundOn()) return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, at: number, dur: number, gain: number, type: OscillatorType = "sine") {
  const a = audio();
  if (!a) return;
  const t0 = a.currentTime + at;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(a.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

export function buzz(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // unsupported
  }
}

/** One rep. Pitch rises a little as you approach the goal. */
export function tick(progress = 0) {
  tone(880 + Math.min(progress, 1.5) * 440, 0, 0.07, 0.12, "triangle");
  buzz(8);
}

/** A set was saved. */
export function plink() {
  tone(1046.5, 0, 0.12, 0.1, "sine");
  tone(1568, 0.05, 0.16, 0.06, "sine");
  buzz(12);
}

/** The day closed: a rising major chord. */
export function chord() {
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, i * 0.085, 0.9 - i * 0.1, 0.11, "triangle"));
  buzz([18, 60, 18, 60, 40]);
}

/** A new rank: a lower, longer fifth under the chord. */
export function fanfare() {
  tone(261.63, 0, 1.4, 0.08, "sine");
  tone(392, 0.12, 1.3, 0.07, "sine");
  chord();
}

const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** A quick burst from the center of the screen. Cleans itself up. */
export function confetti(colors: string[], { count = 90, originY = 0.38 } = {}) {
  if (reducedMotion()) return;
  const canvas = document.createElement("canvas");
  canvas.className = "confetti";
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  document.body.appendChild(canvas);
  const g = canvas.getContext("2d");
  if (!g) return canvas.remove();
  g.scale(dpr, dpr);

  const ox = innerWidth / 2;
  const oy = innerHeight * originY;
  const parts = Array.from({ length: count }, () => {
    const angle = Math.random() * Math.PI * 2;
    const speed = 4 + Math.random() * 9;
    return {
      x: ox,
      y: oy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 4,
      w: 3 + Math.random() * 4,
      h: 6 + Math.random() * 8,
      r: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.35,
      color: colors[Math.floor(Math.random() * colors.length)],
    };
  });

  const start = performance.now();
  const frame = (now: number) => {
    const t = (now - start) / 1000;
    g.clearRect(0, 0, innerWidth, innerHeight);
    g.globalAlpha = Math.max(0, 1 - Math.max(0, t - 0.9) / 0.8);
    for (const p of parts) {
      p.vy += 0.32;
      p.vx *= 0.985;
      p.vy *= 0.985;
      p.x += p.vx;
      p.y += p.vy;
      p.r += p.vr;
      g.save();
      g.translate(p.x, p.y);
      g.rotate(p.r);
      g.fillStyle = p.color;
      g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r * 2)));
      g.restore();
    }
    if (t < 1.7) requestAnimationFrame(frame);
    else canvas.remove();
  };
  requestAnimationFrame(frame);
}

/** Keep the screen awake while counting. Returns a release function. */
export async function keepAwake(): Promise<() => void> {
  try {
    const lock = await (navigator as Navigator & { wakeLock?: { request(t: "screen"): Promise<{ release(): Promise<void> }> } }).wakeLock?.request(
      "screen",
    );
    return () => void lock?.release().catch(() => {});
  } catch {
    return () => {};
  }
}
