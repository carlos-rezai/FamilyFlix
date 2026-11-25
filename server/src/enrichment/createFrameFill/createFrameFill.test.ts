// @vitest-environment node
//
// 76, Whole add, Phase 5 (issue #720): the Frame fill.
//
// `createFrameFill({ storage, media, playback })` answers `{ fill(seriesId) }`:
// the background pass a series add or edit starts after it answers. At its
// turn it reads the series again and takes a **Frame still** for each
// **Episode** holding no **Still**, in season then episode order, specials
// included, through one **Late reserve** per series, written with
// `still_source` `frame`. Fills queue behind any fill in flight, one take at
// a time; a series already waiting is filled once; a series gone by its turn
// does nothing and reserves no folder. Just before writing it reads the Still
// source again, so a Still that landed meanwhile wins. `fill` resolves when
// that series' turn is done and never rejects.
//
// Over a real in-memory library, a real `Media` on a sandbox root and a
// scripted `frame`; no real ffmpeg runs.

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { basename, join, relative } from 'node:path';
import { Readable } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';

import type { StoredVideo } from '@/types';
import { createMedia, type Media } from '../../media/createMedia/createMedia';
import type { Playback } from '../../playback/createPlayback/createPlayback';
import { framelessPlayback } from '../../test-support/framelessPlayback/framelessPlayback';
import { freshStorage } from '../../test-support/freshStorage/freshStorage';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import { unfittedArt } from '../../test-support/unfittedArt/unfittedArt';
import { createFrameFill } from './createFrameFill';

type Frame = Playback['frame'];
type Storage = ReturnType<typeof freshStorage>;

const FRAME_BYTES = 'a frame off the video';

const picture = () => Readable.from([Buffer.from(FRAME_BYTES)]);

const pictured: Frame = async () => ({ kind: 'frame', picture: picture() });

/** A door the scripted frame waits behind until it is opened. */
function door() {
  let open: () => void = () => undefined;
  const opened = new Promise<void>((resolve) => {
    open = resolve;
  });
  return { open, opened };
}

const stem = (season: number, number: number) =>
  `S${String(season).padStart(2, '0')}E${String(number).padStart(2, '0')}`;

/** A fresh library, a sandbox media root, a scripted Playback, the fill. */
function world(
  frame: Frame = pictured,
  swap: (real: Media) => Media = (real) => real
) {
  const storage = freshStorage();
  const root = sandboxRoot('familyflix-frame-fill-');
  const media = createMedia(root, unfittedArt());
  const frameMock = vi.fn<Frame>(frame);
  const frameFill = createFrameFill({
    storage,
    media: swap(media),
    playback: framelessPlayback(frameMock),
  });

  /**
   * A copied show with no Media folder recorded, its episodes in the order
   * given; with `reserved`, one whose Media folder is already recorded.
   */
  function addShow(
    title: string,
    episodes: Array<[season: number, number: number]>,
    { reserved = false }: { reserved?: boolean } = {}
  ) {
    const mediaFolder = reserved
      ? basename(media.reserveFolder(title, 2018))
      : undefined;
    const series = storage.addSeries(
      { title, year: 2018, ...(mediaFolder ? { mediaFolder } : {}) },
      episodes.map(([season, number]) => ({
        season,
        number,
        videoPath: `incoming/${title}/${stem(season, number)}.mkv`,
      }))
    );
    return series.id;
  }

  return { storage, root, media, frame: frameMock, frameFill, addShow };
}

function episodeOf(
  storage: Storage,
  id: string,
  season: number,
  number: number
) {
  const found = storage
    .listEpisodes(id)
    .find((each) => each.season === season && each.number === number);
  if (found === undefined) throw new Error(`no S${season}E${number}`);
  return found;
}

/** The video paths `frame` was asked about, in order. */
const framedVideos = (frame: ReturnType<typeof world>['frame']) =>
  frame.mock.calls.map(([video]) => (video as StoredVideo).videoPath);

/** The folders under the media root, sorted. */
const foldersUnder = (root: string) =>
  readdirSync(root)
    .filter((name) => statSync(join(root, name)).isDirectory())
    .sort();

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

