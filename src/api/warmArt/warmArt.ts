/** How many decoded pictures the **Warm start** keeps at once. */
const KEPT = 8;

/**
 * The decoded pictures, oldest first. Each keeps its `Image` alive, which is
 * what keeps the browser's decoded copy of it.
 */
const warm = new Map<string, HTMLImageElement>();

/** The pictures still fetching or decoding, so none is asked for twice. */
const warming = new Map<string, Promise<void>>();

/** Whether `url` is decoded now, so a page can draw it in its first paint. */
export function isWarm(url: string): boolean {
  return warm.has(url);
}

/**
 * The **Warm start**: fetch and decode a picture ahead through an `Image` and
 * its `decode()`, so the page that draws it next paints it whole. A url warm
 * or warming is never asked for again; the last {@link KEPT} are kept, the
 * oldest dropped first. A failure settles quietly and holds nothing, so the
 * next ask tries again. `null` does nothing.
 */
export function warmArt(url: string | null): Promise<void> {
  if (url === null) {
    return Promise.resolve();
  }
  const kept = warm.get(url);
  if (kept !== undefined) {
    // Asked again: the freshest, so the last to be dropped.
    warm.delete(url);
    warm.set(url, kept);
    return Promise.resolve();
  }
  const pending = warming.get(url);
  if (pending !== undefined) {
    return pending;
  }

  const image = new Image();
  image.src = url;
  const decoding = image
    .decode()
    .then(
      () => {
        warm.set(url, image);
        const oldest = warm.keys().next();
        if (warm.size > KEPT && oldest.done !== true) {
          warm.delete(oldest.value);
        }
      },
      () => undefined
    )
    .finally(() => {
      warming.delete(url);
    });
  warming.set(url, decoding);
  return decoding;
}
