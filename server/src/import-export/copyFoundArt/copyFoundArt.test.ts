// @vitest-environment node
//
// 76, Whole add, Phase 2 (issue #717): a title's found art, copied in.
//
// `copyFoundArt(media, folder, art)` copies a title's found **Poster** and
// **Backdrop** through `Media.copyIn` into the **Media folder** root and
// resolves to `CopiedArt`, each file's **Stored path** (`null` for none). It
// rejects on the first copy that breaks; the caller takes the folder back.
// Art is always copied, never moved: the picked folder is left as it was.
//
// Over a real `createMedia` and a temp Media folder under `sandboxRoot`.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { copyFoundArt } from './copyFoundArt';
import { createMedia } from '../../media/createMedia/createMedia';
import { unfittedArt } from '../../test-support/unfittedArt/unfittedArt';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';

/** A file at `relative` under `root`, made, holding its own name. */
function fileAt(root: string, relative: string): string {
  const file = join(root, relative);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, relative);
  return file;
}

/** A media root, a reserved Media folder in it, and a picked show beside. */
function freshFolder() {
  const root = sandboxRoot('familyflix-copy-found-art-');
  const mediaRoot = join(root, 'media');
  const media = createMedia(mediaRoot, unfittedArt());
  const folder = media.reserveFolder('The Show', 2019);
  return { root, mediaRoot, media, folder };
}

describe('copyFoundArt', () => {
  it('copies the found poster and backdrop into the Media folder root', async () => {
    const { root, mediaRoot, media, folder } = freshFolder();
    const poster = fileAt(
      root,
      join('The Show (2019)', 'Images', 'poster.jpg')
    );
    const backdrop = fileAt(
      root,
      join('The Show (2019)', 'Images', 'backdrop.jpg')
    );

    const copied = await copyFoundArt(media, folder, { poster, backdrop });

    expect(copied.poster).toMatch(/^[^/]+\/poster\.jpg$/);
    expect(copied.backdrop).toMatch(/^[^/]+\/backdrop\.jpg$/);
    expect(
      readFileSync(join(mediaRoot, copied.poster as string)).toString()
    ).toBe(join('The Show (2019)', 'Images', 'poster.jpg'));
    expect(existsSync(join(mediaRoot, copied.backdrop as string))).toBe(true);
    expect(existsSync(poster)).toBe(true);
    expect(existsSync(backdrop)).toBe(true);
  });

  it('answers null for art not found, copying nothing for it', async () => {
    const { root, media, folder } = freshFolder();
    const poster = fileAt(
      root,
      join('The Show (2019)', 'Images', 'poster.jpg')
    );

    const copied = await copyFoundArt(media, folder, {
      poster,
      backdrop: null,
    });

    expect(copied.poster).toMatch(/\/poster\.jpg$/);
    expect(copied.backdrop).toBeNull();
  });

  it('rejects when a found image is not there', async () => {
    const { root, media, folder } = freshFolder();

    await expect(
      copyFoundArt(media, folder, {
        poster: join(root, 'Gone', 'poster.jpg'),
        backdrop: null,
      })
    ).rejects.toThrow();
  });
});
