import { useState } from 'react';

import { useGoBack } from '@/hooks/useGoBack/useGoBack';
import {
  Button,
  ChevronLeftIcon,
  FolderIcon,
  IconButton,
  TextField,
} from '@/primitives';
import { folderBridge } from '../folderBridge/folderBridge';
import { EnrichCheckCard } from '../EnrichCheckCard/EnrichCheckCard';
import { FolderRow } from '../FolderRow/FolderRow';
import { FolderShapes } from '../FolderShapes/FolderShapes';
import { useFolderScan } from '../useFolderScan/useFolderScan';
import { useKeyStored } from '../useKeyStored/useKeyStored';
import { useLibraryFolders } from '../useLibraryFolders/useLibraryFolders';
import {
  Card,
  Divider,
  Empty,
  GroupHeading,
  HeaderRow,
  Heading,
  Lede,
  PathRow,
  Refusal,
  Rows,
  ScanActions,
} from './LibraryFolders.styles';

/**
 * The **Library folders page**'s organism: the maintainer header — Back,
 * **Library folders** and the lede — over the group **Folders**: one **Folder
 * row** per listed folder (or _No folders yet._), a divider, and the add row,
 * a mono `TextField` with the folder glyph and _Add_. A refused add is one
 * 13px `danger` line under the field, and the typed path stays in it. Then
 * the group **Scan**: _What the scanner accepts_, the `EnrichCheckCard` with
 * Import setup's stored-key hint, and **Scan folders** — sending the box —
 * disabled with no folder listed, which posts the **Folder scan** and pushes
 * `/import` — on a `409` too, so the run already in flight is the one shown.
 *
 * In the desktop app _Browse…_ sits beside _Add_ and opens the system folder
 * dialog: each picked folder is posted in order, as if it had been typed, and
 * each is checked and refused on its own. A browser has no bridge, so no
 * _Browse…_; a cancelled pick posts nothing.
 *
 * **Blank until it lands**: nothing under the header is drawn while the list
 * is `null`. Back is the one **Back rule** with Settings as the **Landing**.
 */
export function LibraryFolders() {
  const { folders, add, remove, adding, refusal } = useLibraryFolders();
  const goBack = useGoBack('/settings');
  const [typed, setTyped] = useState('');
  const [bridge] = useState(folderBridge);
  const { scanning, scan } = useFolderScan();
  const [enrich, setEnrich] = useState(false);
  const keySet = useKeyStored();

  const submit = async () => {
    if (await add(typed.trim())) {
      setTyped('');
    }
  };

  const browse = async () => {
    if (bridge === null) return;
    const picked = await bridge.pick();
    for (const path of picked) {
      await add(path);
    }
  };

  return (
    <>
      <HeaderRow>
        <IconButton
          label="Back"
          title="Back"
          size={42}
          variant="outline"
          onClick={goBack}
        >
          <ChevronLeftIcon size={18} />
        </IconButton>
        <Heading>Library folders</Heading>
      </HeaderRow>
      <Lede>
        The folders your movies and series are kept in. FamilyFlix looks in each
        one for new titles.
      </Lede>

      {folders === null ? null : (
        <>
          <GroupHeading>Folders</GroupHeading>
          <Card>
            {folders.length === 0 ? (
              <Empty>No folders yet.</Empty>
            ) : (
              <Rows>
                {folders.map((folder) => (
                  <FolderRow
                    key={folder.id}
                    folder={folder}
                    onRemove={() => {
                      void remove(folder.id);
                    }}
                  />
                ))}
              </Rows>
            )}
            <Divider />
            <PathRow>
              <TextField
                value={typed}
                placeholder="E:\Movies"
                icon={<FolderIcon size={18} />}
                rounded={false}
                mono
                onChange={setTyped}
                aria-label="Folder path"
              />
              <Button
                label="Add"
                variant="secondary"
                size="sm"
                disabled={adding || typed.trim() === ''}
                onClick={() => {
                  void submit();
                }}
              />
              {bridge === null ? null : (
                <Button
                  label="Browse…"
                  variant="secondary"
                  size="sm"
                  disabled={adding}
                  onClick={() => {
                    void browse();
                  }}
                />
              )}
            </PathRow>
            {refusal === null ? null : <Refusal>{refusal}</Refusal>}
          </Card>

          <GroupHeading>Scan</GroupHeading>
          <FolderShapes />
          <EnrichCheckCard
            checked={enrich}
            keySet={keySet}
            onToggle={() => setEnrich((ticked) => !ticked)}
          />
          <ScanActions>
            <Button
              label="Scan folders"
              size="lg"
              disabled={scanning || folders.length === 0}
              onClick={() => {
                void scan(enrich);
              }}
            />
          </ScanActions>
        </>
      )}
    </>
  );
}
