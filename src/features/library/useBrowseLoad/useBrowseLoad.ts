import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';

/** Where a load is: never both loading and errored, never data without `ready`. */
export type BrowseLoadStatus = 'loading' | 'ready' | 'error';

export interface BrowseLoadResult<T> {
  status: BrowseLoadStatus;
  /** What the most recent successful load returned; `null` until one has. */
  data: T | null;
  /**
   * Edit what was loaded, for the edits a browse screen can make to its own
   * payload without asking for it again — a favorite heart above all. The next
   * load replaces whatever was written here, which is right: the server's answer
   * is the truth, and an edit only stands in for it until one arrives.
   */
  setData: Dispatch<SetStateAction<T | null>>;
  /** Re-run the load after a failure. */
  retry: () => void;
}

/**
 * The load every browse screen makes: one request per settled query, a skeleton
 * only when there is nothing else to show, and a retry after a failure.
 *
 * **The skeleton latch.** Once a screen is `ready`, a refetch keeps it `ready`
 * and the content already painted stays put; only a load with nothing on screen
 * behind it falls back to `loading`. This is the rule that makes search-as-you-
 * type readable — flashing the whole grid to skeletons every time the typing
 * settles would be unreadable while she is reading the posters — and it is
 * stated here, once, rather than in each screen that depends on it.
 *
 * **The in-flight guard.** A retry, or a newer query, landing while an earlier
 * load is still in flight must not have the abandoned response overwrite it. The
 * effect's cleanup disowns the response it started, so only the newest load can
 * set anything.
 *
 * `key` is what identifies the load — change it and the screen reloads, leave it
 * alone and nothing happens, however many times the caller re-renders. Callers
 * already hold one: the settled query written back out the way the URL spells
 * it, which is canonical precisely so that an unchanged query is an unchanged
 * string.
 */
export function useBrowseLoad<T>(
  load: () => Promise<T>,
  key: string
): BrowseLoadResult<T> {
  const [status, setStatus] = useState<BrowseLoadStatus>('loading');
  const [data, setData] = useState<T | null>(null);
  const [attempt, setAttempt] = useState(0);

  // The fetcher is a fresh closure on every render, so it cannot be an effect
  // dependency without reloading the screen on every render. `key` is what says
  // which load this is; the ref is only how the effect reaches the current
  // closure once the key has told it to run.
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    let current = true;
    setStatus((previous) => (previous === 'ready' ? 'ready' : 'loading'));

    loadRef
      .current()
      .then((loaded) => {
        if (!current) {
          return;
        }
        setData(loaded);
        setStatus('ready');
      })
      .catch(() => {
        if (!current) {
          return;
        }
        setData(null);
        setStatus('error');
      });

    return () => {
      current = false;
    };
  }, [key, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return { status, data, setData, retry };
}
