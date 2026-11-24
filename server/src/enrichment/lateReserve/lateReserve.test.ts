// @vitest-environment node
//
// 75 — Poster pick, phase 1 (issue #708): the **Late reserve**.
//
// `lateReserve({ storage, media }, kind, { id, title, year })` gives a title's
// **Media folder** as a lazy, memoised getter. Asked, it answers the recorded
// folder when `media.openFolder` opens it; otherwise it reserves one by title
// and year through `Media.reserveFolder`, records the new name through
// `storage.recordMediaFolder`, and answers that name. It reserves at most
// once, and nothing until it is first asked.
//
// Composed over a real in-memory library and a real `Media` over a sandbox,
// with `reserveFolder` watched only to count its calls.

import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

import { createMedia } from '../../media/createMedia/createMedia';
import { freshStorage } from '../../test-support/freshStorage/freshStorage';
import { newMovie } from '../../test-support/newMovie/newMovie';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import { unfittedArt } from '../../test-support/unfittedArt/unfittedArt';
import { lateReserve } from './lateReserve';

const FILM = 'The Lantern Keeper';
const SHOW = 'The Hollow Coast';

function world() {
  const storage = freshStorage();
  const root = sandboxRoot('familyflix-late-reserve-');
  const media = createMedia(root, unfittedArt());
  const reserveFolder = vi.spyOn(media, 'reserveFolder');
  return { storage, media, root, reserveFolder };
}

describe('lateReserve: a recorded folder that opens', () => {
  it('answers the recorded folder and reserves nothing', () => {
    const { storage, media, reserveFolder } = world();
    media.reserveFolder(FILM, 2019);
    reserveFolder.mockClear();
    const { id } = storage.addMovie(
      newMovie({
        title: FILM,
        year: 2019,
        mediaFolder: 'the-lantern-keeper-2019',
      })
    );

    const folder = lateReserve({ storage, media }, 'movie', {
      id,
      title: FILM,
      year: 2019,
    });

    expect(folder()).toBe('the-lantern-keeper-2019');
    expect(reserveFolder).not.toHaveBeenCalled();
    expect(storage.mediaFolderOf('movie', id)).toBe('the-lantern-keeper-2019');
  });
});

describe('lateReserve: no folder that opens', () => {
  it('reserves one by title and year for a series with none, and records it', () => {
    const { storage, media, root, reserveFolder } = world();
    const { id } = storage.addSeries({ title: SHOW, year: 2018 });

    const folder = lateReserve({ storage, media }, 'series', {
      id,
      title: SHOW,
      year: 2018,
    });

    expect(folder()).toBe('the-hollow-coast-2018');
    expect(reserveFolder).toHaveBeenCalledWith(SHOW, 2018);
    expect(existsSync(join(root, 'the-hollow-coast-2018'))).toBe(true);
    expect(storage.mediaFolderOf('series', id)).toBe('the-hollow-coast-2018');
  });

  it('reserves over a recorded folder that is gone, and records the new one', () => {
    const { storage, media, root, reserveFolder } = world();
    const { id } = storage.addMovie(
      newMovie({ title: FILM, year: 2019, mediaFolder: 'gone-folder' })
    );

    const folder = lateReserve({ storage, media }, 'movie', {
      id,
      title: FILM,
      year: 2019,
    });

    expect(folder()).toBe('the-lantern-keeper-2019');
    expect(reserveFolder).toHaveBeenCalledWith(FILM, 2019);
    expect(readdirSync(root)).toEqual(['the-lantern-keeper-2019']);
    expect(storage.mediaFolderOf('movie', id)).toBe('the-lantern-keeper-2019');
  });
});

describe('lateReserve: lazy and memoised', () => {
  it('asked three times, reserves once and answers the same folder', () => {
    const { storage, media, root, reserveFolder } = world();
    const { id } = storage.addSeries({ title: SHOW, year: 2018 });

    const folder = lateReserve({ storage, media }, 'series', {
      id,
      title: SHOW,
      year: 2018,
    });

    const answers = [folder(), folder(), folder()];
    expect(answers).toEqual([
      'the-hollow-coast-2018',
      'the-hollow-coast-2018',
      'the-hollow-coast-2018',
    ]);
    expect(reserveFolder).toHaveBeenCalledTimes(1);
    expect(readdirSync(root)).toEqual(['the-hollow-coast-2018']);
  });

  it('never asked, reserves nothing and records nothing', () => {
    const { storage, media, root, reserveFolder } = world();
    const { id } = storage.addSeries({ title: SHOW, year: 2018 });

    lateReserve({ storage, media }, 'series', { id, title: SHOW, year: 2018 });

    expect(reserveFolder).not.toHaveBeenCalled();
    expect(existsSync(root) ? readdirSync(root) : []).toEqual([]);
    expect(storage.mediaFolderOf('series', id)).toBeNull();
  });

  it('throws whatever reserveFolder throws', () => {
    const { storage, media, reserveFolder } = world();
    const { id } = storage.addSeries({ title: SHOW, year: 2018 });
    reserveFolder.mockImplementation(() => {
      throw new Error('disk full');
    });

    const folder = lateReserve({ storage, media }, 'series', {
      id,
      title: SHOW,
      year: 2018,
    });

    expect(() => folder()).toThrow('disk full');
  });
});
