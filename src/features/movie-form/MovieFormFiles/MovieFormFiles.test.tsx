import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from 'styled-components';

import { MovieFormFiles } from './MovieFormFiles';
import { theme } from '@/styles/theme';
import type { MovieFormFile, MovieFormSubtitle } from '@/types';

/** A film off the maintainer's own disk, as the browser hands it over. */
const LANTERN = new File(['video bytes'], 'lantern.mp4', { type: 'video/mp4' });

/** The artwork beside it in the same folder. */
const ARTWORK = new File(['image bytes'], 'lantern-poster.jpg', {
  type: 'image/jpeg',
});

/** The video slot holding a **Picked file**. */
const PICKED_VIDEO: MovieFormFile = {
  kind: 'picked',
  file: LANTERN,
  filename: 'lantern.mp4',
};

/** The poster slot holding one. */
const PICKED_POSTER: MovieFormFile = {
  kind: 'picked',
  file: ARTWORK,
  filename: 'lantern-poster.jpg',
};

/** What is in the card's slots for one test — an empty one is the default. */
interface Slots {
  video?: MovieFormFile | null;
  poster?: MovieFormFile | null;
  subtitles?: MovieFormSubtitle[];
}

function renderFiles(slots: Slots = {}) {
  const onPickVideo = vi.fn<(file: File) => void>();
  const onRemoveVideo = vi.fn<() => void>();
  const onPickPoster = vi.fn<(file: File) => void>();
  const onRemovePoster = vi.fn<() => void>();
  const onAddSubtitle = vi.fn<(file: File) => void>();
  const onChangeSubtitleLanguage =
    vi.fn<(key: string, language: string) => void>();
  const onRemoveSubtitle = vi.fn<(key: string) => void>();

  render(
    <ThemeProvider theme={theme}>
      <MovieFormFiles
        video={slots.video ?? null}
        poster={slots.poster ?? null}
        subtitles={slots.subtitles ?? []}
        onPickVideo={onPickVideo}
        onRemoveVideo={onRemoveVideo}
        onPickPoster={onPickPoster}
        onRemovePoster={onRemovePoster}
        onAddSubtitle={onAddSubtitle}
        onChangeSubtitleLanguage={onChangeSubtitleLanguage}
        onRemoveSubtitle={onRemoveSubtitle}
      />
    </ThemeProvider>
  );

  return {
    onPickVideo,
    onRemoveVideo,
    onPickPoster,
    onRemovePoster,
    onAddSubtitle,
    onChangeSubtitleLanguage,
    onRemoveSubtitle,
  };
}

const picker = () =>
  screen.getByLabelText(/choose video file/i) as HTMLInputElement;

const posterPicker = () =>
  screen.getByLabelText(/choose poster image/i) as HTMLInputElement;

/**
 * The Files card of the **Movie form** — the panel the prototype draws under
 * the metadata fields, and the two slots this slice puts in it.
 *
 * A feature sibling rather than a molecule, on the player's shape: the organism
 * owns the values and this draws what it is told. It knows which slots a
 * **Movie** has and what each of them offers a file dialog; `FileField` knows
 * how a slot looks, and neither knows what a save is.
 *
 * With the **Subtitle** rows it also knows the **Language pool** — the seven
 * languages a row offers. That is the same kind of knowledge as the accept
 * lists beside it: a display vocabulary this screen owns, which is why
 * `SubtitleRow` is handed the list rather than knowing it.
 */
