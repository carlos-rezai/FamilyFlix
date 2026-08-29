import { useCallback } from 'react';

/**
 * The bargain a browse screen's flags keep with the server: show the new value
 * at once, take the route's echo over what was assumed, and put the old value
 * back if the save is refused. A heart that filled and then quietly stayed
 * filled after a failed save would be claiming something is saved that isn't.
 *
 * `apply` is what writes the value into whatever the screen is holding, and it
 * is the only part that differs between callers. It may write into as many
 * places as that screen holds a card for the one movie: the genre page's flat
 * grid is a single `withFavoriteInList`, and the browse home is `withFavorite`
 * over the genre rows *and* `withFavoriteInList` over the shelf, inside one
 * `setData` — one film's two cards flipping on the same render rather than one
 * behind the other. `save` is the route, which answers with the value it stored.
 *
 * The value is a flag, because the revert is **derived**: `!value`. That is the
 * axis this hook differs from `useOptimisticEdit` on — that one is *told* what
 * to put back, because a rating has eleven values plus an absence and `!value`
 * can express none of them.
 *
 * **The two stay two, and this is where that was decided.**
 * `07-ratings-refactor` deferred the question of whether the browse screens
 * should migrate onto `useOptimisticEdit` to the Favorites feature, and the
 * answer is no. A hook general enough for both would be parameterised over what
 * it edits *and* over how it reverts, and neither caller is asking for that:
 * this one edits a movie by id wherever a screen holds it, that one edits the
 * single movie a page is holding. Two examples are not enough to design a
 * generalisation against, and unlike the three bargains `07` did merge, the
 * second example here is not a third copy of the first.
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
