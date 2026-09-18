/** The units **Space used** is written in, each 1024 of the one before. */
const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const;

/**
 * Formats a byte count the way the folder's own Properties dialog in Explorer
 * does: 1024-based, turning over at each threshold, with one decimal from KB
 * up and whole bytes below — `0 B`, `512 B`, `1.0 KB`, `18.4 GB`. Past the
 * last unit it stays in TB, so nothing is ever written in a unit the list
 * does not have. The card agrees with Explorer to the decimal, which is the
 * whole of what it is for.
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }

  return `${value.toFixed(1)} ${UNITS[unit]}`;
}
