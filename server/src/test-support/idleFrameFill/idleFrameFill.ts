import type { FrameFill } from '../../enrichment/createFrameFill/createFrameFill';

/**
 * A **Frame fill** that takes nothing: every series' turn is done at once,
 * no frame asked and no Still written. For the route suites that compose the
 * router for something else and must still hand it a Frame fill; the
 * `idleLayoutFill` beside it.
 */
export function idleFrameFill(): FrameFill {
  return { fill: () => Promise.resolve() };
}
