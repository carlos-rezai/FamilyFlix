// @vitest-environment node
//
// Log 58, Phase 9: "the Layout fill after a save" (issue #542).
//
// `createLayoutFill({ storage, media })` answers the **Layout fill** a save
// runs: `fill(titleId)` reads the title from the library (a film or a
// series, its art, its tracks, its seasons' posters and its episodes' Stills
// with their **Still source**) and runs `fillLayout` into its **Title
// folder**, only for a title with a **Source folder** in a reachable
// **Library folder**. A title with no Source folder, or in an
// **Unreachable** folder, gets none: nothing written, no line.
//
// Real in-memory SQLite, a real `createMedia` over a sandboxed media root
// whose stored files are written by hand, a real temporary Library folder.

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { createMedia } from '../../media/createMedia/createMedia';
import { freshStorage } from '../../test-support/freshStorage/freshStorage';
import { newMovie } from '../../test-support/newMovie/newMovie';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import { createLayoutFill } from './createLayoutFill';

/** Each stored file and the bytes it holds. */
const STORED: Record<string, string> = {
  'heat-1995/poster.jpg': 'heat poster',
  'heat-1995/heat.nl.srt': 'heat dutch',
  'harbor-2020/season-01/poster.jpg': 'harbor season poster',
  'harbor-2020/stills/s1e1.jpg': 'tmdb still',
  'harbor-2020/season-01/e2.frame.jpg': 'frame still',
};

/** A Library folder holding Heat's and Harbor's empty Title folders, listed. */
function world() {
  const sandbox = sandboxRoot('familyflix-create-layout-fill-');
  const library = join(sandbox, 'Library');
  const mediaRoot = join(sandbox, 'media');
  for (const [stored, bytes] of Object.entries(STORED)) {
    const file = join(mediaRoot, ...stored.split('/'));
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, bytes);
  }
  mkdirSync(join(library, 'Heat (1995)'), { recursive: true });
  writeFileSync(join(library, 'Heat (1995)', 'Heat.mkv'), 'a film');
  mkdirSync(join(library, 'Harbor (2020)', 'Season 01'), { recursive: true });

  const storage = freshStorage();
  const folder = storage.addLibraryFolder(library);
  const fill = createLayoutFill({ storage, media: createMedia(mediaRoot) });
  return { library, storage, folder, fill };
}

/** Heat, linked in its Title folder, with a stored poster and a Dutch track. */
function addHeat(
  storage: ReturnType<typeof world>['storage'],
  folderId: string
) {
  return storage.addMovie(
    newMovie({
      title: 'Heat',
      year: 1995,
      videoPath: 'Heat (1995)/Heat.mkv',
      videoFolderId: folderId,
      posterPath: 'heat-1995/poster.jpg',
      subtitles: [{ path: 'heat-1995/heat.nl.srt', language: 'Dutch' }],
    })
  );
}

/** Every file under a directory, relative to it with forward slashes. */
function filesUnder(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) =>
      join(entry.parentPath, entry.name)
        .slice(dir.length + 1)
        .split(/[\\/]/)
        .join('/')
    )
    .sort();
}

describe('createLayoutFill: a title with a Source folder in a reachable folder', () => {
  it('fills a film’s Title folder from what the library holds', async () => {
    const { library, storage, folder, fill } = world();
    const heat = addHeat(storage, folder.id);
    storage.setSourceFolder(heat.id, folder.id, 'Heat (1995)');

    const outcome = await fill.fill(heat.id);

    expect(filesUnder(join(library, 'Heat (1995)'))).toEqual([
      'Heat.mkv',
      'Images/poster.jpg',
      'Subtitles/Dutch.srt',
    ]);
    expect(
      readFileSync(join(library, 'Heat (1995)', 'Images', 'poster.jpg'), 'utf8')
    ).toBe('heat poster');
    expect(outcome.written).toHaveLength(2);
  });

  it('fills a series’ season poster and its tmdb Still, never its Frame still', async () => {
    const { library, storage, folder, fill } = world();
    const harbor = storage.addSeries({ title: 'Harbor', year: 2020 }, [
      {
        season: 1,
        number: 1,
        videoPath: 'Harbor (2020)/Season 01/Harbor S01E01.mkv',
        videoFolderId: folder.id,
        sourceFile: 'Season 01/Harbor S01E01.mkv',
      },
      {
        season: 1,
        number: 2,
        videoPath: 'Harbor (2020)/Season 01/Harbor S01E02.mkv',
        videoFolderId: folder.id,
        sourceFile: 'Season 01/Harbor S01E02.mkv',
      },
    ]);
    storage.setSourceFolder(harbor.id, folder.id, 'Harbor (2020)');
    storage.setSeasonPoster(harbor.id, 1, 'harbor-2020/season-01/poster.jpg');
    const episodes = storage.getSeriesDetail(harbor.id)?.seasons[0].episodes;
    const [first, second] = [...(episodes ?? [])].sort(
      (a, b) => a.number - b.number
    );
    storage.enrichEpisode(first.id, {
      stillPath: 'harbor-2020/stills/s1e1.jpg',
      stillSource: 'tmdb',
    });
    storage.enrichEpisode(second.id, {
      stillPath: 'harbor-2020/season-01/e2.frame.jpg',
      stillSource: 'frame',
    });

    await fill.fill(harbor.id);

    expect(filesUnder(join(library, 'Harbor (2020)'))).toEqual([
      'Season 01/Images/Stills/S01E01.jpg',
      'Season 01/Images/poster.jpg',
    ]);
  });
});

describe('createLayoutFill: a title that gets no Layout fill', () => {
  it('writes nothing for a title with no Source folder', async () => {
    const { library, storage, folder, fill } = world();
    const heat = addHeat(storage, folder.id);

    const outcome = await fill.fill(heat.id);

    expect(outcome).toEqual({ written: [], lines: [] });
    expect(filesUnder(join(library, 'Heat (1995)'))).toEqual(['Heat.mkv']);
  });

  it('writes nothing for a title in an Unreachable folder', async () => {
    const { library, storage, folder, fill } = world();
    const heat = addHeat(storage, folder.id);
    storage.setSourceFolder(heat.id, folder.id, 'Heat (1995)');
    rmSync(library, { recursive: true, force: true });

    const outcome = await fill.fill(heat.id);

    expect(outcome).toEqual({ written: [], lines: [] });
    expect(existsSync(library)).toBe(false);
  });

  it('writes nothing for a copied title', async () => {
    const { storage, fill } = world();
    const copied = storage.addMovie(
      newMovie({
        title: 'Copied',
        year: 2003,
        posterPath: 'heat-1995/poster.jpg',
      })
    );

    const outcome = await fill.fill(copied.id);

    expect(outcome).toEqual({ written: [], lines: [] });
  });
});
