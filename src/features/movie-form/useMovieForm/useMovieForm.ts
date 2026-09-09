import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { fetchMovie } from '@/api/fetchMovie/fetchMovie';
import type { MovieFormValues } from '@/types';
import { createMovie, updateMovie } from '../api/api';
import { movieFormValues } from '../formValues/formValues';

/** Where a finished add lands — the shelf the film has just joined. */
const AFTER_ADD = '/';

/** Where a finished edit lands — the page the correction is now visible on. */
const afterEdit = (id: string) => `/movie/${id}`;

/**
 * The query parameter that says which movie this screen is amending.
 *
 * There is no `/edit` route: COMPONENT-SPEC §6's `editMovie()` reuses this
 * screen, and the detail page's **Edit details** menu item has linked here
 * since #26. One URL, two jobs.
 */
const MOVIE_PARAM = 'movie';

/** The most digits a year can have. */
const YEAR_LENGTH = 4;

/**
 * The language a picked track lands in.
 *
 * Story 27: most of the family folder is English, so the common case is meant
 * to need no second press. It is a default the maintainer can take back on the
 * row itself, never a locked value — and it is the form's decision rather than
 * the card's, which is why it is here and the pool is there.
 */
const DEFAULT_LANGUAGE = 'English';

/** An empty form: what the **Add context** opens on. */
const EMPTY: MovieFormValues = {
  title: '',
  year: '',
  director: '',
  cast: '',
  description: '',
  genres: [],
  // **Unrated**, which is a state the form holds rather than the absence of
  // one — and never `0`, which is a score.
  rating: null,
  // An empty **File slot**, and the half of the gate a title cannot satisfy.
  video: null,
  // The other empty slot, and no part of the gate at all: a film with no
  // artwork to hand still belongs in the library.
  poster: null,
  // No tracks, which is a complete answer rather than a slot left empty: a film
  // in the family's own language needs none.
  subtitles: [],
};

