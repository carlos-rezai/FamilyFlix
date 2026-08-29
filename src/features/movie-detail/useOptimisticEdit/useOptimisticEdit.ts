import { useCallback } from 'react';

import type { MovieDetailModel } from '@/types';

/** Writes an update into the movie the page is holding, if it is still holding one. */
export type EditMovie = (
  update: (movie: MovieDetailModel) => MovieDetailModel
) => void;

/**
 * One optimistic edit, described by the write that wants making.
 *
 * `V` is what travels to the route and comes back from it. `R` is what the edit
 * *costs* — usually the same thing, but not always: marking watched also spends
 * the resume offer, so that edit captures a pair and hands the pair back.
 */
export interface OptimisticEdit<V, R> {
  /** What the click asks for. */
  next: V;
  /** Reads what the edit costs off the movie, before anything changes. */
  capture: (movie: MovieDetailModel) => R;
  /** Writes a value into the movie on screen. */
  apply: (movie: MovieDetailModel, value: V) => MovieDetailModel;
  /** Puts back what `capture` took. */
  restore: (movie: MovieDetailModel, previous: R) => MovieDetailModel;
  /** The route; answers with the value it stored. */
  save: (id: string, value: V) => Promise<V>;
}

/**
 * The bargain every edit on this page keeps with the server: show the new value
 * at once, take the route's echo over what was assumed, and put back what the
 * edit cost if the save is refused. A heart that filled and then quietly stayed
 * filled after a failed save would be claiming something is saved that isn't.
 *
 * **What it puts back is told, not derived.** That is the whole difference from
 * `useOptimisticSave`, which the browse shelves use and which reverts by
 * negating a flag. A rating has eleven values plus an absence, and `!value` has
 * nothing to say about any of them — so the caller names what the edit costs
 * (`capture`) and how to hand it back (`restore`), and both are ordinary values
 * rather than something inferred from the one being written.
 *
 * The second difference is what each one edits: this hook edits the single
 * movie a page is holding, `useOptimisticSave` edits a movie by id wherever a
 * screen holds a card for it. **The two stay two** — a hook general enough for
 * both would be parameterised over both axes at once, and neither caller is
 * asking for that. The decision is argued in full on `useOptimisticSave`, where
 * `07-ratings-refactor` left the question.
 *
 * Every write goes through `editMovie` and none around it. That guard is what
 * stops a save answering after the page has moved on — a retry, a different
 * movie — from resurrecting a movie the state has already dropped.
 *
 * A `null` is a value here like any other, never an absence: a rating cleared to
 * `null` and echoed back as `null` is a successful clear, and the reconcile
 * compares it by identity rather than asking whether it is falsy. What counts as
 * a *missing* answer is the wire's business (see `postValue`), settled before
 * the promise this hook is handed ever resolves.
 */
export function useOptimisticEdit(
  movie: MovieDetailModel | null,
  editMovie: EditMovie
): <V, R>(edit: OptimisticEdit<V, R>) => void {
  return useCallback(
    <V, R>({ next, capture, apply, restore, save }: OptimisticEdit<V, R>) => {
      if (movie === null) {
        return;
      }

      // What the edit costs, read before it costs it.
      const previous = capture(movie);

      editMovie((current) => apply(current, next));

      save(movie.id, next)
        // The route echoes what it stored; trust that over what we assumed.
        .then((saved) => {
          if (saved !== next) {
            editMovie((current) => apply(current, saved));
          }
        })
        .catch(() => {
          editMovie((current) => restore(current, previous));
        });
    },
    [movie, editMovie]
  );
}