describe('createFrameFill: every episode with no Still', () => {
  it('takes a Frame still for each, stored in the Series folder with source frame', async () => {
    const { storage, root, frameFill, addShow } = world();
    const id = addShow('The Hollow Coast', [
      [1, 1],
      [1, 2],
      [2, 1],
    ]);

    await frameFill.fill(id);

    const folder = storage.mediaFolderOf('series', id);
    expect(folder).not.toBeNull();
    for (const [season, number] of [
      [1, 1],
      [1, 2],
      [2, 1],
    ] as const) {
      const episode = episodeOf(storage, id, season, number);
      const seasonFolder = `season-${String(season).padStart(2, '0')}`;
      expect(episode.stillPath).toBe(
        `${folder}/${seasonFolder}/${stem(season, number)}.frame.jpg`
      );
      expect(readFileSync(join(root, episode.stillPath ?? ''), 'utf8')).toBe(
        FRAME_BYTES
      );
      expect(storage.stillSourcesOf(id).get(episode.id)).toBe('frame');
    }
  });

  it('takes them in season then episode order, specials included', async () => {
    const { frame, frameFill, addShow } = world();
    const id = addShow('The Hollow Coast', [
      [2, 1],
      [1, 2],
      [0, 1],
      [1, 1],
    ]);

    await frameFill.fill(id);

    expect(framedVideos(frame)).toEqual([
      'incoming/The Hollow Coast/S00E01.mkv',
      'incoming/The Hollow Coast/S01E01.mkv',
      'incoming/The Hollow Coast/S01E02.mkv',
      'incoming/The Hollow Coast/S02E01.mkv',
    ]);
  });

  it('leaves an episode holding a Still untouched, and asks no frame of it', async () => {
    const { storage, frame, frameFill, addShow } = world();
    const id = addShow('The Hollow Coast', [
      [1, 1],
      [1, 2],
    ]);
    const held = episodeOf(storage, id, 1, 2);
    storage.enrichEpisode(held.id, {
      stillPath: 'elsewhere/season-01/S01E02.still.jpg',
      stillSource: 'picked',
    });

    await frameFill.fill(id);

    expect(framedVideos(frame)).toEqual([
      'incoming/The Hollow Coast/S01E01.mkv',
    ]);
    expect(episodeOf(storage, id, 1, 2).stillPath).toBe(
      'elsewhere/season-01/S01E02.still.jpg'
    );
    expect(storage.stillSourcesOf(id).get(held.id)).toBe('picked');
  });

  it('reserves one Media folder for the series, and records it', async () => {
    const { storage, root, frameFill, addShow } = world();
    const id = addShow('The Hollow Coast', [
      [1, 1],
      [1, 2],
      [2, 1],
    ]);

    await frameFill.fill(id);

    const folder = storage.mediaFolderOf('series', id);
    expect(foldersUnder(root)).toEqual([folder]);
  });

  it('stores into the Media folder the series already has', async () => {
    const { storage, root, frameFill, addShow } = world();
    const id = addShow('The Hollow Coast', [[1, 1]], { reserved: true });
    const folder = storage.mediaFolderOf('series', id);

    await frameFill.fill(id);

    expect(foldersUnder(root)).toEqual([folder]);
    expect(episodeOf(storage, id, 1, 1).stillPath).toBe(
      `${folder}/season-01/S01E01.frame.jpg`
    );
  });

  it('leaves the gradient for an episode no frame comes for, and fills the rest', async () => {
    const { storage, frameFill, addShow } = world(async (video) =>
      video.videoPath.endsWith('S01E01.mkv')
        ? { kind: 'none', reason: 'no-duration' }
        : { kind: 'frame', picture: picture() }
    );
    const id = addShow('The Hollow Coast', [
      [1, 1],
      [1, 2],
    ]);

    await frameFill.fill(id);

    const first = episodeOf(storage, id, 1, 1);
    expect(first.stillPath).toBeNull();
    expect(storage.stillSourcesOf(id).has(first.id)).toBe(false);
    expect(episodeOf(storage, id, 1, 2).stillPath).not.toBeNull();
  });

  it('reserves no folder for a series whose every frame fails', async () => {
    const { storage, root, frameFill, addShow } = world(async () => ({
      kind: 'none',
      reason: 'no-component',
    }));
    const id = addShow('The Hollow Coast', [[1, 1]]);

    await frameFill.fill(id);

    expect(foldersUnder(root)).toEqual([]);
    expect(storage.mediaFolderOf('series', id)).toBeNull();
  });
});

