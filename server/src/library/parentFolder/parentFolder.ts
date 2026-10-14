/**
 * A **Stored path** `levels` directories up, or `null` with nothing above it —
 * the **Media folder** a row written without one is given: a film's video one
 * level down, an episode's two (`season-NN/` between).
 *
 * The fallback for rows that do not name their folder. Shipping code names it
 * whoever reserved it; this is the reading for everything written before that.
 */
export function parentFolder(
  path: string | undefined,
  levels: number
): string | null {
  if (path === undefined) return null;
  const segments = path.split('/');
  return segments.length > levels ? segments.slice(0, -levels).join('/') : null;
}
