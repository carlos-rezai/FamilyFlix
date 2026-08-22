import { useEffect, useState } from 'react';

/** How long the typing has to stop for before the value settles. */
const DEBOUNCE_MS = 250;

/**
 * A text field that keeps up with the typing while whoever is listening hears
 * it only once the typing has stopped — the app's one debounce, and the only
 * place un-settled input is held.
 *
 * The two halves of a search box pull opposite ways: the field must follow
 * every keystroke, because a box that lags behind the typing feels broken,
 * while everything downstream — a request, a grid, a miss message — wants the
 * **settled** term and would otherwise re-run on every letter. This holds the
 * keystrokes and reports the pause, so a burst of nine costs one write.
 *
 * `settled` is the authority on what the field shows: it seeds the box, and a
 * change to it from outside — Back out of a movie, the logo home — resets the
 * box to match. Following it is not typing, so nothing settles back; a hook
 * answering its own listener would be a write for a value that already changed.
 *
 * A new keystroke abandons the pending settle rather than queueing behind it,
 * so a term on the way to the one the parent meant is never reported at all.
 *
 * `onSettle` is expected to keep its identity between renders (a `useCallback`,
 * or a setter from a query hook); a fresh function every render would keep
 * pushing the settle back.
 *
 * @param settled The value the field is currently in agreement with.
 * @param onSettle Told the new value, once, after the typing has stopped.
 * @returns The text to show, and the setter every keystroke calls.
 */
export function useSettledText(
  settled: string,
  onSettle: (value: string) => void
): [string, (value: string) => void] {
  const [text, setText] = useState(settled);

  // Whoever holds the settled value is in charge of what the field says —
  // including a change this hook didn't cause.
  useEffect(() => {
    setText(settled);
  }, [settled]);

  useEffect(() => {
    if (text === settled) {
      return;
    }

    const timer = setTimeout(() => onSettle(text), DEBOUNCE_MS);

    // Another keystroke means the typing hasn't stopped after all — the pending
    // settle is abandoned rather than added to.
    return () => clearTimeout(timer);
  }, [text, settled, onSettle]);

  return [text, setText];
}