describe('createFrameFill: never rejects', () => {
  it('resolves for a series the library does not hold, reserving nothing', async () => {
    const { root, frame, frameFill } = world();

    await expect(frameFill.fill('no-such-series')).resolves.toBeUndefined();
    expect(frame).not.toHaveBeenCalled();
    expect(foldersUnder(root)).toEqual([]);
  });

  it('resolves when a frame throws', async () => {
    const { frameFill, addShow } = world(() =>
      Promise.reject(new Error('spawn failed'))
    );
    const id = addShow('The Hollow Coast', [[1, 1]]);

    await expect(frameFill.fill(id)).resolves.toBeUndefined();
  });

  it('resolves, writing no Still, when the picture cannot be stored', async () => {
    const { storage, frameFill, addShow } = world(pictured, (real) => ({
      ...real,
      storeNamed: () => Promise.reject(new Error('disk full')),
    }));
    const id = addShow('The Hollow Coast', [[1, 1]]);

    await expect(frameFill.fill(id)).resolves.toBeUndefined();
    expect(episodeOf(storage, id, 1, 1).stillPath).toBeNull();
  });

  it('resolves when the series is deleted mid-take', async () => {
    const held = door();
    const { storage, frame, frameFill, addShow } = world(async () => {
      await held.opened;
      return { kind: 'frame', picture: picture() };
    });
    const id = addShow('The Hollow Coast', [[1, 1]], { reserved: true });

    const filling = frameFill.fill(id);
    await vi.waitFor(() => expect(frame).toHaveBeenCalledTimes(1));
    storage.deleteSeries(id);
    held.open();

    await expect(filling).resolves.toBeUndefined();
  });
});

