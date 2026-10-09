// @vitest-environment node
//
// 31 — Export options refactor (issue 283), commit 13.
//
// `exportSummary(storage, home, now)` — the **Export summary**'s rule, out of
// the route: the counts off `countMovies()` and the Series tab's one read,
// the default destination (the first readable **Library folder** in the order
// added, else `<home>\Downloads`) and today's **Export name**. Real
// directories under `sandboxRoot`, over a fresh in-memory library. The
// route's answer stays pinned by `routes.export`.

import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import type { LibraryStorage } from '../../library';
import { freshStorage } from '../../test-support/freshStorage/freshStorage';
import { newMovie } from '../../test-support/newMovie/newMovie';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import { exportName } from '../exportName/exportName';
import { exportSummary } from './exportSummary';

const NOW = new Date(2026, 9, 9, 12, 0);

/** A sandbox holding a home folder, and a real folder made under it. */
function sandbox(): { home: string; folder: (name: string) => string } {
  const dir = sandboxRoot('familyflix-export-summary-');
  const home = join(dir, 'home');
  mkdirSync(home);
  return {
    home,
    folder: (name) => {
      const path = join(dir, name);
      mkdirSync(path);
      return path;
    },
  };
}

/** Two films, and two series of two and three episodes. */
function addLibrary(storage: LibraryStorage): void {
  storage.addMovie(newMovie({ title: 'Zephyr', videoPath: 'z/z.mkv' }));
  storage.addMovie(newMovie({ title: 'Backwater', videoPath: 'b/b.mkv' }));
  const harbor = storage.addSeries({ title: 'Harbor & Vine', year: 2021 });
  for (const number of [1, 2]) {
    storage.addEpisode(harbor.id, {
      season: 1,
      number,
      videoPath: `harbor/season-01/e${number}.mp4`,
    });
  }
  const keepers = storage.addSeries({ title: 'Lighthouse Keepers' });
  for (const number of [1, 2, 3]) {
    storage.addEpisode(keepers.id, {
      season: 2,
      number,
      videoPath: `keepers/season-02/e${number}.mp4`,
    });
  }
}

describe('exportSummary — the counts', () => {
  it('answers zero of everything on an empty library', async () => {
    const { home } = sandbox();

    expect(await exportSummary(freshStorage(), home, NOW)).toMatchObject({
      movieCount: 0,
      seriesCount: 0,
      episodeCount: 0,
    });
  });

  it('counts the films, the series and every episode', async () => {
    const storage = freshStorage();
    addLibrary(storage);

    const summary = await exportSummary(storage, sandbox().home, NOW);

    expect(summary).toMatchObject({
      movieCount: 2,
      seriesCount: 2,
      episodeCount: 5,
    });
  });
});

describe('exportSummary — the default destination', () => {
  it('is Downloads under the home folder with no Library folder listed', async () => {
    const { home } = sandbox();

    const summary = await exportSummary(freshStorage(), home, NOW);

    expect(summary.defaultDestination).toBe(join(home, 'Downloads'));
  });

  it('is the first Library folder, in the order added', async () => {
    const storage = freshStorage();
    const { home, folder } = sandbox();
    const movies = folder('Movies');
    storage.addLibraryFolder(movies);
    storage.addLibraryFolder(folder('Kids'));

    const summary = await exportSummary(storage, home, NOW);

    expect(summary.defaultDestination).toBe(movies);
  });

  it('skips a listed folder that cannot be read now', async () => {
    const storage = freshStorage();
    const { home, folder } = sandbox();
    const movies = folder('Movies');
    const kids = folder('Kids');
    storage.addLibraryFolder(movies);
    storage.addLibraryFolder(kids);
    rmSync(movies, { recursive: true, force: true });

    const summary = await exportSummary(storage, home, NOW);

    expect(summary.defaultDestination).toBe(kids);
  });

  it('is Downloads when every listed folder is out of reach', async () => {
    const storage = freshStorage();
    const { home, folder } = sandbox();
    const movies = folder('Movies');
    storage.addLibraryFolder(movies);
    rmSync(movies, { recursive: true, force: true });

    const summary = await exportSummary(storage, home, NOW);

    expect(summary.defaultDestination).toBe(join(home, 'Downloads'));
  });
});

describe('exportSummary — the name', () => {
  it('is the Export name an export made now would take', async () => {
    const summary = await exportSummary(freshStorage(), sandbox().home, NOW);

    expect(summary.folderName).toBe(exportName(NOW));
    expect(summary.folderName).toBe('familyflix-collection_09-10-2026');
  });
});
