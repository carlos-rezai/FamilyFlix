import { useCallback, useEffect, useRef, useState } from 'react';

import { useSnackbar } from '@/App/useSnackbar/useSnackbar';
import { fetchTmdbKey, saveTmdbKey } from '../api/api';

export interface TmdbKeyState {
  /** What is in the field — the stored key once it lands, then what is typed. */
  key: string;
  /** Whether the stored key is what the field holds. */
  connected: boolean;
  /** Whether a test is on the wire. */
  testing: boolean;
  /** The field's edit. */
  onKey(key: string): void;
  /** _Test connection_: the test and the save in one, raising its notice. */
  test(): Promise<void>;
}

/**
 * The Network group's key: the stored one read on mount, and _Test
 * connection_ — `POST /api/tmdb/key` — raising one of the four notices through
 * `useSnackbar()`. **Connected** is a comparison, not a flag: the stored key
 * is in the field, so the moment the field is edited it no longer is.
 */
export function useTmdbKey(): TmdbKeyState {
  const { notify } = useSnackbar();
  const [stored, setStored] = useState<string | null>(null);
  const [key, setKey] = useState('');
  const [testing, setTesting] = useState(false);
  // A key typed before the read lands is not overwritten by it.
  const edited = useRef(false);

  useEffect(() => {
    let wanted = true;

    fetchTmdbKey().then(
      (landed) => {
        if (!wanted) {
          return;
        }
        setStored(landed);
        if (landed !== null && !edited.current) {
          setKey(landed);
        }
      },
      () => undefined
    );

    return () => {
      wanted = false;
    };
  }, []);

  const onKey = useCallback((next: string) => {
    edited.current = true;
    setKey(next);
  }, []);

  const test = useCallback(async (): Promise<void> => {
    if (key.trim().length === 0) {
      notify({ variant: 'warning', message: 'Paste a key first.' });
      return;
    }

    setTesting(true);
    const outcome = await saveTmdbKey(key);
    setTesting(false);

    if (outcome.kind === 'saved') {
      setStored(outcome.key);
      setKey(outcome.key);
      notify({ variant: 'success', message: 'Connected to TMDB.' });
    } else if (outcome.kind === 'refused') {
      notify({ variant: 'error', message: "TMDB didn't accept that key." });
    } else {
      notify({ variant: 'error', message: "Couldn't reach TMDB." });
    }
  }, [key, notify]);

  return {
    key,
    connected: stored !== null && stored === key,
    testing,
    onKey,
    test,
  };
}