export interface UseMovieFormResult {
  /** What is in the fields right now. */
  values: MovieFormValues;
  setTitle: (title: string) => void;
  setYear: (year: string) => void;
  setDirector: (director: string) => void;
  /** The **Cast** line as typed, commas and all — never the names in it. */
  setCast: (cast: string) => void;
  setDescription: (description: string) => void;
  /** Pick the named genre, or unpick it if it is already picked. */
  toggleGenre: (name: string) => void;
  /** Score the movie, as a percent, or `null` to put it back to **Unrated**. */
  setRating: (rating: number | null) => void;
  /** Put a film the maintainer chose off their own disk into the video slot. */
  pickVideo: (file: File) => void;
  /** Empty the video slot again. */
  removeVideo: () => void;
  /** Put artwork the maintainer chose off their own disk into the poster slot. */
  pickPoster: (file: File) => void;
  /** Empty the poster slot again. */
  removePoster: () => void;
  /** Append a row for a track the maintainer chose off their own disk. */
  addSubtitle: (file: File) => void;
  /** Put the row holding `key` into another language. */
  changeSubtitleLanguage: (key: string, language: string) => void;
  /** Take the row holding `key` off the movie. */
  removeSubtitle: (key: string) => void;
  /** Whether Save can be pressed — the gate, not a validation message. */
  canSave: boolean;
  /** Whether the write is in flight. */
  saving: boolean;
  /**
   * Whether this screen is amending a movie rather than creating one — which
   * is what the heading and the Save button are named from, and where a
   * finished save lands.
   */
  editing: boolean;
  /** Write the movie, and leave for the screen it is now visible on. */
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
 * because it arrived in halves: the title half was all a form with no video slot
 * could check, and the video half landed beside it the moment that slot existed.
 * A title and a film are now one condition rather than two conditions in two
 * places — and it is a condition rather than a latch, so either half can be
 * taken back. **The poster is not a third half**: `poster_path` is nullable, and
 * a film the maintainer has no artwork for still belongs in the library. Nor is
 * a subtitle — a film with no track at all is a normal row, and one attached to
 * nothing else is still not a row this form can write.
 *
 * **Year is text, and cannot be a non-year.** Non-digits are dropped and the
 * field stops at four characters, so there is nothing to validate and nothing to
 * report — a half-typed `'19'` is a legitimate state of a field being filled in,
 * which is exactly why it is not held as a number.
 *
 * **Every field but the title is optional, so none of them is the gate.** A
 * director, a cast and a synopsis are all things a maintainer may not have to
 * hand, and `title` stays the only `NOT NULL` column this form can fill.
 *
 * **Genre is a set the maintainer orders.** A press adds a name to the end or
 * removes it, so the order held is the order picked rather than the pool's —
 * `genres[0]` is the primary tag the repository has preserved since #3, and
 * this is the first caller in the app that can decide what it is. It is no part
 * of the gate: a film may be saved unfiled, and a filed film with no title is
 * still not a row this form can write.
 *
 * **The rating is held as the percent the picker speaks**, and `null` when the
 * stars have not been touched — never `0`, which is a score. The conversion to
 * the units the column stores happens once, at the wire, so no second rating
 * representation exists between the strip and the row. It is no part of the
 * gate either: an unscored film is a normal row.
 *
 * **The subtitles are a list the maintainer orders**, and the only value here
 * held by key rather than by position: a picked file appends a row in English,
 * the language is changed on the row itself, and a removal leaves every
 * surviving row exactly as it was. The order is the track order — `position` is
 * what `preferredSubtitle` falls back through — so the order they were attached
 * in is the order the family gets.
 *
 * **The destination is here rather than in the component**, because leaving is
 * part of what saving means: the browse home is the one place the maintainer can
 * see that the film is really in the library, and a *correction* is only visible
 * on the detail page it was started from — so which screen a save lands on is
 * decided by which job the screen is doing. A *refused* save is the mirror of
 * both — the form stays put with everything still typed in it, which is the only
 * honest answer available until the snackbar system ships.
 *
 * **`?movie=<id>` is the whole of the difference between the two jobs.** With
 * one, the record it names is read back into the fields and Save amends it; with
 * none, the fields open empty and Save creates a row. An id that names no movie
 * is not a record to amend, so the screen falls back to adding — which is also
 * the only state in which its Save could do anything at all.
 */
export function useMovieForm(): UseMovieFormResult {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [values, setValues] = useState<MovieFormValues>(EMPTY);
  const [saving, setSaving] = useState(false);

  /** The movie this screen is amending, once its record has been read back. */
  const [editing, setEditing] = useState<string | null>(null);

  const requested = searchParams.get(MOVIE_PARAM);

  // Read once per id, the way `useGenrePool` reads once per mount: the record
  // is what fills the fields, and asking again would overwrite whatever the
  // maintainer had typed since.
  useEffect(() => {
    if (requested === null) {
      setEditing(null);
      return;
    }

    let current = true;

    fetchMovie(requested)
      .then((movie) => {
        // `null` is a 404 — a stale link rather than a failure — and the screen
        // only knows there is nothing to edit because it looked.
        if (!current || movie === null) {
          return;
        }
        setValues(movieFormValues(movie));
        setEditing(movie.id);
      })
      // A record that could not be read is a form that adds, on `useGenrePool`'s
      // precedent: the prototype designs no error state on this screen, and a
      // half-filled form would be worse than an empty one.
      .catch(() => undefined);

    return () => {
      current = false;
    };
  }, [requested]);

  const setTitle = useCallback((title: string) => {
    setValues((current) => ({ ...current, title }));
  }, []);

  const setYear = useCallback((year: string) => {
    setValues((current) => ({
      ...current,
      year: year.replace(/\D/g, '').slice(0, YEAR_LENGTH),
    }));
  }, []);

  // Held exactly as typed, all three. Only `year` is filtered on its way in,
  // because only `year` is a field that cannot hold a non-value — and the cast
  // in particular must keep the comma just pressed, or the field would delete
  // the separator while the next name is being typed.
  const setDirector = useCallback((director: string) => {
    setValues((current) => ({ ...current, director }));
  }, []);

  const setCast = useCallback((cast: string) => {
    setValues((current) => ({ ...current, cast }));
  }, []);

  const setDescription = useCallback((description: string) => {
    setValues((current) => ({ ...current, description }));
  }, []);

  const setRating = useCallback((rating: number | null) => {
    setValues((current) => ({ ...current, rating }));
  }, []);

  // A browser hands over a name and bytes and never a path, so the `File` is
  // the whole of what there is to hold — and its own name is what the slot
  // shows, because it is the only way to tell the right film from the one
  // beside it in the folder.
  const pickVideo = useCallback((file: File) => {
    setValues((current) => ({
      ...current,
      video: { kind: 'picked', file, filename: file.name },
    }));
  }, []);

  const removeVideo = useCallback(() => {
    setValues((current) => ({ ...current, video: null }));
  }, []);

  // The same two lines for the second slot, because a slot is a slot — what
  // differs between them is what the *route* does with the bytes, and neither
  // this hook nor the card it draws needs to know that.
  const pickPoster = useCallback((file: File) => {
    setValues((current) => ({
      ...current,
      poster: { kind: 'picked', file, filename: file.name },
    }));
  }, []);

  const removePoster = useCallback(() => {
    setValues((current) => ({ ...current, poster: null }));
  }, []);

  // The rows are held by a key of the form's own, handed out here and never
  // reused. Two files can share a name, a name can be picked again after the
  // wrong row was removed, and there is no subtitle id until the save lands —
  // so a counter is the only thing on this screen that is reliably unique.
  const nextKey = useRef(0);

  const addSubtitle = useCallback((file: File) => {
    nextKey.current += 1;
    const key = `subtitle-${nextKey.current}`;
    setValues((current) => ({
      ...current,
      subtitles: [
        ...current.subtitles,
        {
          key,
          file: { kind: 'picked', file, filename: file.name },
          language: DEFAULT_LANGUAGE,
        },
      ],
    }));
  }, []);

  const changeSubtitleLanguage = useCallback(
    (key: string, language: string) => {
      setValues((current) => ({
        ...current,
        subtitles: current.subtitles.map((subtitle) =>
          subtitle.key === key ? { ...subtitle, language } : subtitle
        ),
      }));
    },
    []
  );

  const removeSubtitle = useCallback((key: string) => {
    setValues((current) => ({
      ...current,
      subtitles: current.subtitles.filter((subtitle) => subtitle.key !== key),
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

  const canSave =
    values.title.trim() !== '' && values.video !== null && !saving;

  const save = useCallback(() => {
    if (!canSave) {
      return;
    }

    setSaving(true);
    const written =
      editing === null
        ? createMovie(values).then(() => navigate(AFTER_ADD))
        : updateMovie(editing, values).then(() => navigate(afterEdit(editing)));

    // The form is still on screen with everything typed still in it, and Save
    // is offered again. Nothing else is said, because there is nothing yet to
    // say it with.
    written.catch(() => setSaving(false));
  }, [canSave, values, navigate, editing]);

  return {
    values,
    setTitle,
    setYear,
    setDirector,
    setCast,
    setDescription,
    toggleGenre,
    setRating,
    pickVideo,
    removeVideo,
    pickPoster,
    removePoster,
    addSubtitle,
    changeSubtitleLanguage,
    removeSubtitle,
    canSave,
    saving,
    editing: editing !== null,
    save,
  };
}
