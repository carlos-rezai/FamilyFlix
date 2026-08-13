import { Link } from 'react-router-dom';

import { PlayIcon } from '../Icon/PlayIcon';
import { Root, type ButtonVariant, type ButtonSize } from './Button.styles';

/** Everything both forms share — the whole of what the control looks like. */
interface ButtonFace {
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
}

/**
 * Two forms, one face. A destination makes it a link; a handler makes it a
 * button. The union rather than a flat set of optionals, because the two do not
 * mix: a link cannot be disabled, and a button cannot be middle-clicked into a
 * new window, so a `Button` that claimed both would be lying about one of them.
 */
export type ButtonProps =
  | (ButtonFace & {
      /**
       * Renders a router `Link` to this route instead of a button. For controls
       * that are genuinely navigations — the parent can middle-click them, and
       * assistive technology announces a link rather than a button.
       */
      to: string;
      disabled?: never;
      onClick?: never;
    })
  | (ButtonFace & {
      to?: never;
      /** Muted fill, no hover, and out of the tab order. */
      disabled?: boolean;
      onClick?: () => void;
    });

/**
 * The app's text button — four variants across two sizes, with an optional
 * leading play glyph. Presentational: it renders a label and either emits
 * `onClick` or navigates to `to`.
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
  ...form
}: ButtonProps) {
  const face = {
    $variant: variant,
    $size: size,
    $fullWidth: fullWidth,
  } as const;

  // The glyph is decorative — the label already says "Play", so `IconBase`
  // marks it aria-hidden and the accessible name stays the label alone.
  const content = (
    <>
      {icon === 'play' ? <PlayIcon /> : null}
      {label}
    </>
  );

  if (form.to !== undefined) {
    return (
      <Root as={Link} to={form.to} {...face}>
        {content}
      </Root>
    );
  }

  return (
    <Root
      type="button"
      {...face}
      disabled={form.disabled ?? false}
      onClick={form.onClick}
    >
      {content}
    </Root>
  );
}
