import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Writes one named parameter onto the URL, leaving the rest of the query — and
 * the path — exactly as it found them.
 *
 * @param name The parameter to write.
 * @param value The value to write it as.
 * @param omitAt The value that means "absent": at it, the parameter is removed
 *   rather than written, so a default state is a clean URL with no query
 *   string to explain.
 */
export type QueryParamWriter = (
  name: string,
  value: string,
  omitAt: string
) => void;

/**
 * The mechanic every named setter on a query hook is built from: one parameter
 * at a time, copied off whatever the URL currently holds, so a setter can only
 * ever add, replace or remove its own and two controls can't clobber each
 * other.
 *
 * It knows nothing about *which* parameters exist — that vocabulary belongs to
 * each screen's own query hook, and stays there. `useGenreQuery` builds two
 * setters on this and `useLibraryQuery` four, and neither can be talked into
 * honouring a parameter it has no control to display.
 *
 * Every write is a `replace`. A search settles many times on its way to the
 * term the parent meant, and none of those may cost a press of Back on the way
 * out of the screen.
 *
 * The callback keeps its identity for as long as the URL does, which is what
 * `useSettledText` needs of the setters built on it: a writer that came back
 * fresh each render would keep pushing its 250ms wait back.
 */
export function useQueryParamWriter(): QueryParamWriter {
  const [, setSearchParams] = useSearchParams();

  return useCallback(
    (name: string, value: string, omitAt: string) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          if (value === omitAt) {
            next.delete(name);
          } else {
            next.set(name, value);
          }
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );
}
