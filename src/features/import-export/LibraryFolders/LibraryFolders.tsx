import { useState } from 'react';

import { useGoBack } from '@/hooks/useGoBack/useGoBack';
import {
  Button,
  ChevronLeftIcon,
  FolderIcon,
  IconButton,
  TextField,
} from '@/primitives';
import { FolderRow } from '../FolderRow/FolderRow';
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
} from './LibraryFolders.styles';

/**
 * The **Library folders page**'s organism: the maintainer header — Back,
 * **Library folders** and the lede — over the group **Folders**: one **Folder
 * row** per listed folder (or _No folders yet._), a divider, and the add row,
 * a mono `TextField` with the folder glyph and _Add_. A refused add is one
 * 13px `danger` line under the field, and the typed path stays in it.
 *
 * **Blank until it lands**: nothing under the header is drawn while the list
 * is `null`. Back is the one **Back rule** with Settings as the **Landing**.
 */
export function LibraryFolders() {
  const { folders, add, remove, adding, refusal } = useLibraryFolders();
  const goBack = useGoBack('/settings');
  const [typed, setTyped] = useState('');

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
        </>
      )}
    </>
  );
}
