import { Root } from './RemoveButton.styles';

export interface RemoveButtonProps {
  /**
   * What pressing this takes away — a slot's name, a file's name. Both the
   * accessible name and the tooltip are built from it: a column of these reads
   * as a column of identical ✕s to anything that cannot see the row, and this
   * is the only thing that tells them apart.
   */
  removes: string;
  onClick: () => void;
}

/**
 * The ✕ that empties a **File slot** or takes a **Subtitle row** off the
 * movie — the one destructive control on the **Movie form**, which is why it
 * turns the danger colour on hover.
 *
 * A literal glyph rather than an icon atom, on `MenuItem`'s precedent and
 * design log Q10's ruling; what makes this an atom is the button *around* the
 * glyph — `type="button"`, a name and a title built from one string, and the
 * hover — which two molecules were each writing for themselves.
 */
export function RemoveButton({ removes, onClick }: RemoveButtonProps) {
  const name = `Remove ${removes}`;

  return (
    <Root type="button" aria-label={name} title={name} onClick={onClick}>
      ✕
    </Root>
  );
}
