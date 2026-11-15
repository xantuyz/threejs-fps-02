// Small pure helpers shared by the simulation. No three.js here: nav.js and the
// bot logic use these without touching the renderer. The seeded RNG makes the
// ?shot= captures reproducible; live play uses Math.random through the same call.
export function mulberry32(initial) {
  let a = initial | 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function clamp(value, min, max) {
  return value < min ? min : value > max ? value : value;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

// "01:23" from seconds left; clamps at 00:00 so a finished timer never shows negatives.
export function formatTimer(seconds) {
  const total = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes < 10 ? '0' : ''}${minutes}:${rest < 10 ? '0' : ''}${rest}`;
}

// "¢3.800" — Indonesian thousands separator, matching the in-world credit sign.
export function formatMoney(amount) {
  return `¢${Math.floor(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}
