import { useEffect, useState } from 'react';

import { isWarm, warmArt } from '@/api/warmArt/warmArt';

/**
 * The **Warm start** seen from a page: answers `url` once its picture is
 * decoded, already at the first render when it is warm, and `null` until then
 * or on a failure, so a picture is only ever drawn whole. A changed url starts
 * again, and a url left behind is never answered.
 */
export function useDecodedArt(url: string | null): string | null {
  const [decoded, setDecoded] = useState<string | null>(null);

  useEffect(() => {
    if (url === null || isWarm(url)) {
      return undefined;
    }
    let current = true;
    void warmArt(url).then(() => {
      if (current && isWarm(url)) {
        setDecoded(url);
      }
    });
    return () => {
      current = false;
    };
  }, [url]);

  if (url === null) {
    return null;
  }
  return decoded === url || isWarm(url) ? url : null;
}
