import { useRef } from 'react';
import { Link } from 'react-router-dom';

import type { BusyPhase } from '@/types';
import { PlayIcon } from '../Icon/PlayIcon';
import {
  BusyLabel,
  Root,
  type ButtonVariant,
  type ButtonSize,
} from './Button.styles';

/** Everything both forms share — the whole of what the control looks like. */
interface ButtonFace {
  /** The button's visible text, and its accessible name. */
  label: string;
  /** primary = accent fill; secondary/danger = bordered; ghost = text-only. */
  variant?: ButtonVariant;
  /** sm = 40px / radius-sm; md = 50px / radius-md; lg = 58px / pill. */
  size?: ButtonSize;
  /** Optional leading glyph. */
  icon?: 'none' | 'play';
  /** Stretch to fill the container instead of hugging the label. */
  fullWidth?: boolean;
  /**
   * Set by `styled(Button)`, which is how each call site adds its own chrome
   * — its placement in a row, say — without a prop for it here.
   */
  className?: string;
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
      busy?: never;
      busyLabel?: never;
    })
  | (ButtonFace & {
      to?: never;
      /** Muted fill, no hover, and out of the tab order. */
      disabled?: boolean;
      onClick?: () => void;
      /**
       * The **Busy phase** of the work this button started. `waiting` locks
       * it on its idle label and face; `shown` reads `busyLabel` with a shine.
       */
      busy?: BusyPhase;
      /** The _-ing_ form drawn once `shown`: _Saving…_, _Adding…_. */
      busyLabel?: string;
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
  className,
  ...form
}: ButtonProps) {
  const busy = form.busy ?? 'idle';
  const rootRef = useRef<HTMLButtonElement>(null);
  // The idle width, read off the idle button as `busy` leaves `idle` and held
  // as `min-width` until it returns, so the _-ing_ label never resizes it.
  const heldWidth = useRef<number | null>(null);
  if (busy === 'idle') {
    heldWidth.current = null;
  } else if (heldWidth.current === null && rootRef.current !== null) {
    heldWidth.current = rootRef.current.offsetWidth || null;
  }

  const face = {
    className,
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

  if (busy === 'idle') {
    return (
      <Root
        ref={rootRef}
        type="button"
        {...face}
        $busy={false}
        disabled={form.disabled ?? false}
        onClick={form.onClick}
      >
        {content}
      </Root>
    );
  }

  // Busy: locked, so `onClick` cannot fire, but on the variant's own face.
  return (
    <Root
      ref={rootRef}
      type="button"
      {...face}
      $busy
      disabled
      aria-busy="true"
      style={
        heldWidth.current !== null
          ? { minWidth: `${heldWidth.current}px` }
          : undefined
      }
    >
      {icon === 'play' ? <PlayIcon /> : null}
      <BusyLabel aria-live="polite" $shine={busy === 'shown'}>
        {busy === 'shown' ? (form.busyLabel ?? label) : label}
      </BusyLabel>
    </Root>
  );
}
