import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

import {
  FolderListEditor,
  type FolderListEditorProps,
} from './FolderListEditor';
import type { LibraryFolderView } from '@/types';
import { theme } from '@/styles/theme';
import { fakeFolderBridge } from '@/test-support/fakeFolderBridge/fakeFolderBridge';

/**
 * The **Library folders** list, editable — the Library folders page's and
 * Import setup's. The list and its writes are handed in, so what is under test
 * is the surface and what each press asks for.
 */

const MOVIES: LibraryFolderView = {
  id: 'f-movies',
  path: 'E:\\Movies',
  titleCount: 12,
  reachable: true,
  leftOut: 0,
};

function renderEditor(props: Partial<FolderListEditorProps> = {}) {
  const add = vi.fn((_path: string) => Promise.resolve(true));
  const remove = vi.fn((_id: string) => Promise.resolve());
  render(
    <ThemeProvider theme={theme}>
      <FolderListEditor
        folders={[MOVIES]}
        add={add}
        remove={remove}
        bringBack={vi.fn((_id: string) => Promise.resolve())}
        adding={false}
        refusal={null}
        removeRefusal={null}
        {...props}
      />
    </ThemeProvider>
  );
  return { add, remove };
}

const pathField = () =>
  screen.getByRole('textbox', { name: 'Folder path' }) as HTMLInputElement;
const addButton = () =>
  screen.getByRole('button', { name: 'Add' }) as HTMLButtonElement;

describe('FolderListEditor', () => {
  it('draws each folder with its ✕, which removes it by id', () => {
    const { remove } = renderEditor();

    fireEvent.click(screen.getByRole('button', { name: 'Remove E:\\Movies' }));

    expect(remove).toHaveBeenCalledWith('f-movies');
  });

  it('draws No folders yet. with none listed', () => {
    renderEditor({ folders: [] });

    expect(screen.getByText('No folders yet.')).toBeDefined();
  });

  it('adds the typed path trimmed, and empties the field once added', async () => {
    const { add } = renderEditor();

    fireEvent.change(pathField(), { target: { value: '  G:\\Series ' } });
    fireEvent.click(addButton());

    expect(add).toHaveBeenCalledWith('G:\\Series');
    await waitFor(() => expect(pathField().value).toBe(''));
  });

  it('keeps the typed path when the add is refused, under its sentence', async () => {
    const add = vi.fn(() => Promise.resolve(false));
    renderEditor({ add, refusal: 'That folder can’t be read.' });

    fireEvent.change(pathField(), { target: { value: 'G:\\Gone' } });
    fireEvent.click(addButton());

    await waitFor(() => expect(add).toHaveBeenCalled());
    expect(pathField().value).toBe('G:\\Gone');
    expect(screen.getByText('That folder can’t be read.')).toBeDefined();
  });

  it('draws a refused remove under its row', () => {
    renderEditor({
      removeRefusal: {
        id: 'f-movies',
        sentence: 'Linked videos play from it.',
      },
    });

    expect(screen.getByText('Linked videos play from it.')).toBeDefined();
  });

  it('disables Add while nothing is typed or an add is out', () => {
    renderEditor();
    expect(addButton().disabled).toBe(true);

    fireEvent.change(pathField(), { target: { value: 'G:\\Series' } });
    expect(addButton().disabled).toBe(false);
  });

  it('draws no Browse… in a browser', () => {
    renderEditor();

    expect(screen.queryByRole('button', { name: 'Browse…' })).toBeNull();
  });
});

describe('FolderListEditor — Browse… in the desktop app', () => {
  const bridge = fakeFolderBridge();

  it('adds every folder picked, in the order picked', async () => {
    bridge.setPick(['G:\\Series', 'H:\\Films']);
    const { add } = renderEditor();

    fireEvent.click(screen.getByRole('button', { name: 'Browse…' }));

    await waitFor(() => expect(add).toHaveBeenCalledTimes(2));
    expect(add.mock.calls).toEqual([['G:\\Series'], ['H:\\Films']]);
  });

  it('adds nothing for a cancelled pick', async () => {
    const { add } = renderEditor();

    fireEvent.click(screen.getByRole('button', { name: 'Browse…' }));

    await waitFor(() => expect(bridge.picks()).toBe(1));
    expect(add).not.toHaveBeenCalled();
  });
});
