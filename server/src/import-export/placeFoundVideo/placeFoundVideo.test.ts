// @vitest-environment node
//
// 48 — Add a show folder, Phase 2 (issue #418): the **Placed video** rule.
//
// `placeFoundVideo(folders, path, mode)` is the importer's private
// `linkedVideo` + `listedFolderOf` lifted out, so the importer, the Resolve
// and the two add routes share one rule. In **Link**, a found video under a
// listed **Library folder** answers a **Linked video** — its `videoPath`
// relative to that folder with forward slashes, its `videoFolderId` the
// folder's id — and of nested listed folders the deepest is the one. A path
// under no listed folder, and any path in **Copy**, answers `null`: the caller
// copies.
//
// Against real files under `sandboxRoot`, so a path the rule resolves agrees
// with the one the test built.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  LINK_REFUSAL,
  placeFoundVideo,
  placeFoundVideos,
} from './placeFoundVideo';
import type { StoredLibraryFolder } from '../../library';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';

/** A video file at a path under `root`, made. */
function videoAt(root: string, relative: string): string {
  const file = join(root, relative);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, 'video bytes');
  return file;
}

/** A listed Library folder at a path under `root`, made. */
function listed(
  root: string,
  id: string,
  relative: string
): StoredLibraryFolder {
  const path = join(root, relative);
  mkdirSync(path, { recursive: true });
  return { id, path, titleCount: 0 };
}

describe('placeFoundVideo — Link', () => {
  it('answers a Linked video relative to the listed folder it lies under', () => {
    const root = sandboxRoot('familyflix-place-found-');
    const shows = listed(root, 'shows', 'Shows');
    const movies = listed(root, 'movies', 'Movies');
    const pilot = videoAt(
      root,
      join('Shows', 'Harbor and Vine', 'Season 1', 'S01E01.mp4')
    );

    expect(placeFoundVideo([movies, shows], pilot, 'link')).toEqual({
      videoPath: 'Harbor and Vine/Season 1/S01E01.mp4',
      videoFolderId: 'shows',
    });
  });

  it('chooses the deepest of nested listed folders', () => {
    const root = sandboxRoot('familyflix-place-found-');
    const outer = listed(root, 'outer', 'Family');
    const inner = listed(root, 'inner', join('Family', 'Shows'));
    const pilot = videoAt(
      root,
      join('Family', 'Shows', 'Harbor and Vine', 'S01E01.mp4')
    );

    expect(placeFoundVideo([outer, inner], pilot, 'link')).toEqual({
      videoPath: 'Harbor and Vine/S01E01.mp4',
      videoFolderId: 'inner',
    });
    expect(placeFoundVideo([inner, outer], pilot, 'link')).toEqual({
      videoPath: 'Harbor and Vine/S01E01.mp4',
      videoFolderId: 'inner',
    });
  });

  it('answers null for a path under no listed folder', () => {
    const root = sandboxRoot('familyflix-place-found-');
    const shows = listed(root, 'shows', 'Shows');
    const elsewhere = videoAt(root, join('Downloads', 'S01E01.mp4'));

    expect(placeFoundVideo([shows], elsewhere, 'link')).toBeNull();
  });

  it('answers null for a path in a sibling whose name only starts like a listed folder', () => {
    const root = sandboxRoot('familyflix-place-found-');
    const shows = listed(root, 'shows', 'Shows');
    const sibling = videoAt(root, join('Shows Old', 'S01E01.mp4'));

    expect(placeFoundVideo([shows], sibling, 'link')).toBeNull();
  });

  it('answers null when no folder is listed', () => {
    const root = sandboxRoot('familyflix-place-found-');
    const pilot = videoAt(root, join('Shows', 'S01E01.mp4'));

    expect(placeFoundVideo([], pilot, 'link')).toBeNull();
  });
});

describe('placeFoundVideo — Copy', () => {
  it('answers null even for a path under a listed folder', () => {
    const root = sandboxRoot('familyflix-place-found-');
    const shows = listed(root, 'shows', 'Shows');
    const pilot = videoAt(root, join('Shows', 'Harbor and Vine', 'S01E01.mp4'));

    expect(placeFoundVideo([shows], pilot, 'copy')).toBeNull();
  });
});

describe('placeFoundVideos — the rule over a list', () => {
  it('places every found path under a listed folder in Link', () => {
    const root = sandboxRoot('familyflix-place-found-');
    const shows = listed(root, 'shows', 'Shows');
    const one = videoAt(root, join('Shows', 'Harbor and Vine', 'S01E01.mp4'));
    const two = videoAt(root, join('Shows', 'Harbor and Vine', 'S01E02.mp4'));

    expect(placeFoundVideos([shows], [one, two], 'link')).toEqual({
      kind: 'placed',
      placed: [
        { videoPath: 'Harbor and Vine/S01E01.mp4', videoFolderId: 'shows' },
        { videoPath: 'Harbor and Vine/S01E02.mp4', videoFolderId: 'shows' },
      ],
    });
  });

  it('places a picked row among found ones as null', () => {
    const root = sandboxRoot('familyflix-place-found-');
    const shows = listed(root, 'shows', 'Shows');
    const one = videoAt(root, join('Shows', 'Harbor and Vine', 'S01E01.mp4'));

    expect(placeFoundVideos([shows], [undefined, one], 'link')).toEqual({
      kind: 'placed',
      placed: [
        null,
        { videoPath: 'Harbor and Vine/S01E01.mp4', videoFolderId: 'shows' },
      ],
    });
  });

  it('refuses the whole list in Link when one found path lies outside', () => {
    const root = sandboxRoot('familyflix-place-found-');
    const shows = listed(root, 'shows', 'Shows');
    const inside = videoAt(
      root,
      join('Shows', 'Harbor and Vine', 'S01E01.mp4')
    );
    const outside = videoAt(root, join('Downloads', 'S01E02.mp4'));

    expect(placeFoundVideos([shows], [inside, outside], 'link')).toEqual({
      kind: 'refused',
      error: LINK_REFUSAL,
    });
  });

  it('answers every null in Copy, inside or out', () => {
    const root = sandboxRoot('familyflix-place-found-');
    const shows = listed(root, 'shows', 'Shows');
    const inside = videoAt(
      root,
      join('Shows', 'Harbor and Vine', 'S01E01.mp4')
    );
    const outside = videoAt(root, join('Downloads', 'S01E02.mp4'));

    expect(
      placeFoundVideos([shows], [inside, outside, undefined], 'copy')
    ).toEqual({ kind: 'placed', placed: [null, null, null] });
  });
});
