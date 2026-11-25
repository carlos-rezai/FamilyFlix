// @vitest-environment node
//
// 76, Whole add, Phase 4 (issue #719): the Film folder read.
//
// `readFilmFolder(video)` reads `readTitleFolder(dirname(video))`. When that
// reads as a `film` whose videos include the picked one, it answers the
// film's **Poster**, **Backdrop** and tracks (path and language). A folder of
// two videos still answers its art and tracks. A series, a left-out folder
// and an unreadable one answer all empty.
//
// Against real trees under `sandboxRoot`.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { readFilmFolder } from './readFilmFolder';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';

/** A folder under `root`, holding the files named. */
function folderWith(root: string, path: string, files: string[]): string {
  const dir = join(root, path);
  mkdirSync(dir, { recursive: true });
  for (const file of files) {
    writeFileSync(join(dir, file), `${file} bytes`);
  }
  return dir;
}

const EMPTY = { poster: null, backdrop: null, subtitles: [] };

/** `Heat (1995)/` holding `videos`, its art and two tracks. */
function heat(videos: string[]): string {
  const film = folderWith(
    sandboxRoot('familyflix-film-folder-'),
    'Heat (1995)',
    videos
  );
  folderWith(film, 'Images', ['poster.jpg', 'backdrop.jpg']);
  folderWith(film, 'Subtitles', ['Heat.en.srt', 'Heat.pt.srt']);
  return film;
}

/** What `film`'s art and tracks read as. */
const heatRead = (film: string) => ({
  poster: join(film, 'Images', 'poster.jpg'),
  backdrop: join(film, 'Images', 'backdrop.jpg'),
  subtitles: [
    { path: join(film, 'Subtitles', 'Heat.en.srt'), language: 'English' },
    { path: join(film, 'Subtitles', 'Heat.pt.srt'), language: 'Portuguese' },
  ],
});

describe('readFilmFolder', () => {
  it('answers the film’s poster, backdrop and tracks', async () => {
    const film = heat(['Heat.mkv']);

    expect(await readFilmFolder(join(film, 'Heat.mkv'))).toEqual(
      heatRead(film)
    );
  });

  it('still answers the art and tracks of a folder of two videos', async () => {
    const film = heat(['Heat.mkv', 'Heat.Directors.Cut.mkv']);

    expect(await readFilmFolder(join(film, 'Heat.mkv'))).toEqual(
      heatRead(film)
    );
  });

  it('answers empty for a video the film’s folder does not hold', async () => {
    const film = heat(['Heat.mkv']);

    expect(await readFilmFolder(join(film, 'Elsewhere.mkv'))).toEqual(EMPTY);
  });

  it('answers nulls and no tracks for a film with none', async () => {
    const film = folderWith(
      sandboxRoot('familyflix-film-folder-'),
      'Heat (1995)',
      ['Heat.mkv']
    );

    expect(await readFilmFolder(join(film, 'Heat.mkv'))).toEqual(EMPTY);
  });

  // A series' video lies in a **Season folder**, whose own `Images/` and
  // `Subtitles/` are a season's, never a film's.
  it('answers empty for a video in a series’ Season folder', async () => {
    const show = join(
      sandboxRoot('familyflix-film-folder-'),
      'The Show (2019)'
    );
    const season = folderWith(show, 'Season 01', ['The.Show.S01E01.mkv']);
    folderWith(show, 'Images', ['poster.jpg', 'backdrop.jpg']);
    folderWith(season, 'Images', ['poster.jpg']);
    folderWith(season, 'Subtitles', ['The.Show.S01E01.en.srt']);

    expect(await readFilmFolder(join(season, 'The.Show.S01E01.mkv'))).toEqual(
      EMPTY
    );
  });

  it('answers empty for a video in a left-out folder', async () => {
    const film = heat(['Heat.mkv']);
    folderWith(film, 'Season 01', ['Heat.S01E01.mkv']);

    expect(await readFilmFolder(join(film, 'Heat.mkv'))).toEqual(EMPTY);
  });

  it('answers empty for a folder that cannot be read', async () => {
    const gone = join(sandboxRoot('familyflix-film-folder-'), 'Gone (1999)');

    expect(await readFilmFolder(join(gone, 'Gone.mkv'))).toEqual(EMPTY);
  });
});
