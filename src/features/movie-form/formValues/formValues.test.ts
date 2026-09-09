import { describe, it, expect } from 'vitest';

import type { Movie, MovieFormValues } from '@/types';
import { makeMovie } from '@/test-support/makeMovie/makeMovie';

import { movieFormValues, movieFormData } from './formValues';

/**
 * The round trip that makes editing correct: a **Movie** in, a
 * `MovieFormValues` out, a `FormData` out of that.
 *
 * Both directions live in this one folder because the round trip is the unit,
 * for `castNames`' own recorded reason. The form is the only screen in the app
 * that reads a stored record back into the box it was typed into, and two
 * folders could disagree about what a **Stored file** is.
 *
 * **The passthrough is the point.** A stored file travels as the relative path
 * it already has, and a picked one travels as bytes in a part — which is what
 * makes an edit that touches only the title carry no bytes at all. On a 12 GB
 * film that is the difference between instant and minutes, and it is decided
 * here rather than at the wire, where there would be nothing pure left to
 * assert it on.
 *
 * Everything below is asserted on the `FormData` the platform actually
 * encodes — the same object `fetch` is handed — so what is under test is the
 * body that goes out, never a shape invented to describe it.
 */

/** A film that already has every field the form collects filled in. */
const STORED: Movie = makeMovie({
  id: 'a1',
  title: 'The Lantern Keeper',
  year: 2019,
  director: 'Ana Sørensen',
  cast: ['Marit Holt', 'Peder Vinge'],
  synopsis: 'A keeper on a fading coast takes in a runaway girl.',
  rating: 7,
  videoPath: 'the-lantern-keeper-2019/lantern.mp4',
  posterPath: 'the-lantern-keeper-2019/poster.jpg',
  genres: [
    { id: 'g3', name: 'Drama' },
    { id: 'g1', name: 'Action' },
  ],
  subtitles: [
    {
      id: 's1',
      path: 'the-lantern-keeper-2019/lantern.en.srt',
      language: 'English',
      position: 0,
    },
    {
      id: 's2',
      path: 'the-lantern-keeper-2019/lantern.pt.srt',
      language: 'Portuguese',
      position: 1,
    },
  ],
});

/** A film off the maintainer's own disk, as the browser hands it over. */
const pickedFile = (name = 'new-lantern.mp4') =>
  new File(['video bytes'], name, { type: 'video/mp4' });

/** Everything sent under one name, in the order the parts were appended. */
const sent = (body: FormData, name: string) => body.getAll(name);

/** The one value a single-valued field carries. */
const field = (body: FormData, name: string) => body.get(name);

/**
 * Every part of the body that carries bytes rather than a value.
 *
 * The three names are named rather than the body walked, because `dom.iterable`
 * is not in this project's `lib` — and naming them is the stronger assertion
 * anyway: these are the only three parts this form can ever put bytes in, so a
 * fourth appearing is a change to the encoding rather than something a
 * general-purpose walk should quietly absorb.
 */
const fileParts = (body: FormData): File[] =>
  ['video', 'poster', 'subtitle']
    .flatMap((name) => body.getAll(name))
    .filter((value): value is File => value instanceof File);

