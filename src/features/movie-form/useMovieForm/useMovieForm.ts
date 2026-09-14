import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { fetchMovie } from '@/api/fetchMovie/fetchMovie';
import { useGoBack } from '@/hooks/useGoBack/useGoBack';
import type { MovieFormValues } from '@/types';
import {
  dismissProblem,
  fetchProblem,
  resolveProblem,
} from '../../import-export/api/api';
import { createMovie, updateMovie } from '../api/api';
import {
  movieFormValues,
  pickedFile,
  problemFormValues,
} from '../formValues/formValues';

/** Where a finished add lands — the shelf the film has just joined. */
const AFTER_ADD = '/';

/** Where a finished edit lands — the page the correction is now visible on. */
const afterEdit = (id: string) => `/movie/${id}`;

/**
 * Where every exit from the **Import context** lands — _Save & continue_,
 * _Skip this one_ and Back alike: the **Review step**, one row shorter or not.
 * Never the screen behind the form, because the review is where the maintainer
 * was and where the rest of the list still is.
 */
const AFTER_RESOLVE = '/import';

/**
 * The query parameter that says which movie this screen is amending.
 *
 * There is no `/edit` route: COMPONENT-SPEC §6's `editMovie()` reuses this
 * screen, and the detail page's **Edit details** menu item has linked here
 * since #26. One URL, two jobs.
 */
const MOVIE_PARAM = 'movie';

/**
 * The query parameter that says which **Problem** this screen is resolving —
 * the **Review step**'s _Resolve_ lands on `/add?problem=<id>`. The third job
 * of the same URL.
 */
const PROBLEM_PARAM = 'problem';

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
  /**
   * The title of the **Problem** this screen is resolving, for the accent
   * banner — or `null` outside the **Import context**. What the labels, the
   * save's route and every exit's destination are decided from.
   */
  resolving: string | null;
  /** Write the movie, and leave for the screen it is now visible on. */
  save: () => void;
  /**
   * The back pill: the app's one Back rule — except in the **Import context**,
   * where it lands on the review. Writes nothing, dismisses nothing.
   */
  back: () => void;
  /**
   * The secondary button: Cancel, which is {@link back} — or, in the **Import
   * context**, _Skip this one_: dismiss the problem, then land on the review.
   */
  cancel: () => void;
}

/**
 * Everything the **Movie form** does: what is typed, what may be typed, whether
 * Save can be pressed, and where the screen goes when it has been.
 *
 * **The gate is a disabled button, never a message.** `title` is `NOT NULL`, so
 * the only invalid state this form can reach is one where Save cannot be
 * pressed — which is a state the prototype's own `disabled` prop already draws,
 * rather than an error surface nothing designed. It lives here, in one place:
 * a title and a film are one condition rather than two conditions in two
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
 *
 * **`?problem=<id>` is the third job — the Import context** (#130). The
 * **Problem detail** it names is read into the fields and the **File slots**
 * as **Found files**; Save is _Save & continue_ and posts to the problem's own
 * resolve route, the secondary button is _Skip this one_ and dismisses, and
 * every exit lands on the review. A problem that is gone falls back to adding,
 * as a gone movie does. The gate is the same gate: a title and a film, and a
 * found film is a film.
 *
 * ---
 *
 * **Why this file has no `useMovieForm.test.ts`**, asked and settled in the
 * #109 refactor round rather than left unexamined. It is the largest unit in
 * `src/` without a test of its own, which is a fair thing to notice and the
 * wrong thing to fix here.
 *
 * Everything this hook returns is a thing a maintainer *presses*, and
 * `MovieForm.test.tsx` presses all of it: 129 tests over 22 blocks covering
 * every field and its save, the **Save gate** at each slot that could move it,
 * the rating picker, the three kinds of file, both jobs the screen does, the
 * **Stored file** passthrough, and a refused save leaving the form as it was.
 * There is no member of {@link UseMovieFormResult} those do not reach.
 *
 * A test file here would have to drive the hook through `renderHook` and assert
 * on the record it returns — which is asserting the shape of the seam between
 * this file and one component, rather than anything the family or the
 * maintainer can observe. That is the coupled kind of test: it would break on a
 * rename that changed no behaviour, and it would not have caught anything the
 * component's tests do not already catch.
 *
 * The line to watch is not the length. **If a second component ever calls this
 * hook**, its behaviour stops being fully observable through `MovieForm` and it
 * has earned a test file of its own — and so it would if a branch appeared here
 * that no press can reach.
 */
export function useMovieForm(): UseMovieFormResult {
  const navigate = useNavigate();
  const goBack = useGoBack();
  const [searchParams] = useSearchParams();
  const [values, setValues] = useState<MovieFormValues>(EMPTY);
  const [saving, setSaving] = useState(false);

  /** The movie this screen is amending, once its record has been read back. */
  const [editing, setEditing] = useState<string | null>(null);

  /** The problem this screen is resolving, once its detail has been read. */
  const [resolving, setResolving] = useState<{
    id: string;
    title: string;
  } | null>(null);

  const requested = searchParams.get(MOVIE_PARAM);
  const problem = searchParams.get(PROBLEM_PARAM);

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

  // The **Import context**, read the same way: the detail is what fills the
  // fields and the slots, once. A problem that is gone — `null`, the `404` —
  // is a stale link, and the screen falls back to adding, which is story 94;
  // so does a detail that could not be read, on the record's own precedent.
  useEffect(() => {
    if (problem === null) {
      setResolving(null);
      return;
    }

    let current = true;

    fetchProblem(problem)
      .then((detail) => {
        if (!current || detail === null) {
          return;
        }
        setValues(problemFormValues(detail));
        setResolving({ id: detail.id, title: detail.title });
      })
      .catch(() => undefined);

    return () => {
      current = false;
    };
  }, [problem]);

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
      video: pickedFile(file),
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
      poster: pickedFile(file),
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
          file: pickedFile(file),
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
    // _Save & continue_ is the resolve route's, and the route dismisses the
    // problem on its own `201` — nothing here does. The review is where the
    // save lands, one row shorter.
    const written =
      resolving !== null
        ? resolveProblem(resolving.id, values).then(() =>
            navigate(AFTER_RESOLVE)
          )
        : editing === null
          ? createMovie(values).then(() => navigate(AFTER_ADD))
          : updateMovie(editing, values).then(() =>
              navigate(afterEdit(editing))
            );

    // The form is still on screen with everything typed still in it, and Save
    // is offered again. Nothing else is said, because there is nothing yet to
    // say it with.
    written.catch(() => setSaving(false));
  }, [canSave, values, navigate, editing, resolving]);

  // Back never writes and never dismisses: a maintainer stepping back from a
  // half-fixed row finds it still in the list. In the **Import context** the
  // list is where they go — whatever the history says was behind the form.
  const back = useCallback(() => {
    if (resolving === null) {
      goBack();
      return;
    }
    navigate(AFTER_RESOLVE);
  }, [resolving, goBack, navigate]);

  // _Skip this one_ is the review row's own Skip, from the form: dismiss, then
  // the review. A dismiss that failed still lands there — the row is still
  // listed, which is the honest picture — and there is nothing yet to say it
  // with.
  const cancel = useCallback(() => {
    if (resolving === null) {
      goBack();
      return;
    }
    dismissProblem(resolving.id)
      .catch(() => undefined)
      .then(() => navigate(AFTER_RESOLVE));
  }, [resolving, goBack, navigate]);

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
    resolving: resolving === null ? null : resolving.title,
    save,
    back,
    cancel,
  };
}
