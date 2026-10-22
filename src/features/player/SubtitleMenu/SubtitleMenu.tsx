import { MenuItem } from '@/components';
import { SubtitlesIcon } from '@/primitives';
import type { Subtitle } from '@/types';

import { SubtitleButton } from '../PlayerControls/PlayerControls.styles';
import { subtitleLabel } from '../subtitleLabel/subtitleLabel';
import { Root } from './SubtitleMenu.styles';

export interface SubtitleMenuProps {
  /** The film's **Subtitles**, listed in track order. */
  subtitles: Subtitle[];
  /** The Subtitle showing now, or `null` while subtitles are off. */
  track: Subtitle | null;
  /** A row pressed: the Subtitle, or `null` for _Off_. The menu has shut. */
  onChoose: (choice: Subtitle | null) => void;
  /**
   * Told whenever the menu opens or shuts: an open menu holds the **Chrome**
   * up, and the chrome is the screen's to hold, not this component's.
   */
  onOpenChange: (open: boolean) => void;
}

/**
 * The **Subtitle picker**: the CC pill (icon, _CC_, lit while subtitles show),
 * named _Subtitles_, as a menu button over the Audio picker's upward panel.
 * Items: _Off_, then one per Subtitle in track order, named by its **Subtitle
 * label**, the showing one marked, or _Off_ while off.
 *
 * Presentational: built on `Menu`, which owns the dismissal contract and the
 * keyboard walk.
 */
export function SubtitleMenu({
  subtitles,
  track,
  onChoose,
  onOpenChange,
}: SubtitleMenuProps) {
  const ordered = [...subtitles].sort((a, b) => a.position - b.position);

  return (
    <Root
      onOpenChange={onOpenChange}
      trigger={(props) => (
        <SubtitleButton
          {...props}
          type="button"
          aria-label="Subtitles"
          $on={track !== null}
        >
          <SubtitlesIcon size={22} />
          CC
        </SubtitleButton>
      )}
    >
      <MenuItem selected={track === null} onSelect={() => onChoose(null)}>
        Off
      </MenuItem>
      {ordered.map((subtitle) => (
        <MenuItem
          key={subtitle.id}
          selected={track?.id === subtitle.id}
          onSelect={() => onChoose(subtitle)}
        >
          {subtitleLabel(subtitle, subtitles)}
        </MenuItem>
      ))}
    </Root>
  );
}
