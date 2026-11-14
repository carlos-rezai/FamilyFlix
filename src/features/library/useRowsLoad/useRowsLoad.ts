import { useCallback, useRef } from 'react';

import {
  useBrowseLoad,
  type BrowseLoadStatus,
} from '../useBrowseLoad/useBrowseLoad';
import { useOptimisticSave } from '../useOptimisticSave/useOptimisticSave';

/** One title's favorite value set everywhere a payload carries it. */
export type WithHeart<T> = (payload: T, id: string, favorite: boolean) => T;

export interface RowsLoadResult<T> {
  status: BrowseLoadStatus;
  /** The held payload, every save in flight laid over it; `null` until one lands. */
  data: T | null;
  /** Re-run the load after a failure. */
  retry: () => void;
  /** Save one title's favorite flag, showing the new value immediately. */
  toggleFavorite: (id: string, favorite: boolean) => void;
}

/**
 * A **By genre** body's **Browse load**, and the heart that settles it: the
 * rows `useMovieRows` and `useSeriesRows` both hold. Over {@link useBrowseLoad}
 * and its **Load key**, it owns the one edit the rows can take, the favorite
 * heart, because the optimistic value and the loaded rows are the same state.
 * The heart fills before the save is confirmed and reverts if the save fails,
 * so it never claims something is saved that isn't.
 *
 * A heart puts its card at the front of the shelf, which is not where the
 * server's sort or its cap of 15 would put it, so once the route has it the
 * rows are read again and the shelf settles where it belongs, behind the
 * skeleton latch so nothing on screen moves but the shelf. The reload waits for
 * every save still in flight. An un-heart and a refused heart need no reload:
 * the card only leaves, or never came.
 *
 * A load answers with what the server held when it read, which can be from
 * before a save still in flight, so each title's newest pending value is laid
 * back over every answer, and a heart pressed while a reload was out survives
 * the reload landing. A confirmed save writes its value back into what is held
 * for the same reason.
 *
 * `withHeart` sets one title's value everywhere the payload carries it; it
 * should be a module function, since it is read on every answer.
 */
export function useRowsLoad<T>(
  load: () => Promise<T>,
  key: string,
  withHeart: WithHeart<T>,
  save: (id: string, favorite: boolean) => Promise<boolean>
): RowsLoadResult<T> {
  // Each title's newest save still waiting on the route: the value it asked
  // for, and a token telling it from a save it overtook.
  const pending = useRef(
    new Map<string, { favorite: boolean; token: object }>()
  );
  // Every save on the wire, an overtaken one included: the count the reload
  // waits on, where `pending` holds only each title's newest value.
  const inFlight = useRef(0);
  const reloadWanted = useRef(false);

  const { status, data, setData, retry } = useBrowseLoad(
    () =>
      load().then((payload) =>
        [...pending.current].reduce(
          (held, [id, { favorite }]) => withHeart(held, id, favorite),
          payload
        )
      ),
    key
  );

  /**
   * Applies a favorite value everywhere the payload carries the title, inside
   * a single `setData`, so every card of one title flips on the same render.
   * Nothing is ever removed: an un-hearted title stays on the shelf with its
   * flag false, so a refused save has a card to flip back.
   */
  const applyFavorite = useCallback(
    (id: string, favorite: boolean) =>
      setData((current) =>
        current === null ? current : withHeart(current, id, favorite)
      ),
    [setData, withHeart]
  );

  const saveAndSettle = useCallback(
    async (id: string, favorite: boolean) => {
      const token = {};
      pending.current.set(id, { favorite, token });
      inFlight.current += 1;
      const newest = () => pending.current.get(id)?.token === token;
      try {
        const saved = await save(id, favorite);
        if (saved === favorite && newest()) {
          applyFavorite(id, saved);
        }
        if (favorite && saved) {
          reloadWanted.current = true;
        }
        return saved;
      } finally {
        if (newest()) {
          pending.current.delete(id);
        }
        inFlight.current -= 1;
        if (inFlight.current === 0 && reloadWanted.current) {
          reloadWanted.current = false;
          retry();
        }
      }
    },
    [applyFavorite, retry, save]
  );

  const toggleFavorite = useOptimisticSave(applyFavorite, saveAndSettle);

  return { status, data, retry, toggleFavorite };
}
