import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from 'styled-components';

// Through the category barrel — no per-unit barrel.
import { FileField, type FileFieldProps } from '@/components';
import { theme } from '@/styles/theme';

/** A film off the maintainer's own disk, as the browser hands it over. */
const someFile = (name = 'lantern.mp4', type = 'video/mp4') =>
  new File(['video bytes'], name, { type });

/** The glyph a caller passes in, marked so the test can find it again. */
const ICON = <svg data-testid="slot-icon" />;

function renderField(props: Partial<FileFieldProps> = {}) {
  const onPick = vi.fn<(file: File) => void>();
  const onRemove = vi.fn<() => void>();

  render(
    <ThemeProvider theme={theme}>
      <FileField
        label={props.label ?? 'Video'}
        chooseLabel={props.chooseLabel ?? 'Choose video file'}
        filename={props.filename}
        accept={props.accept ?? 'video/*,.mkv,.avi'}
        icon={props.icon ?? ICON}
        onPick={props.onPick ?? onPick}
        onRemove={props.onRemove ?? onRemove}
      />
    </ThemeProvider>
  );

  return { onPick, onRemove };
}

/** The hidden `<input type="file">`, found the way a screen reader finds it. */
const picker = () =>
  screen.getByLabelText(/choose video file/i) as HTMLInputElement;

const remove = () =>
  screen.getByRole('button', { name: /remove video/i }) as HTMLButtonElement;

/**
 * The **File field** — one **File slot**, drawn as `mol.FileField.dc.html`
 * draws it: a dashed "＋ Choose …" button while the slot is empty, and a
 * monospace filename row with a ✕ once it is filled.
 *
 * It is the molecule that owns the `<input type="file">`, and that is the whole
 * of what it knows: opening a file dialog is UI, so this never learns what a
 * **Movie** is, which slot it is, or what the file it reports will be used for.
 * `icon` is a `ReactNode` rather than a name to switch on — COMPONENT-SPEC §3a
 * names this component specifically, and `TextField` set the precedent.
 *
 * **Filled and empty are two different controls, not one control in two
 * states.** The prototype's filled row is not a button, so the picker is gone
 * while a file is in the slot: choosing a different one means removing this one
 * first, which is also the only way the ✕ is reachable at all.
 */
describe('FileField — an empty slot', () => {
  it('names the slot it is standing in for', () => {
    renderField();

    expect(screen.getByText('Video')).toBeDefined();
  });

  it('offers a choose control that is the file input itself', () => {
    renderField();

    // The dashed button *is* the `<label>` of a visually-hidden input, rather
    // than a button that reaches for one: a click has to open the file dialog,
    // and only a real input can.
    expect(picker().type).toBe('file');
  });

  it('reads the caption it was given', () => {
    renderField({ chooseLabel: 'Choose poster image' });

    expect(screen.getByLabelText(/choose poster image/i)).toBeDefined();
  });

  it('offers the file types it was told to offer', () => {
    renderField();

    // A convenience on the dialog and never a guarantee — the server re-checks
    // by extension — but the difference between a folder the maintainer can
    // pick from and one greyed out entirely.
    expect(picker().getAttribute('accept')).toBe('video/*,.mkv,.avi');
  });

  it('shows no filename and no way to remove one', () => {
    renderField();

    expect(screen.queryByText('lantern.mp4')).toBeNull();
    expect(screen.queryByRole('button', { name: /remove/i })).toBeNull();
  });

  it('reports the file that was picked', async () => {
    const file = someFile();
    const { onPick } = renderField();

    await userEvent.upload(picker(), file, { applyAccept: false });

    // The `File` itself, not its name: a browser gives a name and bytes and
    // never a path, so the bytes are the only thing there is to hand on.
    expect(onPick).toHaveBeenCalledWith(file);
  });

  it('says nothing when a dialog is opened and dismissed', async () => {
    const { onPick } = renderField();

    fireEvent.change(picker(), { target: { files: [] } });

    // A cancelled dialog fires a change with nothing in it, and a slot that
    // emptied itself on one would lose the file already in it.
    expect(onPick).not.toHaveBeenCalled();
  });
});

describe('FileField — a filled slot', () => {
  it('shows the filename it was given', () => {
    renderField({ filename: 'lantern.mp4' });

    expect(screen.getByText('lantern.mp4')).toBeDefined();
  });

  it('draws the icon it was handed, rather than one it chose', () => {
    renderField({ filename: 'lantern.mp4' });

    // COMPONENT-SPEC §3a: pass the component, do not switch on a string. The
    // molecule stays a dumb slot and the caller says which kind of file this
    // is.
    expect(screen.getByTestId('slot-icon')).toBeDefined();
  });

  it('reports a removal when the ✕ is pressed', () => {
    const { onRemove } = renderField({ filename: 'lantern.mp4' });

    fireEvent.click(remove());

    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('names the removal after the slot it empties', () => {
    renderField({ filename: 'lantern.mp4', label: 'Poster' });

    // A column of these reads as a column of identical ✕ buttons to anything
    // that cannot see the row, which is why the accessible name carries the
    // slot's own label.
    expect(
      screen.getByRole('button', { name: /remove poster/i })
    ).toBeDefined();
  });

  it('offers no second picker beside the file already in it', () => {
    renderField({ filename: 'lantern.mp4' });

    // The prototype's filled row is a row, not a button. Changing a slot's
    // file is remove-then-choose, which is also what makes the ✕ worth having.
    expect(screen.queryByLabelText(/choose video file/i)).toBeNull();
  });

  it('still names the slot', () => {
    renderField({ filename: 'lantern.mp4' });

    expect(screen.getByText('Video')).toBeDefined();
  });
});

describe('FileField — which state it is in', () => {
  it('is empty when it is given no filename at all', () => {
    renderField({ filename: undefined });

    expect(picker()).toBeDefined();
  });

  it('is empty when it is given an empty filename', () => {
    renderField({ filename: '' });

    // The prototype's own rule — `hasFile:!!filename` — kept rather than
    // reinvented, so a cleared slot and an unfilled one draw the same thing.
    expect(picker()).toBeDefined();
    expect(screen.queryByRole('button', { name: /remove/i })).toBeNull();
  });
});
