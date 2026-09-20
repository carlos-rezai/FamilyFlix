import {
  BangTriangleIcon,
  CheckCircleIcon,
  CrossCircleIcon,
  InfoCircleIcon,
} from '@/primitives';
import {
  AccentBar,
  Action,
  Body,
  Card,
  Dismiss,
  IconWrap,
  Message,
  Title,
  type SnackbarVariant,
} from './Snackbar.styles';

export type { SnackbarVariant } from './Snackbar.styles';

export interface SnackbarProps {
  /** Which **Snackbar variant** the card is: its colour, its glyph, its role. */
  variant: SnackbarVariant;
  /** The bold line above the message, when there is one. */
  title?: string;
  /** What the card says. */
  message: string;
  /** The bordered action's label; no label, no button. */
  actionLabel?: string;
  onAction?: () => void;
  /** Whether the card draws its ✕. On by default. */
  dismissible?: boolean;
  onDismiss?: () => void;
}

/** The glyph each variant draws, from the prototype's four SVGs. */
const GLYPH: Record<SnackbarVariant, typeof InfoCircleIcon> = {
  info: InfoCircleIcon,
  success: CheckCircleIcon,
  warning: BangTriangleIcon,
  error: CrossCircleIcon,
};

/**
 * The card's role, by variant: the two that can wait their turn are a
 * `status`, and the two that interrupt are an `alert` (design log 17 Q20).
 */
const ROLE: Record<SnackbarVariant, 'status' | 'alert'> = {
  info: 'status',
  success: 'status',
  warning: 'alert',
  error: 'alert',
};

/**
 * The transient bottom-right card, from `mol.Snackbar.dc.html`: an accent
 * bar, a glyph and an optional action all in the variant's colour, a title
 * over a dim message, and the card's own ✕ announcing itself as **Dismiss**.
 *
 * Presentational to the last prop: it owns no timer and no effect. What
 * unmounts it — and what dismisses it on the action — is the **Snackbar
 * stack**'s to wire.
 */
export function Snackbar({
  variant,
  title,
  message,
  actionLabel,
  onAction,
  dismissible = true,
  onDismiss,
}: SnackbarProps) {
  const Glyph = GLYPH[variant];

  return (
    <Card role={ROLE[variant]}>
      <AccentBar $variant={variant} />
      <IconWrap $variant={variant}>
        <Glyph size={20} />
      </IconWrap>

      <Body>
        {title !== undefined && title !== '' ? <Title>{title}</Title> : null}
        <Message>{message}</Message>
        {actionLabel !== undefined && actionLabel !== '' ? (
          <Action type="button" $variant={variant} onClick={onAction}>
            {actionLabel}
          </Action>
        ) : null}
      </Body>

      {dismissible ? (
        <Dismiss type="button" aria-label="Dismiss" onClick={onDismiss}>
          ✕
        </Dismiss>
      ) : null}
    </Card>
  );
}