describe('movieFormValues', () => {
  it('puts every metadata field back in the box it was typed into', () => {
    const values = movieFormValues(STORED);

    // Story 46: editing one field does not mean retyping the rest. The year is
    // text here because the field is — a half-typed year is `'19'`, and the
    // form has never held it as a number.
    expect(values.title).toBe('The Lantern Keeper');
    expect(values.year).toBe('2019');
    expect(values.director).toBe('Ana Sørensen');
    expect(values.description).toBe(
      'A keeper on a fading coast takes in a runaway girl.'
    );
  });

  it('writes the stored cast back out as the line it was typed as', () => {
    // `castText`'s direction, called from here rather than spelled again: the
    // comma rule exists in exactly one place in the app.
    expect(movieFormValues(STORED).cast).toBe('Marit Holt, Peder Vinge');
  });

  it('keeps the genres in the order the record stores them', () => {
    // `genres[0]` is the primary tag the repository has preserved since #3, and
    // an edit that re-sorted them into the pool's order would silently re-file
    // the movie.
    expect(movieFormValues(STORED).genres).toEqual(['Drama', 'Action']);
  });

  it('reads the rating back as the percent the picker speaks', () => {
    // The column stores 0–10 units and every star strip in the app fills
    // against 0–100. The conversion happens once at each end, and this is the
    // end coming in.
    expect(movieFormValues(STORED).rating).toBe(70);
  });

  it('leaves an unrated movie unrated rather than scoring it nought', () => {
    const values = movieFormValues(makeMovie({ rating: null }));

    // Story 58, read the other way: "I have not decided" and "nought out of
    // five" are two different claims, and a prefill that flattened one into the
    // other would score every unrated film in the library the moment its title
    // was corrected.
    expect(values.rating).toBeNull();
  });

  it('takes an empty field for every optional column the movie has nothing in', () => {
    const values = movieFormValues(
      makeMovie({ year: null, director: null, synopsis: null, cast: [] })
    );

    // A `null` column is an empty box, never the string "null" and never a
    // stray comma — the field has to be one a maintainer can type straight
    // into.
    expect(values.year).toBe('');
    expect(values.director).toBe('');
    expect(values.description).toBe('');
    expect(values.cast).toBe('');
  });

  it('puts the stored film in the video slot as a stored file', () => {
    const values = movieFormValues(STORED);

    // Story 51: the movie's files are listed by filename, so it is visible what
    // is attached before anything changes. The path is what travels; the
    // basename is what the slot shows, because a browser would never give a
    // path for a picked file either.
    expect(values.video).toEqual({
      kind: 'stored',
      path: 'the-lantern-keeper-2019/lantern.mp4',
      filename: 'lantern.mp4',
    });
  });

  it('puts the stored artwork in the poster slot the same way', () => {
    expect(movieFormValues(STORED).poster).toEqual({
      kind: 'stored',
      path: 'the-lantern-keeper-2019/poster.jpg',
      filename: 'poster.jpg',
    });
  });

  it('leaves the poster slot empty for a film with no artwork', () => {
    // `poster_path` is nullable and a film with no artwork is a normal row, so
    // an empty slot is a complete answer rather than a missing one.
    expect(movieFormValues(makeMovie({ posterPath: null })).poster).toBeNull();
  });

  it('leaves the video slot empty for a row with no film behind it', () => {
    // The rows Phases 1 and 2 could write: `video_path` is `NOT NULL`, so they
    // carry `''`. An empty string is not a file, and a slot showing one would
    // offer to send a path that names nothing.
    expect(movieFormValues(makeMovie({ videoPath: '' })).video).toBeNull();
  });

  it('puts the stored tracks back as rows, in track order', () => {
    const values = movieFormValues(STORED);

    // `position` is what `preferredSubtitle` falls back through, so the order
    // the rows come back in is the order the family already has.
    expect(values.subtitles.map((row) => [row.language, row.file])).toEqual([
      [
        'English',
        {
          kind: 'stored',
          path: 'the-lantern-keeper-2019/lantern.en.srt',
          filename: 'lantern.en.srt',
        },
      ],
      [
        'Portuguese',
        {
          kind: 'stored',
          path: 'the-lantern-keeper-2019/lantern.pt.srt',
          filename: 'lantern.pt.srt',
        },
      ],
    ]);
  });

  it('gives every row a key of its own', () => {
    const keys = movieFormValues(STORED).subtitles.map((row) => row.key);

    // The rows are held by key rather than by index because a removal
    // re-orders what is left. Two stored rows sharing one would hand a removed
    // row's language to whatever moved up into its place.
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.every((key) => key !== '')).toBe(true);
  });
});

