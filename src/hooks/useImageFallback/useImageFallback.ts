import { useCallback, useState } from 'react';

/** What {@link useImageFallback} answers: the url to draw, and the report. */
export interface ImageFallback {
  /** The url handed in, or `null` for none and once it has failed to load. */
  url: string | null;
  /** What the image's `onError` calls: the url it was handed has failed. */
  onError: () => void;
}

/**
 * The one failed-url rule for a poster or a still: the url handed in is drawn
 * until it fails to load, then `null`, so the caller draws what it draws for
 * no art at all. Keyed by url, so a new url gets its own chance to load. UI
 * state only, knowing no domain, so a molecule may call it as it calls
 * `useState`.
 */
export function useImageFallback(
  handed: string | null | undefined
): ImageFallback {
  const url = handed ?? null;
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const onError = useCallback(() => setFailedUrl(url), [url]);
  return { url: url === failedUrl ? null : url, onError };
}
