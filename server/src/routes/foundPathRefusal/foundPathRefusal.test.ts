// @vitest-environment node
//
// 48 — Add a show folder, refactor (issue #421): a bad found path, one wording.
//
// `foundPathRefusal(path, kind)` is the route layer's body-reading helper both
// adds read for a **Found file**: a relative path is _Not an absolute path_, a
// path of another kind than its slot holds is _Not a video file_ or _Not a
// subtitle file_, naming the file; an absolute path of the right kind is
// taken (`null`).

import { join, parse } from 'node:path';
import { describe, expect, it } from 'vitest';

import { foundPathRefusal } from './foundPathRefusal';

const root = join(parse(process.cwd()).root, 'familyflix-found');

describe('foundPathRefusal', () => {
  it('refuses a relative path', () => {
    expect(foundPathRefusal('Heat (1995)/Heat.1995.mp4', 'video')).toBe(
      'Not an absolute path: "Heat (1995)/Heat.1995.mp4"'
    );
  });

  it('takes an absolute path of the slot’s kind', () => {
    expect(foundPathRefusal(join(root, 'Heat.1995.mp4'), 'video')).toBeNull();
    expect(
      foundPathRefusal(join(root, 'Heat.1995.srt'), 'subtitle')
    ).toBeNull();
  });

  it('refuses a subtitle in a video slot', () => {
    expect(foundPathRefusal(join(root, 'Heat.1995.srt'), 'video')).toBe(
      'Not a video file: "Heat.1995.srt"'
    );
  });

  it('refuses a video in a subtitle slot', () => {
    expect(foundPathRefusal(join(root, 'Heat.1995.mp4'), 'subtitle')).toBe(
      'Not a subtitle file: "Heat.1995.mp4"'
    );
  });
});
