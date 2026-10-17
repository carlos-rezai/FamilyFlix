import { useState } from 'react';

import type { ImportMode } from '@/types';
import { useGoBack } from '@/hooks/useGoBack/useGoBack';
import { Button } from '@/primitives';
import { EnrichCheckCard, PageHeader } from '@/components';
import { FolderListEditor } from '../FolderListEditor/FolderListEditor';
import { FolderShapes } from '../FolderShapes/FolderShapes';
import { ImportModeChoice } from '../ImportModeChoice/ImportModeChoice';
import { useFolderScan } from '../useFolderScan/useFolderScan';
import { useKeyStored } from '@/hooks/useKeyStored/useKeyStored';
import { useLibraryFolders } from '../useLibraryFolders/useLibraryFolders';
import { GroupHeading, ScanActions, ScanStack } from './LibraryFolders.styles';

/** The `EnrichCheckCard`'s keyed hint on the group Scan — the scan's own. */
const ENRICH_HINT =
  'Runs straight after the scan, over everything it brings in. Needs the internet.';

/**
 * The **Library folders page**'s organism: the maintainer header — Back,
 * **Library folders** and the lede — over the group **Folders**, the
 * `FolderListEditor`: the Folder rows with their ✕, the add row, and
 * _Browse…_ in the desktop app. Then
 * the group **Scan**: _What the scanner accepts_, the **Import mode** (Link on
 * every mount), the `EnrichCheckCard` with the scan's own keyed hint, and
 * **Scan folders** — sending the box and the mode —
 * disabled with no folder listed, which posts the **Folder scan** and pushes
 * `/import` — on a `409` too, so the run already in flight is the one shown.
 *
 * **Blank until it lands**: nothing under the header is drawn while the list
 * is `null`. Back is the one **Back rule** with Settings as the **Landing**.
 */
export function LibraryFolders() {
  const library = useLibraryFolders();
  const { folders } = library;
  const goBack = useGoBack('/settings');
  const { scanning, scan } = useFolderScan();
  const [enrich, setEnrich] = useState(false);
  const [mode, setMode] = useState<ImportMode>('link');
  const keySet = useKeyStored();

  return (
    <>
      <PageHeader
        onBack={goBack}
        heading="Library folders"
        lede="The folders your movies and series are kept in. FamilyFlix looks in each one for new titles."
      />

      {folders === null ? null : (
        <>
          <GroupHeading>Folders</GroupHeading>
          <FolderListEditor {...library} folders={folders} />

          <GroupHeading>Scan</GroupHeading>
          <ScanStack>
            <FolderShapes />
            <ImportModeChoice mode={mode} onChange={setMode} />
            <EnrichCheckCard
              checked={enrich}
              keySet={keySet}
              keyedHint={ENRICH_HINT}
              onToggle={() => setEnrich((ticked) => !ticked)}
            />
            <ScanActions>
              <Button
                label="Scan folders"
                size="lg"
                disabled={scanning || folders.length === 0}
                onClick={() => {
                  void scan(enrich, mode);
                }}
              />
            </ScanActions>
          </ScanStack>
        </>
      )}
    </>
  );
}
