// @vitest-environment node
//
// 51, Library audit, Phase 15 (issue #458): a picked Season folder climbs.
//
// A **Season folder** picked as the Show folder (`Tacoma FD/Season 1`) is
// read for its own episodes only, but titled and held-checked by its Show
// folder (`showFolderOf`): its **Title guess** is the show's, the folder on
// record is asked for the show's folder, and every found video's path is
// answered relative to the Show folder, so `Season 1/<name>`.
//
// Against real trees under `sandboxRoot`, the context a stub.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { readShowFolder, type ShowFolderContext } from './readShowFolder';
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

/**
 * The context with one Library folder `shows` listed at `path`, and the held
 * series on record at the Source folders given, keyed by their relative path.
 */
function onRecord(
  path: string,
  held: Record<string, string> = {}
): ShowFolderContext {
  return {
    folders: [{ id: 'shows', path, titleCount: 0, scannedAt: null }],
    heldSeriesAt: (folderId, sourceFolder) =>
      folderId === 'shows' ? (held[sourceFolder] ?? null) : null,
    titleHolding: () => null,
  };
}

/** The read of `dir`, failing the test on a refusal. */
async function readOf(dir: string, context: ShowFolderContext) {
  const answer = await readShowFolder(dir, context);
  if (answer.kind !== 'read') {
    throw new Error(`expected a read, got the ${answer.refusal} refusal`);
  }
  return answer.read;
}

/** `Shows/Tacoma FD` with two seasons, two episodes and one episode. */
function tacomaFd(): { shows: string; show: string } {
  const shows = join(sandboxRoot('familyflix-show-season-pick-'), 'Shows');
  const show = join(shows, 'Tacoma FD');
  folderWith(show, 'Season 1', [
    'Tacoma.FD.S01E01.Pilot.mkv',
    'Tacoma.FD.S01E02.Hog.Wild.mkv',
  ]);
  folderWith(show, 'Season 2', ['Tacoma.FD.S02E01.Bathroom.Pass.mkv']);
  return { shows, show };
}

describe('readShowFolder: a picked Season folder', () => {
  it('is titled by its show', async () => {
    const { shows, show } = tacomaFd();

    const read = await readOf(join(show, 'Season 1'), onRecord(shows));

    expect(read.titleGuess).toBe('Tacoma FD');
  });

  it('reads only its own episodes, each by its path inside the show', async () => {
    const { shows, show } = tacomaFd();

    const read = await readOf(join(show, 'Season 1'), onRecord(shows));

    expect(read.episodes.map((episode) => episode.relativePath)).toEqual([
      'Season 1/Tacoma.FD.S01E01.Pilot.mkv',
      'Season 1/Tacoma.FD.S01E02.Hog.Wild.mkv',
    ]);
    expect(read.unplaced).toEqual([]);
  });

  it('answers an Unplaced video by its path inside the show', async () => {
    const shows = join(sandboxRoot('familyflix-show-season-pick-'), 'Shows');
    const show = join(shows, 'De Luizenmoeder');
    folderWith(show, 'Seizoen 1', ['Aflevering 1.mp4']);
    const season = folderWith(show, 'Seizoen 2', [
      'Aflevering 1.mp4',
      'Kerstspecial.mp4',
    ]);

    const read = await readOf(season, onRecord(shows));

    expect(read.unplaced.map(({ relativePath }) => relativePath)).toEqual([
      'Seizoen 2/Kerstspecial.mp4',
    ]);
  });

  it('is held while its show is a held series’s Show folder', async () => {
    const { shows, show } = tacomaFd();

    const read = await readOf(
      join(show, 'Season 1'),
      onRecord(shows, { 'Tacoma FD': 'tacoma-fd' })
    );

    expect(read.heldSeriesId).toBe('tacoma-fd');
  });
});
