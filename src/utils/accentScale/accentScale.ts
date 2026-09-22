/** The accent's five derivatives, computed from the one accent. */
export interface AccentScale {
  accentHover: string;
  accentPress: string;
  accentSoft: string;
  accentLine: string;
  focusRing: string;
}

type Rgb = readonly [number, number, number];

function channels(hex: string): Rgb {
  const value = hex.replace('#', '');
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
  ];
}

function toHex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

/** Mixes toward white by a positive amount, toward black by a negative one. */
function shade(hex: string, amount: number): string {
  const mixed = channels(hex).map((c) =>
    Math.round(amount >= 0 ? c + (255 - c) * amount : c * (1 + amount))
  );
  return toHex([mixed[0], mixed[1], mixed[2]]);
}

function rgba(hex: string, alpha: number): string {
  const [r, g, b] = channels(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * The **Accent scale**, the prototype's formula: hover 18% toward white, press
 * 12% toward black, soft and line the accent at 14% and 32% alpha, the focus
 * ring the hover at 55%.
 */
export function accentScale(accent: string): AccentScale {
  const accentHover = shade(accent, 0.18);
  return {
    accentHover,
    accentPress: shade(accent, -0.12),
    accentSoft: rgba(accent, 0.14),
    accentLine: rgba(accent, 0.32),
    focusRing: rgba(accentHover, 0.55),
  };
}
