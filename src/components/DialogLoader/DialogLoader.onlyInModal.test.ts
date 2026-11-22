// @vitest-environment node
//
// 71, Busy overlay, Phase 7 (issue #682): the **Dialog loader** is a layer
// of `Modal`, drawn over a dialog's own card through its `loader` prop. No
// dialog draws one of its own, and no dialog early-returns a second `Modal`
// for its loader: a dialog that passes `loader` renders exactly one `Modal`,
// so its card keeps its size as the loader shows.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  shippingSources,
  shippingSourcesMatching,
  withoutComments,
} from '@/test-support/shippingSources/shippingSources';

/** The frontend's source root, as every structural guard reads it. */
const SRC = 'src';

/** Where `Modal` and the loader itself live: the only places it may be drawn. */
const OWNERS = [`${SRC}/components/Modal/`, `${SRC}/components/DialogLoader/`];

/** A shipping `.tsx` outside the two owners: a file that could be a dialog. */
const isDialogSource = (path: string) =>
  path.endsWith('.tsx') && !OWNERS.some((owner) => path.startsWith(owner));

describe('DialogLoader: drawn only through a Modal’s loader', () => {
  it('is rendered by no dialog of its own', () => {
    const drawing = shippingSourcesMatching(SRC, /<DialogLoader\b/).filter(
      isDialogSource
    );

    expect(drawing).toEqual([]);
  });

  it('is given to one Modal per dialog: no second Modal for the loader', () => {
    const twoCards = shippingSources(SRC)
      .filter(isDialogSource)
      .filter((path) => {
        const code = withoutComments(readFileSync(path, 'utf8'));
        return (
          /\bloader=/.test(code) && (code.match(/<Modal\b/g) ?? []).length !== 1
        );
      });

    expect(twoCards).toEqual([]);
  });
});
