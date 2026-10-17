import {
  createPlayback,
  type Playback,
} from '../../playback/createPlayback/createPlayback';
import { fixedSlot } from '../fixedSlot/fixedSlot';
import { sandboxRoot } from '../sandboxRoot/sandboxRoot';

/**
 * A **Playback** that never takes a picture: `createPlayback` over a fresh
 * sandbox, no component and no **Library folders**, so `frame` answers no
 * frame for want of one (`no-component`)
 * — or answers through the `frame` handed, for the suites that script one.
 * For the `createEnrichment` suites, which must hand the domain a Playback
 * whatever they are about; `offlineTmdb`'s twin.
 */
export function framelessPlayback(frame?: Playback['frame']): Playback {
  const playback = createPlayback(
    sandboxRoot('familyflix-no-frame-'),
    fixedSlot(null),
    () => null
  );
  return frame === undefined ? playback : { ...playback, frame };
}
