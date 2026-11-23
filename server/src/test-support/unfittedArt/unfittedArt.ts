import type { Playback } from '../../playback/createPlayback/createPlayback';

/**
 * The narrow **Playback** `createMedia` takes, `Pick<Playback, 'fitArt'>`,
 * for a suite that is not about the fitting: `fitArt` answers no fit for want
 * of a component (`no-component`), so every picture is stored as given, as it
 * was before Seamless art. Handed a `fitArt`, it answers through that one,
 * for the suites that script a fit; `framelessPlayback`'s twin.
 */
export function unfittedArt(
  fitArt?: Playback['fitArt']
): Pick<Playback, 'fitArt'> {
  return {
    fitArt: fitArt ?? (async () => ({ kind: 'none', reason: 'no-component' })),
  };
}
