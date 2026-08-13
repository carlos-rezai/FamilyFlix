import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type Ref,
} from 'react';

import { Slot, Panel, Item, Glyph } from './Menu.styles';

/**
 * What the caller must spread onto whatever control opens the menu. Handing
 * these out rather than rendering the trigger itself is what lets the ⋯
 * overflow, a filter dropdown and a header gear share one dismissal contract
 * while looking nothing alike.
 */
export interface MenuTriggerProps {
  ref: Ref<HTMLButtonElement>;
  'aria-haspopup': 'menu';
  'aria-expanded': boolean;
  onClick: () => void;
}

export interface MenuProps {
  /** Renders the opening control, given the props it must spread. */
  trigger: (props: MenuTriggerProps) => ReactNode;
  /** The menu's items — `MenuItem`s, each of which shuts the menu when used. */
  children: ReactNode;
  /** Set by `styled(Menu)`, which is how a caller places the slot. */
  className?: string;
}

/**
 * Shuts the menu the item was activated from. A context rather than a prop
 * threaded through every item: an item that forgot to close would leave the
 * menu hanging open over the screen it just navigated to, and there is no
 * reason to let a caller make that mistake.
 */
const CloseContext = createContext<() => void>(() => undefined);

export interface MenuItemProps {
  /** The item's visible text, and its accessible name. */
  children: ReactNode;
  /** Decorative leading character, kept out of the accessible name. */
  glyph?: ReactNode;
  /** What the item does. The menu is already closing by the time this runs. */
  onSelect: () => void;
}

/** One row of a `Menu`. Closes the menu, then does its own work. */
export function MenuItem({ children, glyph, onSelect }: MenuItemProps) {
  const close = useContext(CloseContext);

  return (
    <Item
      type="button"
      onClick={() => {
        // Close first: closing returns focus to the trigger, and a navigation
        // that ran first would be handing focus back on a page that has gone.
        close();
        onSelect();
      }}
    >
      {glyph === undefined ? null : <Glyph aria-hidden="true">{glyph}</Glyph>}
      {children}
    </Item>
  );
}

/**
 * A popup menu: the panel, and the whole contract for getting rid of it.
 *
 * Closing is deliberately symmetrical — Escape, a press outside, and activating
 * an item all shut it, and each one hands focus back to the trigger, so a
 * keyboard user is never dropped at the top of the document. That, rather than
 * the panel's border and shadow, is the part worth having in one place: it is
 * the half that is easy to half-implement.
 *
 * The trigger is the caller's, because the menus that need this behaviour look
 * nothing like each other. What the caller gets handed is a ref (so focus can
 * come back to it) and the two ARIA attributes that say what it opens and
 * whether it is open.
 */
export function Menu({ trigger, children, className }: MenuProps) {
  const [open, setOpen] = useState(false);
  const slotRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        close();
      }
    };
    // Pointerdown rather than click: the menu should be gone by the time the
    // press it was dismissed by lands on whatever is underneath.
    const onPointerDown = (event: PointerEvent) => {
      if (!slotRef.current?.contains(event.target as Node)) {
        close();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open, close]);

  return (
    <Slot ref={slotRef} className={className}>
      {trigger({
        ref: triggerRef,
        'aria-haspopup': 'menu',
        'aria-expanded': open,
        onClick: () => (open ? close() : setOpen(true)),
      })}
      {open ? (
        <CloseContext.Provider value={close}>
          <Panel>{children}</Panel>
        </CloseContext.Provider>
      ) : null}
    </Slot>
  );
}
