import { MenuItem } from '@/components';
import { SpeechBubbleIcon } from '@/primitives';
import type { AudioTrack } from '@/types';

import { ChromeIconButton } from '../PlayerControls/PlayerControls.styles';
import { Root } from './AudioMenu.styles';

export interface AudioMenuProps {
  /** The offered **Audio tracks**, in the order the menu lists them. */
  tracks: AudioTrack[];
  /** The track playing now, marked in the menu. */
  playing: AudioTrack | null;
  /** A track pressed in the menu. The menu has already shut by then. */
  onChoose: (track: AudioTrack) => void;
  /**
   * Told whenever the menu opens or shuts: an open menu holds the **Chrome**
   * up, and the chrome is the screen's to hold, not this component's.
   */
  onOpenChange: (open: boolean) => void;
}

/**
 * The **Audio picker**: the round 44px chrome button named _Audio_, and the
 * menu it opens upward, one item per offered track, named by its label, the
 * playing one marked as `FilterDropdown` marks its value.
 *
 * Presentational: built on `Menu`, which owns the dismissal contract — Escape,
 * a press outside, a choice — and the keyboard walk.
 */
export function AudioMenu({
  tracks,
  playing,
  onChoose,
  onOpenChange,
}: AudioMenuProps) {
  return (
    <Root
      onOpenChange={onOpenChange}
      trigger={(props) => (
        <ChromeIconButton {...props} label="Audio" title="Audio" size={44}>
          <SpeechBubbleIcon size={22} />
        </ChromeIconButton>
      )}
    >
      {tracks.map((track) => (
        <MenuItem
          key={track.index}
          selected={playing?.index === track.index}
          onSelect={() => onChoose(track)}
        >
          {track.label}
        </MenuItem>
      ))}
    </Root>
  );
}
