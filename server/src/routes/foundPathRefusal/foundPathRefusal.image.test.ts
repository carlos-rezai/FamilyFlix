// @vitest-environment node
//
// 76, Whole add, Phase 2 (issue #717): a found image, admitted.
//
// `FoundKind` gains `'image'`, checked with `isImageFilename`: an absolute
// image is taken, a file of another kind is refused, worded as the other
// kinds are. A relative path is refused before its kind is read, as for every
// kind (the route suite covers it for images).

import { join, parse } from 'node:path';
import { describe, expect, it } from 'vitest';

import { foundPathRefusal } from './foundPathRefusal';

const root = join(parse(process.cwd()).root, 'familyflix-found');

describe('foundPathRefusal: an image', () => {
  it('takes an absolute image', () => {
    expect(foundPathRefusal(join(root, 'poster.jpg'), 'image')).toBeNull();
  });

  it('refuses a video in an image slot', () => {
    expect(foundPathRefusal(join(root, 'Heat.1995.mp4'), 'image')).toMatch(
      /^Not an? image file: "Heat\.1995\.mp4"$/
    );
  });
});