describe('MovieFormFiles', () => {
  it('draws the Files card the prototype captions', () => {
    renderFiles();

    expect(screen.getByText(/^files$/i)).toBeDefined();
  });

  it('names the video slot', () => {
    renderFiles();

    expect(screen.getByText(/^video$/i)).toBeDefined();
  });

  it('offers an empty slot as a choose button', () => {
    renderFiles();

    expect(picker().type).toBe('file');
    expect(screen.queryByText('lantern.mp4')).toBeNull();
  });

  it('offers the container types a browser will not name', () => {
    renderFiles();

    // Chromium gives MKV and AVI no MIME type at all, so `video/*` alone would
    // grey out most of the family folder in the dialog. This is the one place
    // in the app that knows what a video file may be called.
    const accept = picker().getAttribute('accept') ?? '';
    expect(accept).toContain('video/*');
    expect(accept).toContain('.mkv');
    expect(accept).toContain('.avi');
  });

  it('reports the film that was picked', async () => {
    const { onPickVideo } = renderFiles();

    await userEvent.upload(picker(), LANTERN, { applyAccept: false });

    expect(onPickVideo).toHaveBeenCalledWith(LANTERN);
  });

  it('shows the filename of the film in the slot', () => {
    renderFiles({ video: PICKED_VIDEO });

    // Story 29: the filename is the only way to tell the right film from the
    // one beside it in the folder.
    expect(screen.getByText('lantern.mp4')).toBeDefined();
  });

  it('offers no picker while the slot is filled', () => {
    renderFiles({ video: PICKED_VIDEO });

    expect(screen.queryByLabelText(/choose video file/i)).toBeNull();
  });

  it('reports the removal without emptying the slot itself', () => {
    const { onRemoveVideo } = renderFiles({ video: PICKED_VIDEO });

    fireEvent.click(screen.getByRole('button', { name: /remove video/i }));

    // What is in the slot lives one level up, in the form's values — this says
    // the ✕ was pressed and nothing about what that means.
    expect(onRemoveVideo).toHaveBeenCalledTimes(1);
    expect(screen.getByText('lantern.mp4')).toBeDefined();
  });

  // --- 11 — Movie form, Phase 4: the poster slot (issue #103) ---------------
  //
  // A second instance of the same molecule, and nothing new invented at that
  // rung: if the poster needed anything `FileField` does not have, that would
  // be a sign `FileField` was shaped wrong. What is new here is only what this
  // card knows — that a **Movie** has a second kind of file, and what that one
  // offers a file dialog.

  it('names the poster slot', () => {
    renderFiles();

    expect(screen.getByText(/^poster$/i)).toBeDefined();
  });

  it('offers an empty poster slot as a choose button', () => {
    renderFiles();

    expect(posterPicker().type).toBe('file');
    expect(screen.queryByText('lantern-poster.jpg')).toBeNull();
  });

  it('offers pictures, which a browser does name', () => {
    renderFiles();

    // The mirror of the video slot's list, and the reason that one is long:
    // every image container a poster arrives in has a MIME type, so `image/*`
    // is the whole of what this slot has to say. The server re-checks by
    // extension regardless — an accept list is a convenience, never a
    // guarantee.
    expect(posterPicker().getAttribute('accept')).toBe('image/*');
  });

  it('reports the poster that was picked', async () => {
    const { onPickPoster } = renderFiles();

    await userEvent.upload(posterPicker(), ARTWORK, { applyAccept: false });

    expect(onPickPoster).toHaveBeenCalledWith(ARTWORK);
  });

  it('shows the filename of the poster in its own slot', () => {
    renderFiles({ video: PICKED_VIDEO, poster: PICKED_POSTER });

    // Two filled slots, two filenames: a card that showed one of them would
    // leave the maintainer unable to tell which file went where.
    expect(screen.getByText('lantern.mp4')).toBeDefined();
    expect(screen.getByText('lantern-poster.jpg')).toBeDefined();
  });

  it('reports the poster’s removal and nothing about the film', () => {
    const { onRemovePoster, onRemoveVideo } = renderFiles({
      video: PICKED_VIDEO,
      poster: PICKED_POSTER,
    });

    fireEvent.click(screen.getByRole('button', { name: /remove poster/i }));

    // A column of these reads as a column of identical ✕ buttons to anything
    // that cannot see the row, and the label is the only thing that tells them
    // apart — which is what makes pressing the right one possible at all.
    expect(onRemovePoster).toHaveBeenCalledTimes(1);
    expect(onRemoveVideo).not.toHaveBeenCalled();
  });
});

