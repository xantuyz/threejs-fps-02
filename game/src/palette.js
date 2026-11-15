// The look plan, in one place. Ten values: the starter's six plus teal (Meridian),
// rust (harbour steel), sky (dusk horizon) and danger. The same ten names are the
// CSS custom properties in index.html. No other colour appears in the game.
export const PALETTE = {
  canvas: '#14161a',
  surface: '#1e2228',
  hairline: '#2c323a',
  ink: '#e9e6df',
  muted: '#98a0a8',
  accent: '#f0a830',
  teal: '#2e8b8b',
  rust: '#a8542e',
  sky: '#e07840',
  danger: '#d64545',
};

export function shade(name) {
  return PALETTE[name];
}
