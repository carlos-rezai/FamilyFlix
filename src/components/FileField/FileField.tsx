import type { ReactNode } from 'react';

import { FilePicker } from '@/primitives';

import {
  Control,
  Filename,
  Filled,
  IconSlot,
  Label,
  Remove,
  Row,
} from './FileField.styles';

export interface FileFieldProps {
  /** The slot's own name — "Video", "Poster" — printed beside its control. */
  label: string;
  /** What the empty state asks for: "Choose video file". */
  chooseLabel: string;
  /**
   * The name of the file in the slot, or nothing while it is empty. An empty
   * string is empty too — the prototype's own `hasFile:!!filename` rule, so a
   * cleared slot and an unfilled one draw the same thing.
   */
  filename?: string;
  /**
   * What the file dialog offers, as the `accept` attribute spells it. A
   * convenience and never a guarantee — the server re-checks — but the
   * difference between a folder the maintainer can pick from and one greyed out.
   */
  accept: string;
  /**
   * The glyph the filled row wears, handed in as a slot rather than picked by
   * name. Icons are atoms of their own (COMPONENT-SPEC §3a), so a caller that
   * needs a different one never widens this molecule.
   */
  icon: ReactNode;
  /** Reports the file that was chosen — the `File` itself, never its name. */
  onPick: (file: File) => void;
  /** Reports that the ✕ was pressed. What that empties is the caller's business. */
  onRemove: () => void;
}

/**
 * One **File slot**, from `mol.FileField.dc.html`: a dashed "＋ Choose …"
 * button while the slot is empty, and a monospace filename row with a ✕ once it
 * is filled.
 *
 * The dashed button is the **File picker** atom, which owns the
 * `<input type="file">`; this molecule puts a name beside it and draws the row
 * that replaces it. Opening a file dialog is UI, so neither learns what a
 * **Movie** is, which slot this is standing in for, or what the file it
 * reports will be used for.
 *
 * **Filled and empty are two different controls, not one control in two
 * states.** The prototype's filled row is a row rather than a button, so the
 * picker is gone while a file is in the slot: choosing a different one means
 * removing this one first, which is also the only thing that makes the ✕ worth
 * having.
 *
 * The removal is named after the slot it empties. A column of these reads as a
 * column of identical ✕ buttons to anything that cannot see the row, and the
 * label is the only thing that tells them apart.
 */
export function FileField({
  label,
  chooseLabel,
  filename,
  accept,
  icon,
  onPick,
  onRemove,
}: FileFieldProps) {
  return (
    <Row>
      <Label>{label}</Label>
      <Control>
        {filename ? (
          <Filled>
            {/* Decorative: the icon atom hides itself from the accessibility
                tree unless it is given a title, so the row reads as its
                filename. */}
            <IconSlot>{icon}</IconSlot>
            <Filename>{filename}</Filename>
            <Remove
              type="button"
              aria-label={`Remove ${label}`}
              title={`Remove ${label}`}
              onClick={onRemove}
            >
              ✕
            </Remove>
          </Filled>
        ) : (
          <FilePicker label={chooseLabel} accept={accept} onPick={onPick} />
        )}
      </Control>
    </Row>
  );
}