// --- 11 — Movie form, Phase 4: the subtitle rows (issue #104) -----------------
//
// The third kind of file, and the first slot that is a **list** rather than a
// slot: "＋ Add subtitle file" appends a row, and a film can carry as many as
// the family needs. What is new at this rung is only what the *card* knows —
// that a **Movie** has any number of **Subtitles**, what that picker offers a
// file dialog, and the **Language pool** each row chooses from. How one row
// looks is `SubtitleRow.test.tsx`'s.
//
// **The one behaviour that can only be seen here is two rows at once.** A
// single row cannot show that opening its language list shuts the other's —
// and that is the whole argument for building `SubtitleRow` on `Menu`: it comes
// out of `Menu`'s press-outside dismissal with no coordinating state in this
// card and none in the row.

/** The **Language pool** the prototype's own dropdown offers, in its order. */
const LANGUAGE_POOL = [
  'English',
  'Spanish',
  'French',
  'German',
  'Portuguese',
  'Italian',
  'Dutch',
];

/** An English track off the maintainer's own disk. */
const EN_SRT = new File(['cue bytes'], 'lantern.en.srt', {
  type: 'text/plain',
});

/** The Portuguese one beside it in the same folder. */
const PT_SRT = new File(['cue bytes'], 'lantern.pt.srt', {
  type: 'text/plain',
});

/**
 * One attached **Subtitle**, as the form holds it.
 *
 * The `key` is the form's own and never the persisted subtitle id: rows are
 * removed and re-ordered while the movie is being typed, and there is no id
 * until the save lands.
 */
function attached(
  key: string,
  file: File,
  language = 'English'
): MovieFormSubtitle {
  return {
    key,
    file: { kind: 'picked', file, filename: file.name },
    language,
  };
}

/** Two tracks in two languages — the demoable case of the whole slice. */
const TWO_TRACKS: MovieFormSubtitle[] = [
  attached('s1', EN_SRT, 'English'),
  attached('s2', PT_SRT, 'Portuguese'),
];

/** The "＋ Add subtitle file" picker, offered however many rows already exist. */
const subtitlePicker = () =>
  screen.getByLabelText(/add subtitle file/i) as HTMLInputElement;

/** One row's language control, named after the file it labels. */
const languageOf = (filename: string) =>
  screen.getByRole('button', {
    name: new RegExp(`language for ${filename.replace(/\./g, '\\.')}`, 'i'),
  });

/** Every row of whichever language list is open, by its text. */
const openLanguages = () =>
  screen.queryAllByRole('menuitem').map((row) => row.textContent);

