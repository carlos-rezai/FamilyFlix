import {
  useEffect,
  useId,
  useRef,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react';
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
  /** What the ✕, Escape and a press on the scrim all ask for. */
  onClose: () => void;
  /** The card's body, below the header. */
  children: ReactNode;
}

/**
 * What a Tab can land on inside the card, in reading order. `tabindex="-1"` is
 * excluded on purpose: the card itself carries it, and it is where focus
 * starts, not a stop on the ring.
 */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const focusablesIn = (card: HTMLElement) =>
  Array.from(card.querySelectorAll<HTMLElement>(FOCUSABLE));

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
 * The whole of the dismissal contract lives here, on the argument `Menu` made:
 * it is the half that is easy to half-implement. Three ways out — the ✕,
 * Escape, a press on the scrim — and each one asks the caller to close through
 * `onClose`; a press inside the card is not a way out. On open, focus moves to
 * the card itself and to no button, so a reflexive Enter does nothing. Tab is
 * held inside: off the last focusable it wraps to the first, and Shift+Tab off
 * the first wraps to the last, so focus never reaches the scrimmed page. On
 * close, focus goes back to whatever had it before the card opened. Bespoke
 * rather than a native `<dialog>` — jsdom cannot drive `showModal()` — and no
 * scroll-locking behind the scrim, because the prototype does not.
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
  const cardRef = useRef<HTMLDivElement>(null);

  // Focus in on open, and back out on close, to the element that had it. Taken
  // as the card opens rather than as it shuts: the ✕ that was pressed is gone
  // with the card by the time the close runs, and the active element by then
  // is the body.
  useEffect(() => {
    if (!open) {
      return;
    }

    const previous = document.activeElement;
    cardRef.current?.focus();

    return () => {
      if (previous instanceof HTMLElement) {
        previous.focus();
      }
    };
  }, [open]);

  // The keys, listened for only while open: Escape is the second way out, and
  // Tab at either end of the card's focusables wraps rather than leaving.
  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }

      const card = cardRef.current;
      if (event.key !== 'Tab' || card === null) {
        return;
      }

      const focusables = focusablesIn(card);
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (first === undefined || last === undefined) {
        event.preventDefault();
        return;
      }

      const active = document.activeElement;
      if (event.shiftKey) {
        // From the first focusable, or from the card itself, backwards is off
        // the top of the card; the ring closes on its last focusable.
        if (active === first || active === card || !card.contains(active)) {
          event.preventDefault();
          last.focus();
        }
      } else if (active === last || !card.contains(active)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  // The third way out: a press that lands on the scrim itself. A press inside
  // the card bubbles up to here too, and its target says where it started.
  const onScrimClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  return createPortal(
    <Scrim onClick={onScrimClick}>
      <Card
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
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
