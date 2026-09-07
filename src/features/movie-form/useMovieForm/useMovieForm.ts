import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import type { MovieFormValues } from '@/types';
import { createMovie } from '../api/api';

/** Where a finished save lands — the shelf the film has just joined. */
const AFTER_SAVE = '/';

/** The most digits a year can have. */
const YEAR_LENGTH = 4;

/** An empty form: what the **Add context** opens on. */
const EMPTY: MovieFormValues = { title: '', year: '', genres: [] };

export interface UseMovieFormResult {
  /** What is in the fields right now. */
  values: MovieFormValues;
  setTitle: (title: string) => void;
  setYear: (year: string) => void;
  /** Pick the named genre, or unpick it if it is already picked. */
  toggleGenre: (name: string) => void;
  /** Whether Save can be pressed — the gate, not a validation message. */
  canSave: boolean;
  /** Whether the write is in flight. */
  saving: boolean;
  /** Write the movie, and leave for {@link AFTER_SAVE} once it is stored. */
  save: () => void;
}

/**
 * Everything the **Movie form** does: what is typed, what may be typed, whether
 * Save can be pressed, and where the screen goes when it has been.
 *
 * **The gate is a disabled button, never a message.** `title` is `NOT NULL`, so
 * the only invalid state this form can reach is one where Save cannot be
 * pressed — which is a state the prototype's own `disabled` prop already draws,
 * rather than an error surface nothing designed. It lives here, in one place,
 * because it arrives in halves: the title half is all a form with no video slot
 * can check, and the video half lands beside it when that slot exists.
 *
 * **Year is text, and cannot be a non-year.** Non-digits are dropped and the
 * field stops at four characters, so there is nothing to validate and nothing to
 * report — a half-typed `'19'` is a legitimate state of a field being filled in,
 * which is exactly why it is not held as a number.
 *
 * **Genre is a set the maintainer orders.** A press adds a name to the end or
 * removes it, so the order held is the order picked rather than the pool's —
 * `genres[0]` is the primary tag the repository has preserved since #3, and
 * this is the first caller in the app that can decide what it is. It is no part
 * of the gate: a film may be saved unfiled, and a filed film with no title is
 * still not a row this form can write.
 *
 * **The destination is here rather than in the component**, because leaving is
 * part of what saving means: the browse home is the one place the maintainer can
 * see that the film is really in the library. A *refused* save is the mirror of
 * that — the form stays put with everything still typed in it, which is the only
 * honest answer available until the snackbar system ships.
 */
export function useMovieForm(): UseMovieFormResult {
  const navigate = useNavigate();
  const [values, setValues] = useState<MovieFormValues>(EMPTY);
  const [saving, setSaving] = useState(false);

  const setTitle = useCallback((title: string) => {
    setValues((current) => ({ ...current, title }));
  }, []);

  const setYear = useCallback((year: string) => {
    setValues((current) => ({
      ...current,
      year: year.replace(/\D/g, '').slice(0, YEAR_LENGTH),
    }));
  }, []);

  const toggleGenre = useCallback((name: string) => {
    setValues((current) => ({
      ...current,
      genres: current.genres.includes(name)
        ? current.genres.filter((genre) => genre !== name)
        : [...current.genres, name],
    }));
  }, []);

  const canSave = values.title.trim() !== '' && !saving;

  const save = useCallback(() => {
    if (!canSave) {
      return;
    }

    setSaving(true);
    createMovie(values)
      .then(() => navigate(AFTER_SAVE))
      // The form is still on screen with everything typed still in it, and Save
      // is offered again. Nothing else is said, because there is nothing yet to
      // say it with.
      .catch(() => setSaving(false));
  }, [canSave, values, navigate]);

  return { values, setTitle, setYear, toggleGenre, canSave, saving, save };
}
