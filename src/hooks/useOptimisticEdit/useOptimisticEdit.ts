import { useCallback } from 'react';

/** Writes an update into the record the page is holding, if it is still holding one. */
export type EditRecord<T> = (update: (record: T) => T) => void;

/**
 * One optimistic edit, described by the write that wants making.
 *
 * `T` is the record the page holds. `V` is what travels to the route and comes
 * back from it. `R` is what the edit *costs* — usually the same thing, but not
 * always: marking watched also spends the resume offer, so that edit captures a
 * pair and hands the pair back.
 */
export interface OptimisticEdit<T, V, R> {
  /** What the click asks for. */
  next: V;
  /** Reads what the edit costs off the record, before anything changes. */
  capture: (record: T) => R;
  /** Writes a value into the record on screen. */
  apply: (record: T, value: V) => T;
  /** Puts back what `capture` took. */
  restore: (record: T, previous: R) => T;
  /** The route; answers with the value it stored. */
  save: (id: string, value: V) => Promise<V>;
}

/**
 * The bargain every edit on a detail page keeps with the server: show the new
 * value at once, take the route's echo over what was assumed, and put back what
 * the edit cost if the save is refused. A heart that filled and then quietly
 * stayed filled after a failed save would be claiming something is saved that
 * isn't.
 *
 * Generic over the record the page holds — a movie on the movie page, a series
 * on the series and season pages — because the bargain is about the write, not
 * about what is written into. It moved here from `movie-detail/` when the
 * series feature became its second caller, the rule `api/` follows.
 *
 * **What it puts back is told, not derived.** That is the whole difference from
 * `useOptimisticSave`, which the browse shelves use and which reverts by
 * negating a flag. A rating has eleven values plus an absence, and `!value` has
 * nothing to say about any of them — so the caller names what the edit costs
 * (`capture`) and how to hand it back (`restore`), and both are ordinary values
 * rather than something inferred from the one being written.
 *
 * The second difference is what each one edits: this hook edits the single
 * record a page is holding, `useOptimisticSave` edits a movie by id wherever a
 * screen holds a card for it. **The two stay two** — a hook general enough for
 * both would be parameterised over both axes at once, and neither caller is
 * asking for that. The decision is argued in full on `useOptimisticSave`, where
 * `07-ratings-refactor` left the question.
 *
 * Every write goes through `editRecord` and none around it. That guard is what
 * stops a save answering after the page has moved on — a retry, a different
 * record — from resurrecting one the state has already dropped.
 *
 * A `null` is a value here like any other, never an absence: a rating cleared to
 * `null` and echoed back as `null` is a successful clear, and the reconcile
 * compares it by identity rather than asking whether it is falsy. What counts as
 * a *missing* answer is the wire's business (see `postValue`), settled before
 * the promise this hook is handed ever resolves.
 */
export function useOptimisticEdit<T extends { id: string }>(
  record: T | null,
  editRecord: EditRecord<T>
): <V, R>(edit: OptimisticEdit<T, V, R>) => void {
  return useCallback(
    <V, R>({
      next,
      capture,
      apply,
      restore,
      save,
    }: OptimisticEdit<T, V, R>) => {
      if (record === null) {
        return;
      }

      // What the edit costs, read before it costs it.
      const previous = capture(record);

      editRecord((current) => apply(current, next));

      save(record.id, next)
        // The route echoes what it stored; trust that over what we assumed.
        .then((saved) => {
          if (saved !== next) {
            editRecord((current) => apply(current, saved));
          }
        })
        .catch(() => {
          editRecord((current) => restore(current, previous));
        });
    },
    [record, editRecord]
  );
}
