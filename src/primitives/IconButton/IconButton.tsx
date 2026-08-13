import type {
  AriaAttributes,
  KeyboardEvent,
  MouseEvent,
  ReactNode,
  Ref,
} from 'react';

import { Root, type IconButtonVariant } from './IconButton.styles';

export interface IconButtonProps {
  /**
   * The icon this button draws — an Icon primitive at whatever size the call
   * site wants. A child rather than a `name` enum, as COMPONENT-SPEC §226
   * instructs: the prototype's seven-name list was a preview convenience, and a
   * new icon should not mean widening this primitive.
   */
  children: ReactNode;
  /**
   * The accessible name. Required, because an icon-only button without one
   * announces as "button" and nothing else — and the seven hand-styled buttons
   * this replaces could not guarantee it.
   */
  label: string;
  /**
   * The hover tooltip, when the call site wants one. Deliberately separate from
   * `label`: a control can be named for assistive technology without also
   * growing a tooltip nothing designed.
   */
  title?: string;
  /** The square's edge, in px. */
  size?: number;
  /** ghost = transparent over faint ink; outline = bordered. */
  variant?: IconButtonVariant;
  /**
   * The toggle's state, as `aria-pressed`. Omitted for a plain action, so a
   * button that toggles nothing does not claim to.
   */
  pressed?: boolean;
  /** Muted, unclickable, and out of the tab order. */
  disabled?: boolean;
  /**
   * What kind of popup this button opens, and whether it is open. Named
   * explicitly rather than swept up by a `...rest` spread: these two are the
   * only ARIA attributes a caller has ever needed to set here, and listing them
   * keeps the surface something a reader can see the whole of.
   */
  'aria-haspopup'?: AriaAttributes['aria-haspopup'];
  'aria-expanded'?: AriaAttributes['aria-expanded'];
  /** Set by `styled(IconButton)` — the whole basis of per-call-site chrome. */
  className?: string;
  ref?: Ref<HTMLButtonElement>;
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
  onKeyDown?: (event: KeyboardEvent<HTMLButtonElement>) => void;
}

/**
 * The app's round icon-only button — the gear in the header, the carousel's
 * arrows, the favorite heart on a card, the ⋯ overflow trigger, and the detail
 * page's two circles.
 *
 * It owns behaviour and geometry: the square, the centring, the pill corner,
 * `type="button"`, the accessible name, and the optional pressed state. It does
 * **not** own the translucent-over-artwork chrome three of those call sites
 * wear, because their blurs and alphas differ from each other by accident
 * rather than by design; freezing that into a variant enum would make an API
 * out of the drift. Those call sites extend it with `styled(IconButton)`, which
 * is why `className` is forwarded.
 *
 * The prototype's `active` face (a filled surface for a selected control) is not
 * here: every toggle in the app today paints its own on-state, so the face has
 * no caller, and `pressed` carries the part a screen reader needs.
 */
export function IconButton({
  children,
  label,
  title,
  size = 46,
  variant = 'ghost',
  pressed,
  disabled = false,
  'aria-haspopup': ariaHasPopup,
  'aria-expanded': ariaExpanded,
  className,
  ref,
  onClick,
  onKeyDown,
}: IconButtonProps) {
  return (
    <Root
      ref={ref}
      type="button"
      className={className}
      aria-label={label}
      aria-pressed={pressed}
      aria-haspopup={ariaHasPopup}
      aria-expanded={ariaExpanded}
      title={title}
      disabled={disabled}
      $size={size}
      $variant={variant}
      onClick={onClick}
      onKeyDown={onKeyDown}
    >
      {children}
    </Root>
  );
}
