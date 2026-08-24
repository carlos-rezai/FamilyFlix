import { screen } from '@testing-library/react';

/**
 * The header's flex spacer — the one child that grows to split the strip.
 *
 * Every layout's header is one row with a spacer in the middle of it, and what a
 * test wants to know is which side of that spacer something landed on. The
 * spacer has no role and no text, so it is found by the one thing that makes it
 * the spacer: it is the child that grows.
 *
 * Throws when the header has lost it, rather than handing back nothing for the
 * caller to assert around: a missing spacer is the failure, and it reads better
 * as one sentence here than as three tests going quiet about where their
 * elements sit relative to something that isn't there.
 */
export function headerSpacer(): Element {
  const children = Array.from(screen.getByRole('banner').children);
  const spacer = children.find(
    (child) => getComputedStyle(child).flexGrow === '1'
  );
  if (!spacer) {
    throw new Error('The header has no flex spacer to split the strip.');
  }
  return spacer;
}
