import { Button, SheetIcon, TextField } from '@/primitives';
import { useState } from 'react';

import { folderBridge } from '@/api/folderBridge/folderBridge';
import type { ImportMode } from '@/types';
import {
  Actions,
  ErrorLine,
  Field,
  FieldLabel,
  Fields,
  GroupHeading,
  PathRow,
} from './ImportSetup.styles';
import { FolderShapes } from '../FolderShapes/FolderShapes';
import { FolderListEditor } from '../FolderListEditor/FolderListEditor';
import { EnrichCheckCard } from '@/components';
import { ImportModeChoice } from '../ImportModeChoice/ImportModeChoice';
import { useLibraryFolders } from '../useLibraryFolders/useLibraryFolders';

/**
 * The box the spreadsheet field is drawn as: the prototype's mono face in a
 * 50px box with the soft corner rather than the search bar's pill.
 */
const PATH_FIELD = { mono: true, height: 50, rounded: false } as const;

/**
 * The `EnrichCheckCard`'s keyed hint wherever an import is started — Import
 * setup and the Library folders page's Scan alike.
 */
export const IMPORT_ENRICH_HINT =
  'Runs straight after the import, over everything it brings in. Needs the internet.';

export interface ImportSetupProps {
  /** The spreadsheet path as typed. */
  sheet: string;
  /** The reason the last start refused the sheet, or `null` for none. */
  sheetError: string | null;
  /**
   * The reason the last start refused on `folders` — none listed by the time
   * it was pressed — or `null` for none.
   */
  foldersError: string | null;
  onSheet: (value: string) => void;
  /** _Start import_. */
  onStart: () => void;
  /** The **Import mode** chosen. */
  mode: ImportMode;
  onMode: (mode: ImportMode) => void;
  /** Whether _Also fetch metadata and posters from TMDB_ is ticked. */
  enrich: boolean;
  /** Whether a TMDB key is stored — it chooses the card's hint. */
  keySet: boolean;
  onToggleEnrich: () => void;
}

/**
 * The **Setup step**, from `feat.ImportFlow.dc.html`: the spreadsheet's path
 * typed into one mono field, led by the sheet glyph — or, in the desktop app,
 * picked with _Browse…_ beside it, the system file dialog for one `.xlsx` or
 * `.csv`, a cancel leaving the field as it was; then the group **Library
 * folders**, because the run reads every listed folder — the
 * `FolderListEditor`, the Library folders page's own list, so folders are
 * added (typed, or several at once with _Browse…_ in the desktop app) and
 * removed here without leaving the import. Nothing of the group is drawn
 * until the list lands. Under it, _What the scanner
 * accepts_, the **Import mode** (`ImportModeChoice`) and the
 * `EnrichCheckCard`; then _Start import_, disabled until the sheet is filled
 * and a folder is listed.
 *
 * The sheet, the mode and the box are controlled: their values, the two
 * refusals and the handlers are handed in, because it is the organism that
 * holds the start's fields — the mode Link on every mount, the Library folders
 * page's precedent — and decides when a refusal clears. A refusal is the 13px danger line — the sheet's under its
 * field, the `folders` one under the group.
 */
export function ImportSetup({
  sheet,
  sheetError,
  foldersError,
  onSheet,
  onStart,
  mode,
  onMode,
  enrich,
  keySet,
  onToggleEnrich,
}: ImportSetupProps) {
  const [bridge] = useState(folderBridge);
  const library = useLibraryFolders();
  const { folders } = library;
  const ready = sheet.trim() !== '' && folders !== null && folders.length > 0;

  const browseSheet = async () => {
    if (bridge === null) return;
    const picked = await bridge.pickSheet();
    if (picked !== null) onSheet(picked);
  };

  return (
    <Fields>
      <Field>
        <FieldLabel>Spreadsheet</FieldLabel>
        <PathRow>
          <TextField
            {...PATH_FIELD}
            value={sheet}
            placeholder="C:\Movies\library.xlsx"
            icon={<SheetIcon size={20} />}
            aria-label="Spreadsheet"
            onChange={onSheet}
          />
          {bridge === null ? null : (
            <Button
              label="Browse…"
              variant="secondary"
              onClick={() => {
                void browseSheet();
              }}
            />
          )}
        </PathRow>
        {sheetError === null ? null : <ErrorLine>{sheetError}</ErrorLine>}
      </Field>

      {folders === null ? null : (
        <div>
          <GroupHeading>Library folders</GroupHeading>
          <FolderListEditor {...library} folders={folders} />
          {foldersError === null ? null : <ErrorLine>{foldersError}</ErrorLine>}
        </div>
      )}

      <FolderShapes />

      <ImportModeChoice mode={mode} onChange={onMode} />

      <EnrichCheckCard
        checked={enrich}
        keySet={keySet}
        keyedHint={IMPORT_ENRICH_HINT}
        onToggle={onToggleEnrich}
      />

      <Actions>
        <Button label="Start import" disabled={!ready} onClick={onStart} />
      </Actions>
    </Fields>
  );
}
