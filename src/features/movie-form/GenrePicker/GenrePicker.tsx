import { Chip } from '@/primitives';
import type { Genre } from '@/types';
import { ChipRow } from './GenrePicker.styles';

export interface GenrePickerProps {
  /** The **Genre pool**, drawn in the order it is given in. */
  genres: Genre[];
  /** The names picked right now. */
  selected: string[];
  /** The genre whose chip was pressed — add or remove is the caller's call. */
  onToggle: (name: string) => void;
}

/**
 * The chip row of the **Movie form** — one `Chip` per **Genre pool** entry, and
 * nothing else.
 *
 * It renders what it is given and reports what was pressed: which genres exist
 * and which are chosen both stay one level up, in the pool hook and the form's
 * own values. That is what makes a press a single message — `onToggle` says
 * which chip, never whether that adds or removes — and it keeps the selection
 * in one place rather than in two that could disagree.
 *
 * `prim.Chip` is used verbatim. Its `md` face is already the prototype's pill —
 * `9px 16px`, accent-soft when selected — and given an `onClick` it is a real
 * `<button>` carrying `aria-pressed`, which is the half of "selected" a screen
 * reader can hear. Its docblock says it was built for this caller.
 *
 * An empty pool draws nothing at all, which is what a failed
 * `GET /api/genres/pool` leaves behind: no chips, and no error surface the
 * prototype never designed.
 */
export function GenrePicker({ genres, selected, onToggle }: GenrePickerProps) {
  return (
    <ChipRow>
      {genres.map((genre) => (
        <Chip
          key={genre.id}
          label={genre.name}
          selected={selected.includes(genre.name)}
          onClick={() => onToggle(genre.name)}
        />
      ))}
    </ChipRow>
  );
}
