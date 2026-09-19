import type { PlaybackComponentInfo } from '@/types';

import type { ComponentSlot } from '../../playback/componentSlot/componentSlot';
import type { PlaybackComponent } from '../../playback/ffmpegComponent/ffmpegComponent';

/**
 * What a slot says about a component it was given no **Component info** for:
 * the machine's own, weighed by nothing. Every suite that takes the default
 * cares only that there is a component at all — the ones that read the row
 * hand their own info in.
 */
const DEFAULT_INFO: PlaybackComponentInfo = {
  source: 'default',
  bytes: 0,
  files: [],
};

/**
 * A **Component slot** that holds one component and never changes: the double
 * every suite reaches the playback domain through since it stopped being
 * composed over a component.
 *
 * It is fixed in both senses. `current()` answers the same component on every
 * call, so a suite that asserts what the domain decided is asserting the
 * domain rather than the slot; and it **refuses to receive or remove**,
 * because a double that quietly accepted an upload would let a suite believe
 * it had installed a component that nothing ever swapped. A test that is about
 * a component changing mid-run writes its own slot.
 *
 * It is a test double, so it lives beside `heldCopy` and `libraryFixture` and
 * nothing that ships imports it.
 */
export function fixedSlot(
  component: PlaybackComponent | null,
  info: PlaybackComponentInfo = DEFAULT_INFO
): ComponentSlot {
  const refuse = (): never => {
    throw new Error('the fixed slot neither receives nor removes');
  };

  return {
    current: () => component,
    info: () => (component === null ? null : info),
    receive: refuse,
    remove: refuse,
  };
}