describe('MovieFormFiles — the subtitle rows', () => {
  it('names the subtitles section', () => {
    renderFiles();

    // The prototype's third caption in the Files card, beside Video and Poster.
    expect(screen.getByText(/^subtitles$/i)).toBeDefined();
  });

  it('offers “＋ Add subtitle file” as a file picker', () => {
    renderFiles();

    // Story 24. A row is created by picking a file, so there is never an empty
    // subtitle row to explain — the ＋ *is* the picker, on `FileField`'s own
    // label-over-a-hidden-input design.
    expect(subtitlePicker().type).toBe('file');
  });

  it('offers the four formats the parsers dispatch on', () => {
    renderFiles();

    // Story 28, and the client half of the rule: the same four
    // `parseSubtitle/` knows, because a file the player could never read is not
    // one the dialog should offer. The server re-checks by extension anyway.
    const accept = subtitlePicker().getAttribute('accept') ?? '';
    expect(accept).toContain('.srt');
    expect(accept).toContain('.vtt');
    expect(accept).toContain('.ass');
    expect(accept).toContain('.sub');
  });

  it('reports the subtitle that was picked', async () => {
    const { onAddSubtitle } = renderFiles();

    await userEvent.upload(subtitlePicker(), EN_SRT, { applyAccept: false });

    // The `File` itself, on the other two slots' rule — and what language it
    // lands in is the form's decision, not this card's.
    expect(onAddSubtitle).toHaveBeenCalledWith(EN_SRT);
  });

  it('draws no rows and still offers the picker when nothing is attached', () => {
    renderFiles();

    // Story 64: a film with no subtitles is a normal film, so the section is an
    // add button and nothing else.
    expect(screen.queryByText('lantern.en.srt')).toBeNull();
    expect(subtitlePicker()).toBeDefined();
  });

  it('draws one row per attached subtitle', () => {
    renderFiles({ subtitles: TWO_TRACKS });

    // Story 25. Two files, two rows, two filenames — the maintainer has to be
    // able to tell which track is which before labelling either.
    expect(screen.getByText('lantern.en.srt')).toBeDefined();
    expect(screen.getByText('lantern.pt.srt')).toBeDefined();
  });

  it('shows each row in its own language', () => {
    renderFiles({ subtitles: TWO_TRACKS });

    expect(languageOf('lantern.en.srt').textContent).toContain('English');
    expect(languageOf('lantern.pt.srt').textContent).toContain('Portuguese');
  });

  it('offers the Language pool the prototype draws', () => {
    renderFiles({ subtitles: [attached('s1', EN_SRT)] });

    fireEvent.click(languageOf('lantern.en.srt'));

    // Story 26. The seven are this card's to know — a display vocabulary, not
    // an entity — and `SubtitleRow` is handed them.
    expect(openLanguages()).toEqual(LANGUAGE_POOL);
  });

  it('reports a language change against the row it happened on', () => {
    const { onChangeSubtitleLanguage } = renderFiles({ subtitles: TWO_TRACKS });

    fireEvent.click(languageOf('lantern.pt.srt'));
    fireEvent.click(screen.getByRole('menuitem', { name: 'French' }));

    // The row's own `key`, never its index: the form removes and re-orders
    // rows, and an index would relabel the wrong track the moment one above it
    // went away.
    expect(onChangeSubtitleLanguage).toHaveBeenCalledWith('s2', 'French');
    expect(onChangeSubtitleLanguage).toHaveBeenCalledTimes(1);
  });

  it('reports the removal of the row it happened on', () => {
    const { onRemoveSubtitle } = renderFiles({ subtitles: TWO_TRACKS });

    fireEvent.click(
      screen.getByRole('button', { name: /remove lantern\.en\.srt/i })
    );

    expect(onRemoveSubtitle).toHaveBeenCalledWith('s1');
    expect(onRemoveSubtitle).toHaveBeenCalledTimes(1);
  });

  it('shuts one row’s language list when the next one is opened', () => {
    renderFiles({ subtitles: TWO_TRACKS });

    fireEvent.click(languageOf('lantern.en.srt'));
    expect(openLanguages()).toEqual(LANGUAGE_POOL);

    // A real press: `Menu` dismisses on `pointerdown` rather than on the click,
    // so the first list is gone before the press that dismissed it lands.
    fireEvent.pointerDown(languageOf('lantern.pt.srt'));
    fireEvent.click(languageOf('lantern.pt.srt'));

    // Story 31, and the whole argument for building the row on `Menu`: opening
    // the second list is a press outside the first, which is already what shuts
    // it. Exactly one list is open, with no coordinating state anywhere — so
    // there are seven rows on screen and not fourteen.
    expect(openLanguages()).toEqual(LANGUAGE_POOL);
    expect(languageOf('lantern.en.srt').getAttribute('aria-expanded')).toBe(
      'false'
    );
    expect(languageOf('lantern.pt.srt').getAttribute('aria-expanded')).toBe(
      'true'
    );
  });
});
