import { useCallback } from 'react';

/**
 * The bargain a browse screen's flags keep with the server: show the new value
 * at once, take the route's echo over what was assumed, and put the old value
 * back if the save is refused. A heart that filled and then quietly stayed
 * filled after a failed save would be claiming something is saved that isn't.
 *
 * `apply` is what writes the value into whatever the screen is holding, and it
 * is the only part that differs between callers — `withFavorite` over genre rows
 * and `withFavoriteInList` over a flat grid are the same bargain over two
 * shapes. `save` is the route, which answers with the value it stored.
 *
 * The value is a flag, because the revert is `!value` — every optimistic save in
 * this feature is a boolean being turned on or off, and the value it goes back
 * to is the other one. A save with more than two values (a resume position, say)
 * has to be told what to put back, and that is a parameter to add when one
 * arrives rather than a generic to carry before then.
 *
 * Both functions must keep their identity across renders — `useCallback` or a
 * module-level function — or the saver returned here changes on every render.
 */
export function useOptimisticSave(
  apply: (id: string, value: boolean) => void,
  save: (id: string, value: boolean) => Promise<boolean>
): (id: string, value: boolean) => void {
  return useCallback(
    (id: string, value: boolean) => {
      apply(id, value);

      save(id, value)
        // The route echoes what it stored; trust that over what we assumed.
        .then((saved) => {
          if (saved !== value) {
            apply(id, saved);
          }
        })
        .catch(() => {
          apply(id, !value);
        });
    },
    [apply, save]
  );
}
