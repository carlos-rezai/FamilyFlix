import { VolumeIcon, VolumeMutedIcon } from '@/primitives';
import { toScalarPercent } from '@/utils';

import { ChromeIconButton } from '../PlayerControls/PlayerControls.styles';
import { useDragScalar } from '../useDragScalar/useDragScalar';
import { Fill, Group, Track } from './VolumeSlider.styles';

export interface VolumeSliderProps {
  /** How loud the film is, 0–1. */
  volume: number;
  /** Whether the film is silenced, which is not the same as turned all the way down. */
  muted: boolean;
  /** Set how loud the film is. Called as the pointer moves, not only on release. */
  onVolumeChange: (value: number) => void;
  /** Silence the film, or give back the level it was at. */
  onToggleMute: () => void;
}

/** Below this the speaker is drawn crossed out, as the prototype draws it. */
const NEAR_SILENT = 0.05;

/**
 * The volume control: the speaker button and the 90px bar beside it.
 *
 * **It follows the pointer as it moves**, which is the opposite of the
 * **Scrubber** and deliberately so: a parent turning a loud film down wants to
 * hear it get quieter while they are still holding the pointer, where seeking
 * on every move would fight the hand that is dragging the knob. The two share
 * `useDragScalar` and not one styled component — they differ in height, knob
 * and colour, and a `Slider` primitive with a prop per difference is the thing
 * being avoided.
 *
 * **Muted, near-silent and audible are three states the family can tell
 * apart.** The glyph is crossed for the first two, so someone who cannot hear
 * anything can see why; the button says "Unmute" only for the first, because a
 * film turned all the way down is not a film that was silenced, and they are
 * not the same thing to undo. Muted draws an empty bar without touching the
 * level underneath, which is what unmute gives back.
 */
export function VolumeSlider({
  volume,
  muted,
  onVolumeChange,
  onToggleMute,
}: VolumeSliderProps) {
  const { trackRef, onPointerDown } = useDragScalar<HTMLDivElement>({
    onDrag: onVolumeChange,
    onCommit: onVolumeChange,
  });

  const level = muted ? 0 : volume;
  const silenced = muted || volume < NEAR_SILENT;

  return (
    <Group>
      <ChromeIconButton
        label={muted ? 'Unmute' : 'Mute'}
        size={44}
        onClick={onToggleMute}
      >
        {silenced ? <VolumeMutedIcon size={22} /> : <VolumeIcon size={22} />}
      </ChromeIconButton>
      <Track
        ref={trackRef}
        role="slider"
        aria-label="Volume"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(level * 100)}
        onPointerDown={onPointerDown}
      >
        <Fill $percent={toScalarPercent(level)} />
      </Track>
    </Group>
  );
}
