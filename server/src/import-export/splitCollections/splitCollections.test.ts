// @vitest-environment node
//
// "A folder of several films imports only one" (issue #315).
//
// `splitCollections`, pure over the films `groupShows` passes through: a
// **Source folder** whose videos read as two or more different titles is a
// **Collection folder**, and each of its videos becomes a film scan of its
// own — named off the video's stem, holding that one video and the subtitles
// whose names begin with its stem, with no poster and no backdrop (the
// folder's art is the collection's), and marked `collection: true`. A folder
// whose videos collapse to one title once an extras word is dropped — a film
// beside its sample or trailer — stays one scan, by identity, for the
// **Found-file choice**. Order is kept.
//
// Table tests in `groupShows`' style: a scan is built by name under a fixed
// root, and nothing touches the disk.

import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { splitCollections } from './splitCollections';
import { detectSubtitleLanguage } from '../../media/detectSubtitleLanguage/detectSubtitleLanguage';
import type { MovieFolderScan } from '../../media/scanMovieFolder/scanMovieFolder';

const ROOT = join('/', 'library');

/**
 * A scan of the folder `name` under the root, with the folder's own art —
 * `poster.jpg` and `fanart.jpg` — among its images, beside any `extraImages`.
 */
function scan(
  name: string,
  videos: string[],
  subtitles: string[] = [],
  extraImages: string[] = []
): MovieFolderScan {
  const dir = join(ROOT, name);
  return {
    dir,
    name,
    videos: videos.map((video) => join(dir, video)),
    poster: join(dir, 'poster.jpg'),
    backdrop: join(dir, 'fanart.jpg'),
    images: ['fanart.jpg', 'poster.jpg', ...extraImages].map((image) =>
      join(dir, image)
    ),
    subtitles: subtitles.map((file) => ({
      path: join(dir, file),
      language: detectSubtitleLanguage(file),
    })),
  };
}

const STAR_WARS = [
  'Star.Wars.Episode.IV.A.New.Hope.1977.mkv',
  'Star.Wars.Episode.V.The.Empire.Strikes.Back.1980.mkv',
  'Star.Wars.Episode.VI.Return.of.the.Jedi.1983.mkv',
  'Star.Wars.Episode.I.The.Phantom.Menace.1999.mkv',
  'Star.Wars.Episode.II.Attack.of.the.Clones.2002.mkv',
];

describe('splitCollections — a Collection folder', () => {
  it('becomes one film scan per video, in the folder’s order', () => {
    const folder = scan('Star Wars', STAR_WARS);

    const films = splitCollections([folder]);

    expect(films.map((film) => film.videos)).toEqual(
      folder.videos.map((video) => [video])
    );
  });

  it('names each film scan off its video’s stem, in the folder’s dir', () => {
    const folder = scan('Star Wars', STAR_WARS);

    const films = splitCollections([folder]);

    expect(films.map((film) => ({ dir: film.dir, name: film.name }))).toEqual(
      STAR_WARS.map((video) => ({
        dir: folder.dir,
        name: video.slice(0, -'.mkv'.length),
      }))
    );
  });

  it('marks each film scan as from a collection', () => {
    const films = splitCollections([scan('Star Wars', STAR_WARS)]);

    expect(films.every((film) => film.collection === true)).toBe(true);
  });

  it('gives each film no poster and no backdrop', () => {
    const films = splitCollections([scan('Star Wars', STAR_WARS)]);

    expect(
      films.map((film) => ({ poster: film.poster, backdrop: film.backdrop }))
    ).toEqual(STAR_WARS.map(() => ({ poster: null, backdrop: null })));
  });

  // Issue #316: a film's own art beside its video, Plex's and Jellyfin's
  // `<video stem>-poster.*`, is read back as its poster.
  it('gives each film the image named <its stem>-poster as its poster', () => {
    const folder = scan(
      'Alien Films',
      ['Alien.1979.mkv', 'Aliens.1986.mkv'],
      [],
      ['Alien.1979-poster.jpg', 'Aliens.1986-poster.png']
    );

    const films = splitCollections([folder]);

    expect(films.map((film) => film.poster)).toEqual([
      join(folder.dir, 'Alien.1979-poster.jpg'),
      join(folder.dir, 'Aliens.1986-poster.png'),
    ]);
  });

  it('reads <stem>-poster regardless of case', () => {
    const folder = scan(
      'Alien Films',
      ['Alien.1979.mkv', 'Aliens.1986.mkv'],
      [],
      ['ALIEN.1979-Poster.JPG']
    );

    const films = splitCollections([folder]);

    expect(films[0].poster).toBe(join(folder.dir, 'ALIEN.1979-Poster.JPG'));
  });

  it('gives a film with no <stem>-poster image no poster, never the folder’s', () => {
    const folder = scan(
      'Alien Films',
      ['Alien.1979.mkv', 'Aliens.1986.mkv'],
      [],
      ['Alien.1979-poster.jpg']
    );

    const films = splitCollections([folder]);

    expect(films[1].poster).toBeNull();
  });

  it('gives each film the subtitles whose names begin with its stem', () => {
    const folder = scan(
      'Alien Films',
      ['Alien.1979.mkv', 'Aliens.1986.mkv'],
      ['Alien.1979.en.srt', 'Aliens.1986.en.srt', 'Aliens.1986.pt.srt']
    );

    const films = splitCollections([folder]);

    expect(
      films.map((film) => film.subtitles.map((track) => track.path))
    ).toEqual([
      [join(folder.dir, 'Alien.1979.en.srt')],
      [
        join(folder.dir, 'Aliens.1986.en.srt'),
        join(folder.dir, 'Aliens.1986.pt.srt'),
      ],
    ]);
  });

  it('gives a subtitle beginning with no video’s stem to no film', () => {
    const folder = scan(
      'Alien Films',
      ['Alien.1979.mkv', 'Aliens.1986.mkv'],
      ['commentary.srt']
    );

    const films = splitCollections([folder]);

    expect(films.flatMap((film) => film.subtitles)).toEqual([]);
  });

  it('keeps the films around it in order', () => {
    const before = scan('Amelie (2001)', ['Amelie.mp4']);
    const after = scan('Die Hard (1988)', ['Die.Hard.mp4']);

    const films = splitCollections([
      before,
      scan('Alien Films', ['Alien.1979.mkv', 'Aliens.1986.mkv']),
      after,
    ]);

    expect(films.map((film) => film.name)).toEqual([
      'Amelie (2001)',
      'Alien.1979',
      'Aliens.1986',
      'Die Hard (1988)',
    ]);
  });
});

describe('splitCollections — one film with more than one video', () => {
  it.each([
    [['Heat.1995.mkv', 'Heat.1995.sample.mkv']],
    [['Heat.mkv', 'Heat-trailer.mkv']],
    [['Heat (1995).mkv', 'Heat (1995) Extras.mkv']],
    [['Heat.mkv', 'Heat.Featurette.mkv']],
    [['Heat.mkv', 'Heat - Behind the Scenes.mkv']],
    [['Heat.mkv', 'Heat.Deleted.Scenes.mkv']],
  ])('stays one scan, by identity, for %j', (videos) => {
    const folder = scan('Heat (1995)', videos);

    const films = splitCollections([folder]);

    expect(films).toHaveLength(1);
    expect(films[0]).toBe(folder);
  });
});

describe('splitCollections — a folder of one video', () => {
  it('passes through by identity', () => {
    const folder = scan('Die Hard (1988)', ['Die.Hard.mp4']);

    expect(splitCollections([folder])[0]).toBe(folder);
  });
});
