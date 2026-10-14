import { useNavigate } from 'react-router-dom';

import { Button, FolderIcon, SheetIcon, TextField } from '@/primitives';
import type { ImportMode } from '@/types';
import {
  Actions,
  EmptyFolders,
  EmptyLine,
  ErrorLine,
  Field,
  FieldLabel,
  Fields,
  FolderLine,
  FolderList,
  FolderPath,
  ListedFolder,
  GroupHead,
  GroupHeading,
  ManageButton,
} from './ImportSetup.styles';
import { FolderShapes } from '../FolderShapes/FolderShapes';
import { folderLine } from '../folderLine/folderLine';
import { EnrichCheckCard } from '../EnrichCheckCard/EnrichCheckCard';
import { ImportModeChoice } from '../ImportModeChoice/ImportModeChoice';
import { useLibraryFolders } from '../useLibraryFolders/useLibraryFolders';

/**
 * The box the spreadsheet field is drawn as: the prototype's mono face in a
 * 50px box with the soft corner rather than the search bar's pill.
 */
const PATH_FIELD = { mono: true, height: 50, rounded: false } as const;

/** Where _Manage folders_ and _Add library folders_ go: the list's own page. */
const FOLDERS_PAGE = '/settings/folders';

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
 * typed into one mono field, led by the sheet glyph; then the group **Library
 * folders**, because the run reads every listed folder — each row its path in
 * mono and its title count, or _Can’t be reached right now_ in `danger`, with
 * _Manage folders_ at the label's right; with none listed, _No library folders
 * yet._ and _Add library folders_. Both push `/settings/folders`. No row has a
 * ✕ — setup is not where the list is edited, so not `FolderRow` — and nothing
 * of the group is drawn until the list lands. Under it, _What the scanner
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
  const navigate = useNavigate();
  const { folders } = useLibraryFolders();
  const listed = folders !== null && folders.length > 0;
  const ready = sheet.trim() !== '' && listed;
  const manage = () => navigate(FOLDERS_PAGE);

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

      {folders === null ? null : (
        <div>
          <GroupHead>
            <GroupHeading>Library folders</GroupHeading>
            {listed ? (
              <ManageButton
                label="Manage folders"
                variant="ghost"
                size="sm"
                onClick={manage}
              />
            ) : null}
          </GroupHead>
          {listed ? (
            <FolderList>
              {folders.map((folder) => (
                <ListedFolder key={folder.id}>
                  <FolderIcon size={20} />
                  <FolderPath>{folder.path}</FolderPath>
                  <FolderLine $unreachable={!folder.reachable}>
                    {folderLine(folder)}
                  </FolderLine>
                </ListedFolder>
              ))}
            </FolderList>
          ) : (
            <EmptyFolders>
              <EmptyLine>No library folders yet.</EmptyLine>
              <Button
                label="Add library folders"
                variant="secondary"
                onClick={manage}
              />
            </EmptyFolders>
          )}
          {foldersError === null ? null : <ErrorLine>{foldersError}</ErrorLine>}
        </div>
      )}

      <FolderShapes />

      <ImportModeChoice mode={mode} onChange={onMode} />

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
