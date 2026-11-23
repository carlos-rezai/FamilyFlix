// @vitest-environment node
//
// 72 — Seamless art, Phase 1: "one backdrop, end to end" (issue #686).
//
// TMDB stays at `original` and a Sync's art is fitted on arrival, in the media
// domain: `storeNamed` is the funnel, so a 3840-wide backdrop lands 1920 wide
// and its poster 780 wide, under the names they always had; with no component
// both are stored as given. The Decision row's `w185` candidates are untouched:
// a link to TMDB's own small poster, never downloaded, never fitted.
//
// Over a real in-memory library, a real `Media` whose `fitArt` is scripted,
// and a fake TMDB client whose images are real picture headers.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';

import { ENRICH_FIELDS, type EnrichmentRun } from '@/types';
import { createLayoutFill } from '../../import-export/createLayoutFill/createLayoutFill';
import { createMedia } from '../../media/createMedia/createMedia';
import type { Playback } from '../../playback/createPlayback/createPlayback';
import {
  fakeTmdb,
  reviewed,
  TMDB_KEY as KEY,
  tmdbMovieDetail,
  tmdbMovieResult,
} from '../../test-support/fakeTmdb/fakeTmdb';
import { framelessPlayback } from '../../test-support/framelessPlayback/framelessPlayback';
import { freshStorage } from '../../test-support/freshStorage/freshStorage';
import { jpegBytes } from '../../test-support/pictureBytes/pictureBytes';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import { unfittedArt } from '../../test-support/unfittedArt/unfittedArt';

import { createEnrichment } from './createEnrichment';

/** TMDB's `original` art: a 4K backdrop and a tall poster. */
const ORIGINAL_BACKDROP = jpegBytes(3840, 2160);
const ORIGINAL_POSTER = jpegBytes(2000, 3000);

/** What the scripted component answers: the width it was asked for, spelled out. */
const fittedTo = (width: number): Buffer => Buffer.from(`fitted to ${width}`);

const fitting: Playback['fitArt'] = async (_picture, width) => ({
  kind: 'fitted',
  picture: fittedTo(width),
});

function world(fitArt?: Playback['fitArt']) {
  const storage = freshStorage();
  storage.setTmdbKey(KEY);
  const mediaRoot = sandboxRoot('familyflix-enrich-fitted-');
  const media = createMedia(mediaRoot, unfittedArt(fitArt));
  const client = fakeTmdb({
    searches: {
      'The Lantern Keeper': [tmdbMovieResult(101, 'The Lantern Keeper', 2019)],
      'Harbor Lights': [
        tmdbMovieResult(201, 'Harbor Lights', 1963),
        tmdbMovieResult(202, 'Harbor Lights', 2019),
      ],
    },
    movies: [
      tmdbMovieDetail(101, 'The Lantern Keeper', 2019),
      tmdbMovieDetail(201, 'Harbor Lights', 1963),
      tmdbMovieDetail(202, 'Harbor Lights', 2019),
    ],
  });
  client.image.mockImplementation(async (path) => ({
    kind: 'ok',
    value: Readable.from([
      path.startsWith('/poster') ? ORIGINAL_POSTER : ORIGINAL_BACKDROP,
    ]),
  }));
  const enrichment = createEnrichment({
    storage,
    client,
    media,
    playback: framelessPlayback(),
    layoutFill: createLayoutFill({ storage, media }),
  });

  async function addFilm(title: string, year: number) {
    const folder = media.reserveFolder(title, year);
    const videoPath = await media.storeUpload(
      folder,
      'video.mp4',
      Readable.from([Buffer.from('video bytes')])
    );
    return storage.addMovie({ title, year, videoPath }).id;
  }

  async function syncEverything(): Promise<EnrichmentRun> {
    await enrichment.start({ scope: 'all', fields: [...ENRICH_FIELDS] });
    return reviewed(enrichment);
  }

  return { storage, mediaRoot, addFilm, syncEverything };
}

describe('createEnrichment: a Sync stores its art fitted', () => {
  it('stores a 3840-wide backdrop at 1920 wide and its poster at 780, under the same names', async () => {
    const { storage, mediaRoot, addFilm, syncEverything } = world(fitting);
    const id = await addFilm('The Lantern Keeper', 2019);

    await syncEverything();

    const movie = storage.getMovie(id);
    expect(movie?.backdropPath).toBe('the-lantern-keeper-2019/backdrop.jpg');
    expect(movie?.posterPath).toBe('the-lantern-keeper-2019/poster.jpg');
    expect(readFileSync(join(mediaRoot, movie?.backdropPath ?? ''))).toEqual(
      fittedTo(1920)
    );
    expect(readFileSync(join(mediaRoot, movie?.posterPath ?? ''))).toEqual(
      fittedTo(780)
    );
  });

  it('stores both as given with no component', async () => {
    const { storage, mediaRoot, addFilm, syncEverything } = world();
    const id = await addFilm('The Lantern Keeper', 2019);

    await syncEverything();

    const movie = storage.getMovie(id);
    expect(readFileSync(join(mediaRoot, movie?.backdropPath ?? ''))).toEqual(
      ORIGINAL_BACKDROP
    );
    expect(readFileSync(join(mediaRoot, movie?.posterPath ?? ''))).toEqual(
      ORIGINAL_POSTER
    );
  });
});

describe("createEnrichment: the Decision row's candidates", () => {
  it('still link to w185 posters, nothing fitted for them', async () => {
    const asked: number[] = [];
    const { addFilm, syncEverything } = world(
      async (picture, width, format) => {
        asked.push(width);
        return fitting(picture, width, format);
      }
    );
    await addFilm('Harbor Lights', 1963);

    const run = await syncEverything();

    const decision = run.decisions.find(
      (each) => each.title === 'Harbor Lights'
    );
    if (decision?.kind !== 'ambiguous') throw new Error('not ambiguous');
    expect(decision.candidates.map((each) => each.posterUrl)).toEqual([
      'https://image.tmdb.org/t/p/w185/poster-201.jpg',
      'https://image.tmdb.org/t/p/w185/poster-202.jpg',
    ]);
    expect(asked).toEqual([]);
  });
});
