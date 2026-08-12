import { PlayIcon } from '../Icon/PlayIcon';
import { Root, type ButtonVariant, type ButtonSize } from './Button.styles';

export interface ButtonProps {
  /** The button's visible text, and its accessible name. */
  label: string;
  /** primary = accent fill; secondary/danger = bordered; ghost = text-only. */
  variant?: ButtonVariant;
  /** md = 50px / radius-md; lg = 58px / pill. */
  size?: ButtonSize;
  /** Optional leading glyph. */
  icon?: 'none' | 'play';
  /** Stretch to fill the container instead of hugging the label. */
  fullWidth?: boolean;
  /** Muted fill, no hover, and out of the tab order. */
  disabled?: boolean;
  onClick?: () => void;
}

/**
 * The app's text button — four variants across two sizes, with an optional
 * leading play glyph. Presentational: it renders a label and emits `onClick`.
 *
 * Built to the full COMPONENT-SPEC surface rather than to its first caller.
 * MovieForm (Save/Cancel), MoviePage (Play), SettingsPage (Update/Check),
 * ImportFlow (Start/Cancel/Finish) and ExportModal (Export/Cancel/Done) between
 * them use every variant, size, and boolean here.
 */
export function Button({
  label,
  variant = 'primary',
  size = 'md',
  icon = 'none',
  fullWidth = false,
  disabled = false,
  onClick,
}: ButtonProps) {
  return (
    <Root
      type="button"
      $variant={variant}
      $size={size}
      $fullWidth={fullWidth}
      disabled={disabled}
      onClick={onClick}
    >
      {/* Decorative — the label already says "Play", so `IconBase` marks it
          aria-hidden and the accessible name stays the label alone. */}
      {icon === 'play' ? <PlayIcon /> : null}
      {label}
    </Root>
  );
}
