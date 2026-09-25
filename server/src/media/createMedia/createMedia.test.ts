// @vitest-environment node
//
// 11 — Movie form, Phase 3: "the media domain" (issue #102).
//
// The injected seam of `server/src/media/` — the one object in the app that
// writes into the **Managed media directory**, and the only thing that ever
// deletes from it.
//
// It is tested against a **real sandbox directory** rather than a mocked `fs`,
// for the reason `mediaFilePath`'s own tests give: what is being asserted is
// what is on the disk afterwards, and a mock that agreed with the code under
// test would agree with a broken one just as readily. `sandboxRoot` resolves
// the root, because a temporary directory is a symlink on macOS and an 8.3
// short name on Windows.
//
// **The assertion that matters most is the last one in the first block**: every
// path `storeUpload` returns resolves through `mediaFilePath` to the file that
// was written. That is the contract `/stream`, `/playback`, the cue route and
// `/api/images` all already depend on, and this is the first code in the app
// that produces a path for them to resolve.

import { describe, expect, it } from 'vitest';
import {
  closeSync,
  constants,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { Readable } from 'node:stream';

import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import { mediaFilePath } from '../../playback/mediaFilePath/mediaFilePath';

import { createMedia, type Media } from './createMedia';

/**
 * A managed media directory with a sibling beside it, and the domain composed
 * over the first.
 *
 * `outside` is the tree the deletions must never reach into — the same shape
 * `mediaFilePath`'s sandbox uses, for the same question.
 */
function sandbox(): { media: Media; root: string; outside: string } {
  const dir = sandboxRoot('familyflix-media-');
  const root = join(dir, 'media');
  const outside = join(dir, 'elsewhere');
  mkdirSync(root);
  mkdirSync(outside);

  return { media: createMedia(root), root, outside };
}

/** One part's bytes, the way `busboy` hands them over. */
const part = (bytes: string) => Readable.from([Buffer.from(bytes)]);

describe('createMedia — storeUpload', () => {
  it('writes the bytes into the folder it is given', async () => {
    const { media } = sandbox();
    const folder = media.reserveFolder('The Lantern Keeper', 2019);

    await media.storeUpload(folder, 'lantern.mp4', part('video bytes'));

    expect(readFileSync(join(folder, 'lantern.mp4'), 'utf8')).toBe(
      'video bytes'
    );
  });

  it('answers with a path relative to the managed media directory', async () => {
    const { media } = sandbox();
    const folder = media.reserveFolder('The Lantern Keeper', 2019);

    const stored = await media.storeUpload(
      folder,
      'lantern.mp4',
      part('video bytes')
    );

    // Never the absolute path it just wrote. CLAUDE.md's rule — "all file paths
    // are stored as relative paths under the managed media directory, never
    // absolute paths from the source machine" — is what makes a library
    // portable between the dev tree and the packaged app's user-data directory.
    expect(isAbsolute(stored)).toBe(false);
    expect(stored).toBe('the-lantern-keeper-2019/lantern.mp4');
  });

  it('separates the segments with a forward slash on every platform', async () => {
    const { media } = sandbox();
    const folder = media.reserveFolder('The Lantern Keeper', 2019);

    const stored = await media.storeUpload(
      folder,
      'lantern.mp4',
      part('video bytes')
    );

    // A stored path is also a URL segment: `/api/images/<posterPath>` is
    // `express.static`, and a backslash from a Windows `relative()` would be a
    // path the browser cannot ask for and no stored `<folder>/<file>.mp4`
    // spells.
    expect(stored).not.toContain('\\');
  });

  it('resolves through mediaFilePath to the file that was written', async () => {
    const { media, root } = sandbox();
    const folder = media.reserveFolder('The Lantern Keeper', 2019);

    const stored = await media.storeUpload(
      folder,
      'lantern.mp4',
      part('video bytes')
    );

    // The contract every read route in the app already depends on, asserted
    // against the resolver those routes actually use rather than against a
    // string this test built by hand.
    expect(mediaFilePath(root, stored)).toBe(join(folder, 'lantern.mp4'));
  });

  it('resolves for a crafted filename too, and to nowhere else', async () => {
    const { media, root } = sandbox();
    const folder = media.reserveFolder('The Lantern Keeper', 2019);

    const stored = await media.storeUpload(
      folder,
      '../../evil.mp4',
      part('video bytes')
    );

    // Story 60. The name is sanitised here rather than at the route, so every
    // caller of this domain — this form, and the bulk importer after it — gets
    // the guarantee without having to remember it.
    expect(mediaFilePath(root, stored)).toBe(join(folder, 'evil.mp4'));
    expect(existsSync(join(root, '..', 'evil.mp4'))).toBe(false);
    expect(existsSync(join(root, 'evil.mp4'))).toBe(false);
  });

  it('takes several files into one movie folder', async () => {
    const { media, root } = sandbox();
    const folder = media.reserveFolder('The Lantern Keeper', 2019);

    const video = await media.storeUpload(
      folder,
      'lantern.mp4',
      part('video bytes')
    );
    const poster = await media.storeUpload(
      folder,
      'poster.jpg',
      part('poster bytes')
    );

    // One **Movie folder** holds every file of one movie — the family's own
    // one-folder-per-movie convention, and what the poster and subtitle slots
    // land in next slice.
    expect(mediaFilePath(root, video)).not.toBeNull();
    expect(mediaFilePath(root, poster)).not.toBeNull();
    expect(video).not.toBe(poster);
  });

  it('writes a file large enough to have arrived in more than one chunk', async () => {
    const { media, root } = sandbox();
    const folder = media.reserveFolder('The Lantern Keeper', 2019);
    const chunks = ['first ', 'second ', 'third'];

    const stored = await media.storeUpload(
      folder,
      'lantern.mp4',
      Readable.from(chunks.map((chunk) => Buffer.from(chunk)))
    );

    // A 12 GB film never sits in memory: the part is a stream and every chunk
    // of it has to reach the file, in order.
    expect(readFileSync(mediaFilePath(root, stored) as string, 'utf8')).toBe(
      'first second third'
    );
  });

  it('does not resolve until the bytes are on disk', async () => {
    const { media, root } = sandbox();
    const folder = media.reserveFolder('The Lantern Keeper', 2019);

    const stored = await media.storeUpload(
      folder,
      'lantern.mp4',
      part('video bytes')
    );

    // The route writes the row after the parts, so a promise that settled
    // before the write finished would store a path to a file that is not there
    // yet.
    expect(mediaFilePath(root, stored)).not.toBeNull();
  });
});

describe('createMedia — seasonFolder', () => {
  it('makes season-NN under the Series folder, two digits, and answers its path', () => {
    const { media } = sandbox();
    const series = media.reserveFolder('Harbor & Vine', 2021);

    const folder = media.seasonFolder(series, 2);

    expect(folder).toBe(join(series, 'season-02'));
    expect(existsSync(folder)).toBe(true);
  });

  it('is harmless asked twice, and keeps what the season already holds', async () => {
    const { media, root } = sandbox();
    const series = media.reserveFolder('Harbor & Vine', 2021);
    const first = media.seasonFolder(series, 1);
    const stored = await media.storeUpload(
      first,
      'e1.mp4',
      part('episode one')
    );

    expect(media.seasonFolder(series, 1)).toBe(first);
    expect(readFileSync(mediaFilePath(root, stored) as string, 'utf8')).toBe(
      'episode one'
    );
  });
});

describe('createMedia — reserveFolder', () => {
  it('creates the movie folder under the managed media directory', () => {
    const { media, root } = sandbox();

    const folder = media.reserveFolder('The Lantern Keeper', 2019);

    expect(folder).toBe(join(root, 'the-lantern-keeper-2019'));
    expect(existsSync(folder)).toBe(true);
  });

  it('names it from the title alone when there is no year', () => {
    const { media, root } = sandbox();

    expect(media.reserveFolder('The Lantern Keeper', null)).toBe(
      join(root, 'the-lantern-keeper')
    );
  });

  it('suffixes the second folder for the same title and year', () => {
    const { media, root } = sandbox();

    const first = media.reserveFolder('The Lantern Keeper', 2019);
    const second = media.reserveFolder('The Lantern Keeper', 2019);

    // Story 59: two films that happen to share a title and a year must not
    // share a folder, because the second one's files would overwrite the
    // first one's.
    expect(first).toBe(join(root, 'the-lantern-keeper-2019'));
    expect(second).toBe(join(root, 'the-lantern-keeper-2019-2'));
  });

  it('keeps counting for a third and a fourth', () => {
    const { media, root } = sandbox();

    media.reserveFolder('The Lantern Keeper', 2019);
    media.reserveFolder('The Lantern Keeper', 2019);

    expect(media.reserveFolder('The Lantern Keeper', 2019)).toBe(
      join(root, 'the-lantern-keeper-2019-3')
    );
    expect(media.reserveFolder('The Lantern Keeper', 2019)).toBe(
      join(root, 'the-lantern-keeper-2019-4')
    );
  });

  it('keeps the first movie’s files where they are', async () => {
    const { media, root } = sandbox();
    const first = media.reserveFolder('The Lantern Keeper', 2019);
    const stored = await media.storeUpload(
      first,
      'lantern.mp4',
      part('the first film')
    );

    media.reserveFolder('The Lantern Keeper', 2019);

    // The point of the suffix, said as the thing that goes wrong without it.
    expect(readFileSync(mediaFilePath(root, stored) as string, 'utf8')).toBe(
      'the first film'
    );
  });

  it('creates the managed media directory if nothing has been added yet', () => {
    const sandboxDir = sandboxRoot('familyflix-media-');
    const root = join(sandboxDir, 'media');

    const folder = createMedia(root).reserveFolder('The Lantern Keeper', 2019);

    // The dev default is `./media`, which does not exist until the first film
    // is added — and the first film added is exactly this call.
    expect(existsSync(folder)).toBe(true);
  });

  it('gives a film with an unusable title a usable folder', () => {
    const { media, root } = sandbox();

    // `movieFolder`'s fallback, reaching the disk: story 61 is only true if
    // the folder is actually created.
    expect(media.reserveFolder('!!!', 2019)).toBe(join(root, 'movie-2019'));
    expect(existsSync(join(root, 'movie-2019'))).toBe(true);
  });
});

describe('createMedia — renameFolder', () => {
  // 11 — Movie form refactor (issue #109), Group 4. `renameFolder` is the one
  // method in this domain that was reachable only through the route, which
  // `03761ca` named as a debt for this round. It exists because `busboy` will
  // not reach a part that follows a file until that file is consumed, and
  // buffering is out at 12 GB: so the folder is reserved from whatever fields
  // had arrived, and given its real name once the title is known.

  it('renames the folder to the one the title asks for', async () => {
    const { media, root } = sandbox();
    // The folder a body that sent its film before it named it gets: reserved
    // with nothing known, so `movieFolder`'s fallback names it.
    const reserved = media.reserveFolder('', null);
    await media.storeUpload(reserved, 'lantern.mp4', part('the film'));

    const renamed = media.renameFolder(reserved, 'The Lantern Keeper', 2019);

    expect(renamed.folder).toBe(join(root, 'the-lantern-keeper-2019'));
    expect(existsSync(reserved)).toBe(false);
    expect(existsSync(renamed.folder)).toBe(true);
  });

  it('takes the files with it', async () => {
    const { media } = sandbox();
    const reserved = media.reserveFolder('', null);
    await media.storeUpload(reserved, 'lantern.mp4', part('the film'));
    await media.storeUpload(reserved, 'poster.png', part('the artwork'));

    const renamed = media.renameFolder(reserved, 'The Lantern Keeper', 2019);

    expect(readFileSync(join(renamed.folder, 'lantern.mp4'), 'utf8')).toBe(
      'the film'
    );
    expect(readFileSync(join(renamed.folder, 'poster.png'), 'utf8')).toBe(
      'the artwork'
    );
  });

  // The assertion the route depends on: a path `storeUpload` already answered
  // has to go on resolving afterwards, or the row points at nothing.
  it('re-anchors the stored paths it already answered', async () => {
    const { media, root } = sandbox();
    const reserved = media.reserveFolder('', null);
    const stored = await media.storeUpload(
      reserved,
      'lantern.mp4',
      part('the film')
    );

    const renamed = media.renameFolder(reserved, 'The Lantern Keeper', 2019);
    const after = renamed.storedPath(stored);

    expect(after).toBe('the-lantern-keeper-2019/lantern.mp4');
    expect(readFileSync(mediaFilePath(root, after) as string, 'utf8')).toBe(
      'the film'
    );
  });

  it('re-anchors a path whose filename the sanitiser changed', async () => {
    const { media, root } = sandbox();
    const reserved = media.reserveFolder('', null);
    const stored = await media.storeUpload(
      reserved,
      '../../a lantern: keeper.mp4',
      part('the film')
    );

    const after = media
      .renameFolder(reserved, 'The Lantern Keeper', 2019)
      .storedPath(stored);

    // Only the first segment changes — how a filename is spelled was settled
    // by `storeUpload` and is not this method's to revisit.
    expect(after.split('/')[0]).toBe('the-lantern-keeper-2019');
    expect(readFileSync(mediaFilePath(root, after) as string, 'utf8')).toBe(
      'the film'
    );
  });

  it('moves nothing when the folder already has the name it wants', async () => {
    const { media } = sandbox();
    // Every body the form sends is this case: the title arrives before the
    // film, so the folder was reserved with its final name already.
    const reserved = media.reserveFolder('The Lantern Keeper', 2019);
    const stored = await media.storeUpload(
      reserved,
      'lantern.mp4',
      part('the film')
    );

    const renamed = media.renameFolder(reserved, 'The Lantern Keeper', 2019);

    expect(renamed.folder).toBe(reserved);
    expect(renamed.storedPath(stored)).toBe(stored);
    expect(readFileSync(join(reserved, 'lantern.mp4'), 'utf8')).toBe(
      'the film'
    );
  });

  it('leaves a suffixed folder alone — the suffix is this movie’s name', async () => {
    const { media, root } = sandbox();
    media.reserveFolder('The Lantern Keeper', 2019);
    const second = media.reserveFolder('The Lantern Keeper', 2019);
    const stored = await media.storeUpload(
      second,
      'lantern.mp4',
      part('the second film')
    );

    const renamed = media.renameFolder(second, 'The Lantern Keeper', 2019);

    // `-2` is not a stale name to be corrected: renaming it would collide with
    // the first film, and re-suffixing it would move gigabytes for nothing.
    expect(renamed.folder).toBe(join(root, 'the-lantern-keeper-2019-2'));
    expect(renamed.storedPath(stored)).toBe(stored);
  });

  // The one that would destroy somebody else's film.
  it('takes a free name rather than writing over the folder already there', async () => {
    const { media, root } = sandbox();
    const taken = media.reserveFolder('The Lantern Keeper', 2019);
    const theirs = await media.storeUpload(
      taken,
      'lantern.mp4',
      part('the first film')
    );

    const reserved = media.reserveFolder('', null);
    const stored = await media.storeUpload(
      reserved,
      'lantern.mp4',
      part('the second film')
    );
    const renamed = media.renameFolder(reserved, 'The Lantern Keeper', 2019);

    expect(renamed.folder).toBe(join(root, 'the-lantern-keeper-2019-2'));
    // Both films are still there, and each stored path still names its own.
    expect(readFileSync(mediaFilePath(root, theirs) as string, 'utf8')).toBe(
      'the first film'
    );
    expect(
      readFileSync(
        mediaFilePath(root, renamed.storedPath(stored)) as string,
        'utf8'
      )
    ).toBe('the second film');
  });

  it('gives a film with an unusable title a usable folder', () => {
    const { media, root } = sandbox();
    const reserved = media.reserveFolder('', null);

    expect(media.renameFolder(reserved, '!!!', 2019).folder).toBe(
      join(root, 'movie-2019')
    );
  });

  it('names it from the title alone when the movie has no year', () => {
    const { media, root } = sandbox();
    const reserved = media.reserveFolder('', null);

    expect(
      media.renameFolder(reserved, 'The Lantern Keeper', null).folder
    ).toBe(join(root, 'the-lantern-keeper'));
  });
});

describe('createMedia — openFolder', () => {
  it('answers the folder a stored path already lives in', async () => {
    const { media, root } = sandbox();
    const reserved = media.reserveFolder('The Lantern Keeper', 2019);
    const stored = await media.storeUpload(
      reserved,
      'lantern.mp4',
      part('video bytes')
    );

    // What an *edit* uses instead of `reserveFolder`: the movie already has
    // somewhere its files live, and a second folder because a title was
    // corrected would mean moving gigabytes to fix a spelling.
    expect(media.openFolder(stored)).toBe(
      join(root, 'the-lantern-keeper-2019')
    );
  });

  it('is the folder a newly picked file lands in beside the old ones', async () => {
    const { media, root } = sandbox();
    const reserved = media.reserveFolder('The Lantern Keeper', 2019);
    const film = await media.storeUpload(
      reserved,
      'lantern.mp4',
      part('video bytes')
    );

    const folder = media.openFolder(film) as string;
    const poster = await media.storeUpload(
      folder,
      'poster.jpg',
      part('poster bytes')
    );

    // The round trip that matters: the path this answers is one `storeUpload`
    // takes, and what comes back out of it resolves like every other stored
    // path in the library.
    expect(poster).toBe('the-lantern-keeper-2019/poster.jpg');
    expect(readFileSync(join(root, poster), 'utf8')).toBe('poster bytes');
  });

  it('answers nothing for a path with no file behind it', () => {
    const { media } = sandbox();

    // A row pointing at bytes that are gone has no folder to reuse, and the
    // caller reserves one rather than writing into a guess.
    expect(media.openFolder('the-lantern-keeper-2019/lantern.mp4')).toBeNull();
  });

  it('answers nothing for the empty path a filmless row carries', () => {
    const { media } = sandbox();

    // `video_path` is `NOT NULL`, so a row written with no film behind it
    // carries `''` — which resolves to the media root itself and is not a
    // movie folder.
    expect(media.openFolder('')).toBeNull();
  });

  it('answers nothing for a path that escapes the managed media directory', () => {
    const { media, outside } = sandbox();
    writeFileSync(join(outside, 'elsewhere.mp4'), 'not ours');

    // `mediaFilePath`'s own rule, asked one directory up: the containment test
    // is not spelled a second time here, because a second spelling is where
    // the two drift apart.
    expect(media.openFolder('../elsewhere/elsewhere.mp4')).toBeNull();
    expect(media.openFolder(join(outside, 'elsewhere.mp4'))).toBeNull();
  });
});

describe('createMedia — removeFolder', () => {
  it('removes the folder and everything one request wrote into it', async () => {
    const { media } = sandbox();
    const folder = media.reserveFolder('The Lantern Keeper', 2019);
    await media.storeUpload(folder, 'lantern.mp4', part('video bytes'));
    await media.storeUpload(folder, 'poster.jpg', part('poster bytes'));

    media.removeFolder(folder);

    // The rollback: a save that fails partway leaves no row *and* no bytes.
    expect(existsSync(folder)).toBe(false);
  });

  it('leaves the managed media directory itself standing', async () => {
    const { media, root } = sandbox();
    const folder = media.reserveFolder('The Lantern Keeper', 2019);
    await media.storeUpload(folder, 'lantern.mp4', part('video bytes'));

    media.removeFolder(folder);

    expect(existsSync(root)).toBe(true);
  });

  it('leaves another movie’s folder alone', async () => {
    const { media, root } = sandbox();
    const keeper = media.reserveFolder('The Lantern Keeper', 2019);
    const other = media.reserveFolder('Rear Window', 1954);
    const kept = await media.storeUpload(other, 'rear.mp4', part('rear bytes'));

    media.removeFolder(keeper);

    expect(mediaFilePath(root, kept)).not.toBeNull();
  });

  it('says nothing about a folder that is already gone', () => {
    const { media, root } = sandbox();

    // A rollback runs on a path that may never have been reserved — the save
    // failed before the first part arrived — and a throw there would replace
    // the route's own answer with an exception.
    expect(() =>
      media.removeFolder(join(root, 'never-reserved-2019'))
    ).not.toThrow();
  });

  it('refuses to remove anything outside the managed media directory', () => {
    const { media, outside } = sandbox();
    writeFileSync(join(outside, 'family-photos.jpg'), 'not ours');

    media.removeFolder(outside);

    // This domain is the only thing in the app that deletes, and the media root
    // is the whole of what it is allowed to delete inside. A rollback handed a
    // path from somewhere else is a rollback that does nothing.
    expect(existsSync(join(outside, 'family-photos.jpg'))).toBe(true);
  });
});

describe('createMedia — removeFile', () => {
  it('removes the one file its stored path names', async () => {
    const { media, root } = sandbox();
    const folder = media.reserveFolder('The Lantern Keeper', 2019);
    const stored = await media.storeUpload(
      folder,
      'poster.jpg',
      part('old poster')
    );

    media.removeFile(stored);

    // Built with the rest of the domain though nothing calls it until the
    // replace slice: it is the same object's responsibility, and splitting it
    // across two issues would mean shipping the seam twice.
    expect(mediaFilePath(root, stored)).toBeNull();
  });

  it('leaves the movie’s other files alone', async () => {
    const { media, root } = sandbox();
    const folder = media.reserveFolder('The Lantern Keeper', 2019);
    const poster = await media.storeUpload(
      folder,
      'poster.jpg',
      part('old poster')
    );
    const video = await media.storeUpload(
      folder,
      'lantern.mp4',
      part('video bytes')
    );

    media.removeFile(poster);

    // It deletes exactly one file at a time — replacing a poster must not take
    // the 12 GB film beside it.
    expect(mediaFilePath(root, video)).not.toBeNull();
    expect(existsSync(folder)).toBe(true);
  });

  it('swallows a file that will not delete rather than failing the save', () => {
    const { media } = sandbox();

    // A cleanup runs *after* the row has committed, so a throw here would lose
    // an edit that already succeeded — the wrong trade against one stranded
    // file.
    expect(() =>
      media.removeFile('the-lantern-keeper-2019/never-written.jpg')
    ).not.toThrow();
  });

  it('refuses a stored path that leaves the managed media directory', () => {
    const { media, outside } = sandbox();
    writeFileSync(join(outside, 'family-photos.jpg'), 'not ours');

    media.removeFile('../elsewhere/family-photos.jpg');

    // `mediaFilePath`'s rule, on the one operation where getting it wrong
    // deletes rather than 404s.
    expect(existsSync(join(outside, 'family-photos.jpg'))).toBe(true);
  });

  it('refuses an absolute stored path', () => {
    const { media, outside } = sandbox();
    const theirs = join(outside, 'family-photos.jpg');
    writeFileSync(theirs, 'not ours');

    media.removeFile(resolve(theirs));

    expect(existsSync(theirs)).toBe(true);
  });
});

// --- 12 — Delete movie, Phase 3: "the bytes" (issue #117) ---------------------

/**
 * libuv's `UV_FS_O_EXLOCK`, which Node's `fs.constants` does not spell on
 * Windows: open with no share mode at all, so that nothing else — the removal
 * under test included — can touch the file while the handle is held. This is
 * what a video the stream route still has open looks like to a **Delete**, and
 * the only way to stage a locked file from inside one process.
 *
 * Elsewhere the bit is unknown to `open(2)` and ignored, so the file is simply
 * open — and the contract asserted through it (never throw) holds either way.
 */
const UV_FS_O_EXLOCK = 0x10000000;

/** Hold a file the way the stream route does mid-Delete; answers the release. */
function holdOpen(file: string): () => void {
  const fd = openSync(file, constants.O_RDONLY | UV_FS_O_EXLOCK);
  return () => closeSync(fd);
}

describe('createMedia — removeMovieFolder', () => {
  it('removes the folder a stored path names and everything in it', async () => {
    const { media, root } = sandbox();
    const folder = media.reserveFolder('The Lantern Keeper', 2019);
    const video = await media.storeUpload(
      folder,
      'lantern.mp4',
      part('video bytes')
    );
    await media.storeUpload(folder, 'poster.jpg', part('poster bytes'));
    await media.storeUpload(folder, 'lantern.en.srt', part('1\n'));

    media.removeMovieFolder(video);

    // The feature's point: the gigabytes come back. The folder is the first
    // segment of the stored path, and it goes whole — video, poster,
    // subtitles, and anything else that found its way in.
    expect(existsSync(folder)).toBe(false);
    expect(mediaFilePath(root, video)).toBeNull();
  });

  it('removes the folder when the named file is already gone but its siblings are not', async () => {
    const { media } = sandbox();
    const folder = media.reserveFolder('The Lantern Keeper', 2019);
    const video = await media.storeUpload(
      folder,
      'lantern.mp4',
      part('video bytes')
    );
    await media.storeUpload(folder, 'poster.jpg', part('poster bytes'));
    unlinkSync(join(folder, 'lantern.mp4'));

    media.removeMovieFolder(video);

    // Why neither existing removal fits: `openFolder` answers nothing for a
    // missing file, which here would leave the poster and subtitles on disk
    // forever after a hand-deleted video. The folder is named by the path,
    // not found through the file.
    expect(existsSync(folder)).toBe(false);
  });

  it('leaves another movie’s folder alone and the managed media directory standing', async () => {
    const { media, root } = sandbox();
    const keeper = media.reserveFolder('The Lantern Keeper', 2019);
    const video = await media.storeUpload(
      keeper,
      'lantern.mp4',
      part('video bytes')
    );
    const other = media.reserveFolder('Rear Window', 1954);
    const kept = await media.storeUpload(other, 'rear.mp4', part('rear bytes'));

    media.removeMovieFolder(video);

    expect(mediaFilePath(root, kept)).not.toBeNull();
    expect(existsSync(other)).toBe(true);
    expect(existsSync(root)).toBe(true);
  });

  it('says nothing about a folder that is already gone', () => {
    const { media } = sandbox();

    // Deleted by hand, or by a Delete that ran before this one — either way
    // the row is what the route is answering for, and there is nothing here
    // to fail over.
    expect(() =>
      media.removeMovieFolder('never-reserved-2019/lantern.mp4')
    ).not.toThrow();
  });

  it('refuses a path that escapes the root — no files touched', () => {
    const { media, outside } = sandbox();
    const theirs = join(outside, 'family-photos.jpg');
    writeFileSync(theirs, 'not ours');

    media.removeMovieFolder('../elsewhere/family-photos.jpg');
    media.removeMovieFolder(resolve(theirs));

    // `mediaFilePath`'s rule, on the one removal that takes a whole directory:
    // the **Library root** is never ours to remove from, and a stored path
    // that names it is a path that names nothing here.
    expect(existsSync(theirs)).toBe(true);
    expect(existsSync(outside)).toBe(true);
  });

  it('swallows a removal failure rather than throwing', async () => {
    const { media } = sandbox();
    const folder = media.reserveFolder('The Lantern Keeper', 2019);
    const video = await media.storeUpload(
      folder,
      'lantern.mp4',
      part('video bytes')
    );
    await media.storeUpload(folder, 'poster.jpg', part('poster bytes'));

    const release = holdOpen(join(folder, 'lantern.mp4'));
    try {
      // **Best-effort cleanup**: the row has already committed by the time
      // this runs, and a locked video — the stream route still on it — leaves
      // the Delete successful with a **Stranded folder**, not failed.
      expect(() => media.removeMovieFolder(video)).not.toThrow();
    } finally {
      release();
    }
  });
});

// --- 13 — Bulk import, Phase 2: "the tracer bullet" (issue #125) ------------

/**
 * A film's file where it lies under the **Library root** — `outside` is that
 * root here: the one tree the media domain reads from and never writes into.
 */
function sourceFile(outside: string, name: string, bytes: string): string {
  const source = join(outside, name);
  writeFileSync(source, bytes);
  return source;
}

/**
 * **Copy-in**: the **Bulk import** counterpart of `storeUpload` — the same
 * **Managed copy**, from a path instead of a stream. What it promises a caller
 * is the same thing too: a **Stored path**, and a file at the end of it.
 */
describe('createMedia — copyIn', () => {
  it('copies the bytes into the movie folder', async () => {
    const { media, outside } = sandbox();
    const folder = media.reserveFolder('Die Hard', 1988);
    const source = sourceFile(outside, 'die-hard.mkv', 'video bytes');

    await media.copyIn(folder, source);

    expect(readFileSync(join(folder, 'die-hard.mkv'), 'utf8')).toBe(
      'video bytes'
    );
  });

  it('answers the stored path — relative, forward-slashed, resolving to the copy', async () => {
    const { media, root, outside } = sandbox();
    const folder = media.reserveFolder('Die Hard', 1988);
    const source = sourceFile(outside, 'die-hard.mkv', 'video bytes');

    const stored = await media.copyIn(folder, source);

    expect(isAbsolute(stored)).toBe(false);
    expect(stored).toBe('die-hard-1988/die-hard.mkv');
    expect(stored).not.toContain('\\');
    expect(mediaFilePath(root, stored)).toBe(
      resolve(join(root, 'die-hard-1988', 'die-hard.mkv'))
    );
  });

  it('leaves the source exactly where and what it was', async () => {
    const { media, outside } = sandbox();
    const folder = media.reserveFolder('Die Hard', 1988);
    const source = sourceFile(outside, 'die-hard.mkv', 'video bytes');

    await media.copyIn(folder, source);

    // Copy, never move: the originals under the **Library root** survive a bad
    // run, and cancelling needs no undo.
    expect(existsSync(source)).toBe(true);
    expect(readFileSync(source, 'utf8')).toBe('video bytes');
  });

  it('takes several files into one movie folder', async () => {
    const { media, outside } = sandbox();
    const folder = media.reserveFolder('Die Hard', 1988);
    const video = sourceFile(outside, 'die-hard.mkv', 'video bytes');
    const poster = sourceFile(outside, 'poster.jpg', 'poster bytes');
    const track = sourceFile(outside, 'die-hard.en.srt', 'subtitle bytes');

    const stored = await Promise.all([
      media.copyIn(folder, video),
      media.copyIn(folder, poster),
      media.copyIn(folder, track),
    ]);

    expect(stored).toEqual([
      'die-hard-1988/die-hard.mkv',
      'die-hard-1988/poster.jpg',
      'die-hard-1988/die-hard.en.srt',
    ]);
    expect(readFileSync(join(folder, 'poster.jpg'), 'utf8')).toBe(
      'poster bytes'
    );
  });

  it('names the copy through the same sanitiser an upload goes through', async () => {
    const { media, outside } = sandbox();
    const folder = media.reserveFolder('Die Hard', 1988);
    const source = sourceFile(outside, 'Die Hard (1988) [1080p].mkv', 'bytes');

    const stored = await media.copyIn(folder, source);

    // Whatever `safeFilename` makes of it, the path answered is the file
    // written — the one promise `storeUpload` makes about a crafted name.
    expect(existsSync(join(folder, stored.split('/')[1]))).toBe(true);
    expect(stored.startsWith('die-hard-1988/')).toBe(true);
  });

  it('refuses a source that does not exist', async () => {
    const { media, outside } = sandbox();
    const folder = media.reserveFolder('Die Hard', 1988);

    await expect(
      media.copyIn(folder, join(outside, 'not-there.mkv'))
    ).rejects.toThrow();
    expect(existsSync(join(folder, 'not-there.mkv'))).toBe(false);
  });

  it('does not resolve until the bytes are on disk', async () => {
    const { media, outside } = sandbox();
    const folder = media.reserveFolder('Die Hard', 1988);
    const source = sourceFile(outside, 'die-hard.mkv', 'x'.repeat(256 * 1024));

    const stored = await media.copyIn(folder, source);

    // The row that points at the copy is written straight after this resolves.
    expect(readFileSync(join(folder, stored.split('/')[1])).length).toBe(
      256 * 1024
    );
  });
});
