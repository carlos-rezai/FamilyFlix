import {
  Children,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type Ref,
} from 'react';

import { Slot, Panel, Item, Glyph, Trailing } from './Menu.styles';

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

/**
 * The roving tabindex, seen from one row: where the row sits, which row the
 * menu is currently standing on, and how a row claims that spot.
 *
 * `activeIndex` is null for the render in which the panel first appears —
 * nobody has claimed the spot yet, and a row that is `selected` claims it from
 * its own effect. It settles one render later, before anything is painted, so
 * what a reader sees is a menu that opened with focus already on a row.
 */
interface Roving {
  index: number;
  activeIndex: number | null;
  setActive: (index: number) => void;
}

const RovingContext = createContext<Roving>({
  index: 0,
  activeIndex: null,
  setActive: () => undefined,
});

/** Where a key sends the tab stop, from the row it is on and the last index. */
type Step = (from: number, last: number) => number;

/**
 * The whole of the pattern's keyboard map. The arrows wrap at both ends rather
 * than stopping dead — a menu is a ring, and the row past the last is the
 * first.
 */
const STEPS: Partial<Record<string, Step>> = {
  ArrowDown: (from, last) => (from === last ? 0 : from + 1),
  ArrowUp: (from, last) => (from === 0 ? last : from - 1),
  Home: () => 0,
  End: (_from, last) => last,
};

export interface MenuItemProps {
  /** The item's visible text, and its accessible name. */
  children: ReactNode;
  /** Decorative leading character, kept out of the accessible name. */
  glyph?: ReactNode;
  /**
   * Marks the row a filter list currently stands on: accent, 600, and
   * `aria-current`. A statement about the row, not a mode — a marked row still
   * reports and still shuts the menu like any other. It is also where focus
   * lands when the menu opens, so a filter list opens standing on the choice it
   * is already showing.
   */
  selected?: boolean;
  /**
   * Chrome at the row's right edge — the filter list's count. Decorative like
   * the glyph, so it stays out of the accessible name.
   */
  trailing?: ReactNode;
  /** What the item does. The menu is already closing by the time this runs. */
  onSelect: () => void;
}

/**
 * One row of a `Menu`. Closes the menu, then does its own work.
 *
 * `role="menuitem"` with `aria-current`, not `role="menuitemradio"`, for every
 * row of every menu built on this one. The four menus behind this component are
 * not all single-select — the ⋯ overflow is a list of actions, while Genre,
 * rating and Sort are each one choice out of a list — and `menuitemradio` would
 * commit all four to a checked/unchecked group, `aria-checked` on every row
 * included, in order to describe three of them. `aria-current` says the one
 * thing that is true of a marked row here: it is the row the list is standing
 * on. Either role was defensible because the halves now agree — the arrow keys,
 * the wrap and the roving tabindex that the trigger's `aria-haspopup="menu"`
 * has always promised are implemented below.
 */
export function MenuItem({
  children,
  glyph,
  selected = false,
  trailing,
  onSelect,
}: MenuItemProps) {
  const close = useContext(CloseContext);
  const { index, activeIndex, setActive } = useContext(RovingContext);
  const ref = useRef<HTMLButtonElement>(null);
  const active = index === activeIndex;

  // The marked row claims the tab stop as the panel mounts, which is how the
  // menu knows to open on it rather than on the first row.
  useEffect(() => {
    if (selected) {
      setActive(index);
    }
  }, [selected, index, setActive]);

  // Focus follows the tab stop: an arrow key moves the stop, and the row it
  // lands on is the row that takes focus.
  useEffect(() => {
    if (active) {
      ref.current?.focus();
    }
  }, [active]);

  return (
    <Item
      ref={ref}
      type="button"
      role="menuitem"
      // Exactly one row is in the tab order: one Tab reaches the menu and one
      // Tab leaves it, and the arrow keys move about inside.
      tabIndex={active ? 0 : -1}
      $selected={selected}
      aria-current={selected ? 'true' : undefined}
      onClick={() => {
        // Close first: closing returns focus to the trigger, and a navigation
        // that ran first would be handing focus back on a page that has gone.
        close();
        onSelect();
      }}
    >
      {glyph === undefined ? null : <Glyph aria-hidden="true">{glyph}</Glyph>}
      {children}
      {trailing === undefined ? null : (
        <Trailing aria-hidden="true">{trailing}</Trailing>
      )}
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
 * The other half is the WAI-ARIA menu pattern the trigger announces with
 * `aria-haspopup="menu"`: a `role="menu"` panel over `role="menuitem"` rows,
 * focus placed on a row as the panel opens, the arrow keys walking and wrapping
 * between rows, Home and End jumping to the ends, and a roving tabindex so a
 * keyboard user Tabs past the menu rather than through every option in it.
 *
 * The trigger is the caller's, because the menus that need this behaviour look
 * nothing like each other. What the caller gets handed is a ref (so focus can
 * come back to it) and the two ARIA attributes that say what it opens and
 * whether it is open.
 */
export function Menu({ trigger, children, className }: MenuProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const slotRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    // The next opening works out where to stand on its own, from whichever row
    // is marked by then.
    setActiveIndex(null);
    triggerRef.current?.focus();
  }, []);

  const setActive = useCallback((index: number) => setActiveIndex(index), []);

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

  // Settles where the panel opened: on the marked row if one claimed the spot
  // from its own effect — a child's effect runs before this one — and on the
  // first row otherwise.
  useEffect(() => {
    if (open) {
      setActiveIndex((current) => current ?? 0);
    }
  }, [open]);

  const onPanelKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const step = STEPS[event.key];

    if (step === undefined) {
      return;
    }

    // The panel owns these keys while it is open: an arrow would otherwise
    // scroll the capped panel, or the page behind it.
    event.preventDefault();
    const last = Children.count(children) - 1;
    setActiveIndex((current) => step(current ?? 0, last));
  };

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
          <Panel role="menu" onKeyDown={onPanelKeyDown}>
            {/* Each row is told where it sits, which is all it needs in order
                to know whether it is the one holding the tab stop. */}
            {Children.map(children, (child, index) => (
              <RovingContext.Provider value={{ index, activeIndex, setActive }}>
                {child}
              </RovingContext.Provider>
            ))}
          </Panel>
        </CloseContext.Provider>
      ) : null}
    </Slot>
  );
}
