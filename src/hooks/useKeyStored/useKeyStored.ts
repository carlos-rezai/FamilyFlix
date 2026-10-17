import { useEffect, useState } from 'react';

import { fetchTmdbKey } from '@/api/fetchTmdbKey/fetchTmdbKey';

/**
 * Whether a TMDB key is stored — the read the `EnrichCheckCard`'s hint is
 * chosen by, on Import setup and on the Library folders page alike. `false`
 * until the read lands, and `false` still for a read that failed, which the
 * hint treats as no key. A read landing after unmount is dropped.
 */
export function useKeyStored(): boolean {
  const [keyStored, setKeyStored] = useState(false);

  useEffect(() => {
    let left = false;
    fetchTmdbKey().then(
      (key) => {
        if (!left) {
          setKeyStored(key !== null);
        }
      },
      () => {
        // A read that failed is no key: the hint says to add one.
      }
    );
    return () => {
      left = true;
    };
  }, []);

  return keyStored;
}
