// @vitest-environment node
//
// 58 — Folder layout, Phase 10: "the Sync fills the layout" (issue #543).
//
// A **Sync** over a real SQLite library and a real **Library folder** in a
// sandbox, with a fake TMDB client: the `createEnrichment` suites' precedent.
// The **Write targets** are gone: the Sync takes no options for them and
// writes no `familyflix-metadata.csv`. After each title's Sync it runs the
// **Layout fill** for a title with a **Source folder** in a reachable Library
// folder, and logs each file it wrote as `↓ poster.jpg  →  <path>`. An image
// already in the role's place is left, and no line is logged for it.

import { Readable } from 'node:stream';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join, relative } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
  ENRICH_FIELDS,
  type EnrichmentRun,
  type StartEnrichment,
} from '@/types';
import { createSqliteStorage } from '../../library';
import { createMedia } from '../../media/createMedia/createMedia';
import {
  closeTracked,
  track,
} from '../../test-support/freshStorage/freshStorage';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import {
  fakeTmdb,
  reviewed,
  TMDB_KEY as KEY,
  tmdbImageBytes,
  tmdbMovieDetail,
} from '../../test-support/fakeTmdb/fakeTmdb';
import { framelessPlayback } from '../../test-support/framelessPlayback/framelessPlayback';
import { createEnrichment } from './createEnrichment';

// Registered after the helpers' own hooks, so it runs first: Windows will not
// remove a sandbox holding an open database file.
afterEach(closeTracked);

/** Fetched by the `tmdb_id` it already carries: Confident. */
const HEAT = { tmdbId: 501, title: 'Heat', year: 1995 } as const;
const TITLE_FOLDER = 'Heat (1995)';

/** Every file under a directory, relative to it, sorted. */
function filesUnder(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const found: string[] = [];
  const walk = (at: string) => {
    for (const name of readdirSync(at)) {
      const full = join(at, name);
      if (statSync(full).isDirectory()) walk(full);
      else found.push(relative(dir, full));
    }
  };
  walk(dir);
  return found.sort();
}

/**
 * A library holding Heat, its video stored, its **Title folder** in the one
 * Library folder recorded as its Source folder, with an empty `Images/`.
 */
async function world() {
  const dir = sandboxRoot('familyflix-enrich-layoutfill-');
  const storage = track(createSqliteStorage(join(dir, 'familyflix.db')));
  storage.setTmdbKey(KEY);
  const media = createMedia(join(dir, 'media'));

  const root = join(dir, 'collection');
  const titleFolder = join(root, TITLE_FOLDER);
  mkdirSync(join(titleFolder, 'Images'), { recursive: true });
  writeFileSync(join(titleFolder, 'Heat.mkv'), 'source video bytes');
  const listed = storage.addLibraryFolder(root);

  const folder = media.reserveFolder(HEAT.title, HEAT.year);
  const videoPath = await media.storeUpload(
    folder,
    'video.mp4',
    Readable.from([Buffer.from('video bytes')])
  );
  const id = storage.addMovie({
    title: HEAT.title,
    year: HEAT.year,
    videoPath,
    tmdbId: HEAT.tmdbId,
  }).id;
  storage.setSourceFolder(id, listed.id, TITLE_FOLDER);

  const enrichment = createEnrichment({
    storage,
    client: fakeTmdb({
      movies: [tmdbMovieDetail(HEAT.tmdbId, HEAT.title, HEAT.year)],
    }),
    media,
    playback: framelessPlayback(),
  });

  return { enrichment, root, titleFolder, images: join(titleFolder, 'Images') };
}

/** A library Sync of every field, no Write target options, to its review. */
async function sync(
  enrichment: Awaited<ReturnType<typeof world>>['enrichment']
): Promise<EnrichmentRun> {
  const started = await enrichment.start({
    scope: 'all',
    fields: [...ENRICH_FIELDS],
  });
  expect(started).toMatchObject({ kind: 'started' });
  return reviewed(enrichment);
}

const texts = (run: EnrichmentRun) => run.log.map((line) => line.text);

describe('createEnrichment: no Write targets', () => {
  it('writes no familyflix-metadata.csv, even asked by the retired options', async () => {
    const { enrichment, root } = await world();

    // A caller still sending the retired switches, as an old client would.
    const retired = {
      scope: 'all',
      fields: [...ENRICH_FIELDS],
      writeSheet: true,
      writePosters: true,
    } as StartEnrichment;
    expect(await enrichment.start(retired)).toMatchObject({
      kind: 'started',
    });
    await reviewed(enrichment);

    expect(
      filesUnder(root).some((file) => file.endsWith('familyflix-metadata.csv'))
    ).toBe(false);
  });

  it('adds only the Layout fill’s art to the Title folder, and nothing beside it', async () => {
    const { enrichment, root } = await world();
    const before = filesUnder(root);

    await sync(enrichment);

    expect(filesUnder(root)).toEqual(
      [
        ...before,
        join(TITLE_FOLDER, 'Images', 'backdrop.jpg'),
        join(TITLE_FOLDER, 'Images', 'poster.jpg'),
      ].sort()
    );
  });
});

describe('createEnrichment: the Layout fill after a title’s Sync', () => {
  it('writes the fetched poster and backdrop into an empty Images folder', async () => {
    const { enrichment, images } = await world();

    await sync(enrichment);

    expect(readFileSync(join(images, 'poster.jpg'), 'utf8')).toBe(
      tmdbImageBytes('/poster-501.jpg')
    );
    expect(readFileSync(join(images, 'backdrop.jpg'), 'utf8')).toBe(
      tmdbImageBytes('/backdrop-501.jpg')
    );
  });

  it('logs a ↓ line for each file the Layout fill wrote', async () => {
    const { enrichment, images } = await world();

    const run = await sync(enrichment);

    expect(texts(run)).toContain(
      `↓ poster.jpg  →  ${join(images, 'poster.jpg')}`
    );
    expect(texts(run)).toContain(
      `↓ backdrop.jpg  →  ${join(images, 'backdrop.jpg')}`
    );
  });

  it('leaves a poster already in Images byte-identical and writes none beside it', async () => {
    const { enrichment, images } = await world();
    const ours = Buffer.from([0x89, 0x50, 0x4e, 0x47, 7, 7, 7]);
    writeFileSync(join(images, 'heat-poster.png'), ours);

    await sync(enrichment);

    expect(readFileSync(join(images, 'heat-poster.png')).equals(ours)).toBe(
      true
    );
    expect(existsSync(join(images, 'poster.jpg'))).toBe(false);
    expect(readFileSync(join(images, 'backdrop.jpg'), 'utf8')).toBe(
      tmdbImageBytes('/backdrop-501.jpg')
    );
  });

  it('logs no line for the role image it left', async () => {
    const { enrichment, images } = await world();
    writeFileSync(join(images, 'heat-poster.png'), 'our poster');

    const run = await sync(enrichment);

    // The Sync's own `↓ poster.jpg  →  <media path>` line stores into the
    // Managed media directory; none may point into the Title folder.
    expect(
      texts(run).filter(
        (text) =>
          text.startsWith('↓') && text.includes(images) && /poster/.test(text)
      )
    ).toEqual([]);
    expect(texts(run)).toContain(
      `↓ backdrop.jpg  →  ${join(images, 'backdrop.jpg')}`
    );
  });
});
