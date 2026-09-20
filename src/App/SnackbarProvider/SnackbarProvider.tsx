import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { Snackbar } from '@/components';
import {
  SnackbarContext,
  type SnackbarApi,
  type SnackbarNotice,
} from '@/App/useSnackbar/useSnackbar';
import { Slot, Stack } from './SnackbarProvider.styles';

/** How long a notice stays before the stack takes it off on its own. */
const NOTICE_LIFETIME_MS = 5_000;

/** A notice in the queue, under the id `notify` answered for it. */
interface QueuedNotice {
  id: number;
  notice: SnackbarNotice;
}

export interface SnackbarProviderProps {
  children: ReactNode;
}

/**
 * The **Snackbar stack** and its queue, mounted once in `App` above the route
 * table, so a notice raised on one route is still there on the next. No portal:
 * `fixed` here has nothing to escape.
 *
 * The queue is an array appended to, so DOM order is oldest-first and the
 * stack's `column-reverse` puts the newest nearest the corner. Ids come off a
 * counter, monotonically increasing; one `setTimeout` per notice is held in a
 * ref keyed by id. `notify` pushes and answers the id; `dismiss(id)` filters
 * and clears the timer, harmless when the filter finds nothing. Both update
 * through functional `setState` and close over no state, so the memoised
 * context value never changes identity. Nothing caps, dedupes or coalesces;
 * every outstanding timer is cleared on unmount.
 *
 * The stack is always mounted, empty or not, and carries no live region and no
 * role of its own: the roles are on the cards alone.
 */
export function SnackbarProvider({ children }: SnackbarProviderProps) {
  const [queue, setQueue] = useState<QueuedNotice[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setQueue((current) => current.filter((queued) => queued.id !== id));
  }, []);

  const notify = useCallback(
    (notice: SnackbarNotice) => {
      const id = nextId.current;
      nextId.current += 1;
      setQueue((current) => [...current, { id, notice }]);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), NOTICE_LIFETIME_MS)
      );
      return id;
    },
    [dismiss]
  );

  useEffect(() => {
    const outstanding = timers.current;
    return () => {
      outstanding.forEach((timer) => clearTimeout(timer));
      outstanding.clear();
    };
  }, []);

  const api = useMemo<SnackbarApi>(
    () => ({ notify, dismiss }),
    [notify, dismiss]
  );

  return (
    <SnackbarContext.Provider value={api}>
      {children}
      <Stack data-testid="snackbar-stack">
        {queue.map(({ id, notice }) => (
          <Slot key={id}>
            <Snackbar
              variant={notice.variant}
              title={notice.title}
              message={notice.message}
              actionLabel={notice.action?.label}
              onAction={notice.action?.onClick}
              onDismiss={() => dismiss(id)}
            />
          </Slot>
        ))}
      </Stack>
    </SnackbarContext.Provider>
  );
}
