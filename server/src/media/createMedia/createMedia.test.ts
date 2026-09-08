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
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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
    // path the browser cannot ask for and the seed's own `<slug>/<slug>.mp4`
    // does not spell.
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
