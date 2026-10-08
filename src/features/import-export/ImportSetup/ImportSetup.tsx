import { Button, FolderIcon, SheetIcon, TextField } from '@/primitives';
import {
  Actions,
  ErrorLine,
  Field,
  FieldLabel,
  Fields,
} from './ImportSetup.styles';
import { FolderShapes } from '../FolderShapes/FolderShapes';
import { EnrichCheckCard } from '../EnrichCheckCard/EnrichCheckCard';

/**
 * The box both path fields are drawn as: the prototype's mono face in a 50px
 * box with the soft corner rather than the search bar's pill.
 */
const PATH_FIELD = { mono: true, height: 50, rounded: false } as const;

export interface ImportSetupProps {
  /** The spreadsheet path as typed. */
  sheet: string;
  /** The **Library root** path as typed. */
  root: string;
  /** The reason the last start refused the sheet, or `null` for none. */
  sheetError: string | null;
  /** The reason the last start refused the root, or `null` for none. */
  rootError: string | null;
  onSheet: (value: string) => void;
  onRoot: (value: string) => void;
  onStart: () => void;
  /** Whether _Also fetch metadata and posters from TMDB_ is ticked. */
  enrich: boolean;
  /** Whether a TMDB key is stored — it chooses the card's hint. */
  keySet: boolean;
  onToggleEnrich: () => void;
}

/**
 * The **Setup step**, from `feat.ImportFlow.dc.html`: two paths typed into two
 * mono fields — the spreadsheet, led by the sheet glyph, and the **Library
 * root**, led by the folder glyph — and _Start import_, disabled until both
 * are non-empty. Between the root and the button, _What the scanner accepts_:
 * the three folder shapes, with the prototype's backslashes, and the
 * folder-first rule. Under that, the `EnrichCheckCard`. The box is only carried on the run —
 * _Finish_ reads it; the import itself asks TMDB nothing.
 *
 * Controlled: the values, the two refusals and the three handlers are handed
 * in, because it is the organism that holds the values and decides when a
 * refusal clears. A refusal is drawn under the field the `400` named, as the
 * 13px danger line.
 */
export function ImportSetup({
  sheet,
  root,
  sheetError,
  rootError,
  onSheet,
  onRoot,
  onStart,
  enrich,
  keySet,
  onToggleEnrich,
}: ImportSetupProps) {
  const ready = sheet.trim() !== '' && root.trim() !== '';

  return (
    <Fields>
      <Field>
        <FieldLabel>Spreadsheet</FieldLabel>
        <TextField
          {...PATH_FIELD}
          value={sheet}
          placeholder="C:\Movies\library.xlsx"
          icon={<SheetIcon size={20} />}
          aria-label="Spreadsheet"
          onChange={onSheet}
        />
        {sheetError === null ? null : <ErrorLine>{sheetError}</ErrorLine>}
      </Field>

      <Field>
        <FieldLabel>Movies root folder</FieldLabel>
        <TextField
          {...PATH_FIELD}
          value={root}
          placeholder="C:\Movies"
          icon={<FolderIcon size={20} />}
          aria-label="Movies root folder"
          onChange={onRoot}
        />
        {rootError === null ? null : <ErrorLine>{rootError}</ErrorLine>}
      </Field>

      <FolderShapes />

      <EnrichCheckCard
        checked={enrich}
        keySet={keySet}
        onToggle={onToggleEnrich}
      />

      <Actions>
        <Button label="Start import" disabled={!ready} onClick={onStart} />
      </Actions>
    </Fields>
  );
}