describe('movieFormData', () => {
  /** The form as it stands after {@link STORED} has been read back into it. */
  const prefilled = (): MovieFormValues => movieFormValues(STORED);

  it('sends every single-valued field, including the ones left empty', () => {
    const body = movieFormData({
      ...prefilled(),
      year: '',
      director: '',
      description: '',
    });

    // A field that vanished when it was cleared could not say a year had been
    // *removed* — which is the whole of what an edit needs the empty string
    // for. The server reads `''` as "not given".
    expect(field(body, 'title')).toBe('The Lantern Keeper');
    expect(field(body, 'year')).toBe('');
    expect(field(body, 'director')).toBe('');
    expect(field(body, 'description')).toBe('');
  });

  it('sends the rating in the units the column stores', () => {
    // 70% is 7, converted once, here — no second rating representation exists
    // between the strip and the row.
    expect(field(movieFormData(prefilled()), 'rating')).toBe('7');
  });

  it('sends an unrated movie as an empty rating rather than as no field', () => {
    const body = movieFormData({ ...prefilled(), rating: null });

    // `year`'s reason over the one column where getting it wrong *scores* the
    // film instead of erasing a word of it: an absent field could not say a
    // rating had been cleared, and `0` is a real point on the half-star scale.
    expect(field(body, 'rating')).toBe('');
  });

  it('sends one part per genre, in the order they were picked', () => {
    expect(sent(movieFormData(prefilled()), 'genre')).toEqual([
      'Drama',
      'Action',
    ]);
  });

  it('sends one part per cast member, resolved from the typed line', () => {
    const body = movieFormData({
      ...prefilled(),
      cast: 'Marit Holt, Peder Vinge , ',
    });

    // The comma rule is resolved on the way out, so the wire carries the names
    // rather than the typing — and the trailing comma a maintainer left behind
    // is not a nameless cast member.
    expect(sent(body, 'cast')).toEqual(['Marit Holt', 'Peder Vinge']);
  });

  it('sends a stored film as its path and no bytes at all', () => {
    const body = movieFormData(prefilled());

    // The passthrough, and the whole reason this unit exists: the file the
    // library already holds travels as the relative path it already has.
    expect(field(body, 'videoPath')).toBe(
      'the-lantern-keeper-2019/lantern.mp4'
    );
    expect(sent(body, 'video')).toEqual([]);
  });

  it('sends a picked film as bytes and no path', () => {
    const file = pickedFile();
    const body = movieFormData({
      ...prefilled(),
      video: { kind: 'picked', file, filename: file.name },
    });

    // The other arm of the same union: a browser gives a name and bytes and
    // never a path, so the bytes are the only thing there is to send.
    expect(sent(body, 'video')).toEqual([file]);
    expect(field(body, 'videoPath')).toBeNull();
  });

  it('sends a stored poster as its path, and a picked one as bytes', () => {
    const stored = movieFormData(prefilled());
    expect(field(stored, 'posterPath')).toBe(
      'the-lantern-keeper-2019/poster.jpg'
    );
    expect(sent(stored, 'poster')).toEqual([]);

    const file = pickedFile('new-poster.jpg');
    const picked = movieFormData({
      ...prefilled(),
      poster: { kind: 'picked', file, filename: file.name },
    });
    expect(sent(picked, 'poster')).toEqual([file]);
    expect(field(picked, 'posterPath')).toBeNull();
  });

  it('sends nothing at all for a slot that is empty', () => {
    const body = movieFormData({ ...prefilled(), video: null, poster: null });

    // An empty slot is neither a path nor bytes. What the *route* makes of a
    // slot that said nothing is its own business; this end simply has nothing
    // to say.
    expect(sent(body, 'video')).toEqual([]);
    expect(sent(body, 'videoPath')).toEqual([]);
    expect(sent(body, 'poster')).toEqual([]);
    expect(sent(body, 'posterPath')).toEqual([]);
  });

  it('sends a language and a path for every track row, in row order', () => {
    const body = movieFormData(prefilled());

    // The pairwise rule the POST already had, grown by one column: the i-th
    // language and the i-th path belong to the i-th row, and the order is the
    // track order the family gets.
    expect(sent(body, 'subtitleLanguage')).toEqual(['English', 'Portuguese']);
    expect(sent(body, 'subtitlePath')).toEqual([
      'the-lantern-keeper-2019/lantern.en.srt',
      'the-lantern-keeper-2019/lantern.pt.srt',
    ]);
    expect(sent(body, 'subtitle')).toEqual([]);
  });

  it('holds a picked row’s place with an empty path and sends its bytes in step', () => {
    const values = prefilled();
    const file = pickedFile('lantern.nl.srt');
    const body = movieFormData({
      ...values,
      subtitles: [
        values.subtitles[0],
        {
          key: 'k-new',
          file: { kind: 'picked', file, filename: file.name },
          language: 'Dutch',
        },
        values.subtitles[1],
      ],
    });

    // A mixed list is the case a second part name could not carry: fields and
    // file parts are read back separately, so the picked row's place in the
    // order has to be held by something. The empty path is that placeholder,
    // and the bytes arrive in row order beside it.
    expect(sent(body, 'subtitleLanguage')).toEqual([
      'English',
      'Dutch',
      'Portuguese',
    ]);
    expect(sent(body, 'subtitlePath')).toEqual([
      'the-lantern-keeper-2019/lantern.en.srt',
      '',
      'the-lantern-keeper-2019/lantern.pt.srt',
    ]);
    expect(sent(body, 'subtitle')).toEqual([file]);
  });

  it('sends no track fields at all for a film with no tracks', () => {
    const body = movieFormData({ ...prefilled(), subtitles: [] });

    expect(sent(body, 'subtitleLanguage')).toEqual([]);
    expect(sent(body, 'subtitlePath')).toEqual([]);
    expect(sent(body, 'subtitle')).toEqual([]);
  });
});

describe('the round trip', () => {
  it('carries no bytes at all when nothing was re-picked', () => {
    const body = movieFormData(movieFormValues(STORED));

    // The acceptance criterion the whole slice is demoable on: fix a typo in a
    // title on a 12 GB film, and the save returns instantly with nothing moved
    // on disk. A stored film, a stored poster and two stored tracks between
    // them put not one file part on the wire.
    expect(fileParts(body)).toEqual([]);
  });

  it('carries only what was re-picked when something was', () => {
    const values = movieFormValues(STORED);
    const file = pickedFile('better-poster.jpg');
    const body = movieFormData({
      ...values,
      poster: { kind: 'picked', file, filename: file.name },
    });

    // The contrast that makes the absence above mean something: one slot
    // re-picked is one file part, and the film beside it still does not move.
    expect(fileParts(body)).toEqual([file]);
  });
});
