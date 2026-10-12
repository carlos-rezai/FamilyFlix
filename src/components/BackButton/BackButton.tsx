import { ChevronLeftIcon } from '@/primitives';
import { layout } from '@/tokens';

import { Root } from './BackButton.styles';

export interface BackButtonProps {
  /** What a press does — the caller's `useGoBack`, with its own **Landing**. */
  onClick: () => void;
  /** The accessible name and the tooltip; _Back_ unless the screen says where. */
  label?: string;
}

const SIZE = parseInt(layout.backSize, 10);
const CHEVRON_SIZE = 20;

/**
 * The **Back button**: one 44px glass circle, pinned top-left of the viewport,
 * on every screen but the player. One face and one place, so leaving any
 * screen is the same reach of the hand. Presentational — the caller decides
 * where Back goes; this decides only where Back is.
 */
export function BackButton({ onClick, label = 'Back' }: BackButtonProps) {
  return (
    <Root label={label} title={label} size={SIZE} onClick={onClick}>
      <ChevronLeftIcon size={CHEVRON_SIZE} />
    </Root>
  );
}