describe('createFrameFill: the queue', () => {
  it('takes one frame at a time across fills', async () => {
    let inFlight = 0;
    let most = 0;
    const { storage, frameFill, addShow } = world(async () => {
      inFlight += 1;
      most = Math.max(most, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;
      return { kind: 'frame', picture: picture() };
    });
    const first = addShow('The Hollow Coast', [
      [1, 1],
      [1, 2],
    ]);
    const second = addShow('Harbor and Vine', [
      [1, 1],
      [1, 2],
    ]);

    await Promise.all([frameFill.fill(first), frameFill.fill(second)]);

    expect(most).toBe(1);
    for (const id of [first, second]) {
      expect(storage.listEpisodes(id).map((each) => each.stillPath)).toEqual([
        expect.stringMatching(/S01E01\.frame\.jpg$/),
        expect.stringMatching(/S01E02\.frame\.jpg$/),
      ]);
    }
  });

  it('queues a fill behind the one in flight, and resolves it once its own turn is done', async () => {
    const held = door();
    const { storage, frame, frameFill, addShow } = world(async (video) => {
      if (video.videoPath.startsWith('incoming/The Hollow Coast/')) {
        await held.opened;
      }
      return { kind: 'frame', picture: picture() };
    });
    const first = addShow('The Hollow Coast', [[1, 1]]);
    const second = addShow('Harbor and Vine', [[1, 1]]);

    const filling = frameFill.fill(first);
    await vi.waitFor(() => expect(frame).toHaveBeenCalledTimes(1));
    const waiting = frameFill.fill(second);
    await new Promise((resolve) => setTimeout(resolve, 20));

    // The second waits: no frame is asked of it while the first is held.
    expect(framedVideos(frame)).toEqual([
      'incoming/The Hollow Coast/S01E01.mkv',
    ]);

    held.open();
    await waiting;
    expect(episodeOf(storage, second, 1, 1).stillPath).toMatch(
      /S01E01\.frame\.jpg$/
    );
    await filling;
  });

  it('fills a series already waiting once, however often it is asked', async () => {
    const held = door();
    const { frame, frameFill, addShow } = world(async (video) => {
      if (video.videoPath.startsWith('incoming/The Hollow Coast/')) {
        await held.opened;
      }
      return { kind: 'frame', picture: picture() };
    });
    const first = addShow('The Hollow Coast', [[1, 1]]);
    const second = addShow('Harbor and Vine', [
      [1, 1],
      [1, 2],
    ]);

    const filling = frameFill.fill(first);
    await vi.waitFor(() => expect(frame).toHaveBeenCalledTimes(1));
    const again = [frameFill.fill(second), frameFill.fill(second)];
    held.open();
    await Promise.all([filling, ...again]);

    expect(framedVideos(frame)).toEqual([
      'incoming/The Hollow Coast/S01E01.mkv',
      'incoming/Harbor and Vine/S01E01.mkv',
      'incoming/Harbor and Vine/S01E02.mkv',
    ]);
  });

  it('does nothing for a series deleted while waiting, and reserves no folder for it', async () => {
    const held = door();
    const { storage, root, frame, frameFill, addShow } = world(async () => {
      await held.opened;
      return { kind: 'frame', picture: picture() };
    });
    const first = addShow('The Hollow Coast', [[1, 1]], { reserved: true });
    const second = addShow('Harbor and Vine', [[1, 1]]);
    const firstFolder = storage.mediaFolderOf('series', first);

    const filling = frameFill.fill(first);
    await vi.waitFor(() => expect(frame).toHaveBeenCalledTimes(1));
    const waiting = frameFill.fill(second);
    storage.deleteSeries(second);
    held.open();
    await Promise.all([filling, waiting]);

    expect(framedVideos(frame)).toEqual([
      'incoming/The Hollow Coast/S01E01.mkv',
    ]);
    expect(foldersUnder(root)).toEqual([firstFolder]);
  });

  it('does nothing for a series waiting through a Reset, and reserves no folder', async () => {
    const held = door();
    const { storage, root, frame, frameFill, addShow } = world(async () => {
      await held.opened;
      return { kind: 'frame', picture: picture() };
    });
    const first = addShow('The Hollow Coast', [[1, 1]], { reserved: true });
    const second = addShow('Harbor and Vine', [[1, 1]]);
    const firstFolder = storage.mediaFolderOf('series', first);

    const filling = frameFill.fill(first);
    await vi.waitFor(() => expect(frame).toHaveBeenCalledTimes(1));
    const waiting = frameFill.fill(second);
    storage.reset();
    held.open();

    await expect(Promise.all([filling, waiting])).resolves.toEqual([
      undefined,
      undefined,
    ]);
    expect(framedVideos(frame)).toEqual([
      'incoming/The Hollow Coast/S01E01.mkv',
    ]);
    expect(foldersUnder(root)).toEqual([firstFolder]);
  });
});

describe('createFrameFill: a Still landing mid-take', () => {
  it('keeps the Still that landed, and writes no Frame still over it', async () => {
    const held = door();
    const { storage, frame, frameFill, addShow } = world(async () => {
      await held.opened;
      return { kind: 'frame', picture: picture() };
    });
    const id = addShow('The Hollow Coast', [[1, 1]]);
    const episode = episodeOf(storage, id, 1, 1);

    const filling = frameFill.fill(id);
    await vi.waitFor(() => expect(frame).toHaveBeenCalledTimes(1));
    storage.enrichEpisode(episode.id, {
      stillPath: 'elsewhere/season-01/S01E01.still.jpg',
      stillSource: 'tmdb',
    });
    held.open();
    await filling;

    expect(episodeOf(storage, id, 1, 1).stillPath).toBe(
      'elsewhere/season-01/S01E01.still.jpg'
    );
    expect(storage.stillSourcesOf(id).get(episode.id)).toBe('tmdb');
  });
});

describe('createFrameFill: a linked show', () => {
  it('stores its Frame stills in the Series folder, and its Library folder gains no file', async () => {
    const { storage, frame, frameFill } = world();
    const library = join(sandboxRoot('familyflix-frame-fill-linked-'), 'Shows');
    const seasonOne = join(library, 'The Hollow Coast', 'Season 01');
    mkdirSync(seasonOne, { recursive: true });
    writeFileSync(join(seasonOne, 'S01E01.mkv'), 'video bytes');
    writeFileSync(join(seasonOne, 'S01E02.mkv'), 'video bytes');
    const listed = storage.addLibraryFolder(library);
    const series = storage.addSeries(
      { title: 'The Hollow Coast', year: 2018 },
      [1, 2].map((number) => ({
        season: 1,
        number,
        videoPath: `The Hollow Coast/Season 01/${stem(1, number)}.mkv`,
        videoFolderId: listed.id,
      }))
    );

    await frameFill.fill(series.id);

    expect(frame.mock.calls[0]?.[0]).toMatchObject({
      videoPath: 'The Hollow Coast/Season 01/S01E01.mkv',
      videoFolderId: listed.id,
    });
    const folder = storage.mediaFolderOf('series', series.id);
    expect(folder).not.toBeNull();
    expect(
      storage.listEpisodes(series.id).map((each) => each.stillPath)
    ).toEqual([
      `${folder}/season-01/S01E01.frame.jpg`,
      `${folder}/season-01/S01E02.frame.jpg`,
    ]);
    expect(filesUnder(library)).toEqual([
      join('The Hollow Coast', 'Season 01', 'S01E01.mkv'),
      join('The Hollow Coast', 'Season 01', 'S01E02.mkv'),
    ]);
  });
});
