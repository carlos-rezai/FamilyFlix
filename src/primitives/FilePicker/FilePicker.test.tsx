import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from 'styled-components';

// Through the category barrel — no per-unit barrel.
import { FilePicker, type FilePickerProps } from '@/primitives';
import { theme } from '@/styles/theme';

/** A film off the maintainer's own disk, as the browser hands it over. */
const someFile = (name = 'lantern.mp4', type = 'video/mp4') =>
  new File(['video bytes'], name, { type });

function renderPicker(props: Partial<FilePickerProps> = {}) {
  const onPick = vi.fn<(file: File) => void>();

  render(
    <ThemeProvider theme={theme}>
      <FilePicker
        label={props.label ?? 'Choose video file'}
        accept={props.accept ?? 'video/*,.mkv,.avi'}
        onPick={props.onPick ?? onPick}
      />
    </ThemeProvider>
  );

  return { onPick };
}

/** The hidden `<input type="file">`, found the way a screen reader finds it. */
const picker = () =>
  screen.getByLabelText(/choose video file/i) as HTMLInputElement;

/**
 * The **File picker** — the dashed "＋ …" box every **File slot** starts as
 * and the ＋ under the subtitle rows: the one atom in the app that opens a
 * file dialog, because it is the `<label>` of a hidden `<input type="file">`.
 *
 * It owns the input and nothing else. What the file is for is the caller's
 * business; what it reports is the `File` itself, never a name or a path,
 * because a browser hands over a name and bytes and nothing more.
 */
describe('FilePicker', () => {
  it('is the file input itself', () => {
    renderPicker();

    // The dashed box *is* the `<label>` of a visually-hidden input, rather
    // than a button that reaches for one: a click has to open the file dialog,
    // and only a real input can.
    expect(picker().type).toBe('file');
  });

  it('reads the label it was given', () => {
    renderPicker({ label: 'Add subtitle file' });

    expect(screen.getByLabelText(/add subtitle file/i)).toBeDefined();
  });

  it('offers the file types it was told to offer', () => {
    renderPicker();

    // A convenience on the dialog and never a guarantee — the server re-checks
    // by extension — but the difference between a folder the maintainer can
    // pick from and one greyed out entirely.
    expect(picker().getAttribute('accept')).toBe('video/*,.mkv,.avi');
  });

  it('reports the file that was picked', async () => {
    const file = someFile();
    const { onPick } = renderPicker();

    // `applyAccept: false`: jsdom would otherwise drop an `.mkv` whose MIME
    // type Chromium leaves empty, which is the very case the accept list
    // names by extension.
    await userEvent.upload(picker(), file, { applyAccept: false });

    // The `File` itself, not its name: a browser gives a name and bytes and
    // never a path, so the bytes are the only thing there is to hand on.
    expect(onPick).toHaveBeenCalledWith(file);
  });

  it('says nothing when a dialog is opened and dismissed', () => {
    const { onPick } = renderPicker();

    fireEvent.change(picker(), { target: { files: [] } });

    // A cancelled dialog fires a change with nothing in it, and a caller that
    // acted on one would empty a slot or append a track with no file.
    expect(onPick).not.toHaveBeenCalled();
  });

  it('lets the same file be picked twice in a row', async () => {
    const file = someFile('lantern.en.srt', '');
    const { onPick } = renderPicker();

    await userEvent.upload(picker(), file, { applyAccept: false });
    await userEvent.upload(picker(), file, { applyAccept: false });

    // An input still holding the last file reports nothing when the same one
    // is chosen again — which is exactly what a maintainer does in a list
    // after removing the wrong row. The value is cleared after every pick so
    // the second choice is heard.
    expect(picker().value).toBe('');
    expect(onPick).toHaveBeenCalledTimes(2);
  });
});
