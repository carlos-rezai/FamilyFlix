import { FileIcon, RemoveButton } from '@/primitives';

import { MenuItem } from '../Menu/Menu';
import {
  Chevron,
  Filename,
  IconSlot,
  Language,
  LanguageMenu,
  Row,
} from './SubtitleRow.styles';

export interface SubtitleRowProps {
  /** The name of the file this row is for — the only thing that tells it from
   *  the row under it. */
  filename: string;
  /** The language the track is currently in, as the control shows it. */
  language: string;
  /** The **Language pool** the list offers, in the order it should appear. */
  languages: string[];
  /** Reports the language that was chosen — the name itself, never an index. */
  onLanguageChange: (language: string) => void;
  /** Reports that the ✕ was pressed. What that takes off is the caller's business. */
  onRemove: () => void;
}

/**
 * One **Subtitle row**, from `mol.SubtitleRow.dc.html`: the file's name, the
 * language it is in, and the ✕ that takes it off the movie.
 *
 * **Its dropdown is a `Menu`** rather than the prototype's own local `open`
 * state, for exactly the reason `FilterDropdown` gave: `Menu` already owns
 * Escape, a press outside, select-to-close and focus return. Taking it also
 * means only one language list can be open at a time, for free — opening the
 * second row's is a press outside the first's, which is already what shuts it,
 * so there is no coordinating state here and none in the card above.
 *
 * Composition only. The seven languages are handed in rather than known: they
 * are a display vocabulary the **Movie form** owns, and a row that knew them
 * would be a molecule with a domain in it. It never learns that a **Movie** has
 * subtitles at all.
 *
 * Both controls are named after the file the row is for. A column of these
 * reads as a column of identical "English ▾" buttons and identical ✕s to
 * anything that cannot see the row, and the filename is the only thing that
 * makes pressing the right one possible.
 */
export function SubtitleRow({
  filename,
  language,
  languages,
  onLanguageChange,
  onRemove,
}: SubtitleRowProps) {
  return (
    <Row>
      {/* Decorative: the icon atom hides itself from the accessibility tree
          unless it is given a title, so the row reads as its filename. */}
      <IconSlot>
        <FileIcon size={16} />
      </IconSlot>
      <Filename>{filename}</Filename>
      <LanguageMenu
        trigger={(props) => (
          <Language
            {...props}
            type="button"
            aria-label={`Language for ${filename}: ${language}`}
          >
            {language}
            <Chevron aria-hidden="true">▾</Chevron>
          </Language>
        )}
      >
        {languages.map((option) => (
          <MenuItem
            key={option}
            selected={option === language}
            onSelect={() => onLanguageChange(option)}
          >
            {option}
          </MenuItem>
        ))}
      </LanguageMenu>
      <RemoveButton removes={filename} onClick={onRemove} />
    </Row>
  );
}
