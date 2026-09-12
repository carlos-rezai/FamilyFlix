import { useId, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import {
  Scrim,
  Card,
  Header,
  HeaderRow,
  IconTile,
  Heading,
  Title,
  Subtitle,
  CloseButton,
  Body,
} from './Modal.styles';

export interface ModalProps {
  /** Whether the dialog is on screen. Closed, it renders nothing at all. */
  open: boolean;
  /** The heading, and the dialog's accessible name. */
  title: string;
  /** The faint line under the heading. */
  subtitle?: string;
  /**
   * The glyph in the 44px tile beside the heading. Decorative — kept out of
   * the accessible name — and when there is none, the tile is not drawn either.
   */
  icon?: ReactNode;
  /** What the ✕ asks for. */
  onClose: () => void;
  /** The card's body, below the header. */
  children: ReactNode;
}

/**
 * The scrimmed, centred card every dialog in the app is drawn on — the Delete
 * dialog first, the Export dialog after it.
 *
 * Rendered through a portal to the document body rather than in place: a scrim
 * inside the detail page's scroll container would scroll with it, and the
 * fixed corner controls it must cover sit at their own z-index. Mounting only
 * when open, rather than hiding when closed, is what lets a caller keep one
 * `<Modal>` in its tree without paying for it.
 *
 * What this carries is the surface and the ✕. The remaining ways out — Escape,
 * a press on the scrim — and the focus contract are issue #4's, and land here.
 */
export function Modal({
  open,
  title,
  subtitle,
  icon,
  onClose,
  children,
}: ModalProps) {
  const titleId = useId();

  if (!open) {
    return null;
  }

  return createPortal(
    <Scrim>
      <Card role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <Header>
          <HeaderRow>
            {icon === undefined ? null : (
              <IconTile aria-hidden="true">{icon}</IconTile>
            )}
            <Heading>
              <Title id={titleId}>{title}</Title>
              {subtitle === undefined ? null : <Subtitle>{subtitle}</Subtitle>}
            </Heading>
            <CloseButton type="button" aria-label="Close" onClick={onClose}>
              ✕
            </CloseButton>
          </HeaderRow>
        </Header>
        <Body>{children}</Body>
      </Card>
    </Scrim>,
    document.body
  );
}
