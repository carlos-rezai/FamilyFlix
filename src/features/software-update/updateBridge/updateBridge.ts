import type { UpdateBridge } from '@/types/update';

/**
 * The one reader of `window.familyflix?.updates`, the bridge the **Desktop
 * shell**'s preload defines. A browser — `npm run dev` — has none, and that is
 * a state, not an error: `null`, and the row draws nothing.
 */
export function updateBridge(): UpdateBridge | null {
  return window.familyflix?.updates ?? null;
}
