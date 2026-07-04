/** Two gradient stops for a poster's placeholder art. */
export interface GradientStops {
  g1: string;
  g2: string;
}

/**
 * FNV-1a hash — a fast, deterministic string hash. Same input, same output.
 */
function hash(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Derives a deterministic two-stop gradient from a movie id, used as poster
 * placeholder art when a movie has no poster image. The same id always yields
 * the same two stops, and different ids spread across the hue wheel so the grid
 * doesn't collapse onto one color. Stops share a warm, muted, cinematic feel
 * (low saturation, dark-to-mid lightness) to match the prototype's placeholders.
 */
export function gradientFromId(id: string): GradientStops {
  const h = hash(id);
  const hue = h % 360;
  return {
    g1: `hsl(${hue}, 30%, 20%)`,
    g2: `hsl(${(hue + 40) % 360}, 38%, 42%)`,
  };
}
