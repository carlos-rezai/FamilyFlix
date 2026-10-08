import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { fetchTmdbKey } from '@/api/fetchTmdbKey/fetchTmdbKey';
import { useGoBack } from '@/hooks/useGoBack/useGoBack';
import {
  Button,
  ChevronLeftIcon,
  FolderIcon,
  IconButton,
  TextField,
} from '@/primitives';
import { ImportBusyError, startFolderScan } from '../api/api';
import { EnrichCheckCard } from '../EnrichCheckCard/EnrichCheckCard';
import { FolderRow } from '../FolderRow/FolderRow';
import { FolderShapes } from '../FolderShapes/FolderShapes';
import { useLibraryFolders } from '../useLibraryFolders/useLibraryFolders';
import {
  AddRow,
  Card,
  Divider,
  Empty,
  GroupHeading,
  HeaderRow,
  Heading,
  Lede,
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
 * **Blank until it lands**: nothing under the header is drawn while the list
 * is `null`. Back is the one **Back rule** with Settings as the **Landing**.
 */
export function LibraryFolders() {
  const { folders, add, remove, adding, refusal } = useLibraryFolders();
  const goBack = useGoBack('/settings');
  const [typed, setTyped] = useState('');
  const navigate = useNavigate();
  const [scanning, setScanning] = useState(false);
  const [enrich, setEnrich] = useState(false);
  const [keySet, setKeySet] = useState(false);

  useEffect(() => {
    let left = false;
    fetchTmdbKey().then(
      (key) => {
        if (!left) {
          setKeySet(key !== null);
        }
      },
      () => {
        // A read that failed is no key: the hint says to add one.
      }
    );
    return () => {
      left = true;
    };
  }, []);

  const scan = async () => {
    setScanning(true);
    try {
      await startFolderScan(enrich);
      navigate('/import');
    } catch (error) {
      if (error instanceof ImportBusyError) {
        navigate('/import');
        return;
      }
      setScanning(false);
    }
  };

  const submit = async () => {
    if (await add(typed.trim())) {
      setTyped('');
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
            <AddRow>
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
            </AddRow>
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
                void scan();
              }}
            />
          </ScanActions>
        </>
      )}
    </>
  );
}
