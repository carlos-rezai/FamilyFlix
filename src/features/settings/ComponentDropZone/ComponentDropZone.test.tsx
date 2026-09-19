import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from 'styled-components';

import { ComponentDropZone } from './ComponentDropZone';
import type { UploadState } from '../useCapabilities/useCapabilities';
import { theme } from '@/styles/theme';

/**
 * 16 — Playback component upload, Phase 3: "the zone" (issue #154).
 *
 * The **Component drop zone**, `feat.CodecManager.dc.html` → the dashed _Add
 * a codec pack_ box under the rows: a `<label>` over a visually hidden
 * `<input type="file" multiple>`, taking a drop or a pick of the two
 * **Component binaries** and reporting them as they came.
 *
 * It is the `FilePicker`'s bargain at a different size: a click has to open a
 * file dialog, and only a real input can, so the control the maintainer
 * presses *is* the input's label. The input is hidden by **clipping rather
 * than `display: none`**, which would take it out of the accessibility tree
 * and out of the tab order — and the tab order is the one way this control is
 * operated without a mouse.
 *
 * It sorts nothing and labels nothing: both files go up as they are and the
 * route tells them apart by filename. A zone that decided which half a file
 * was would be a client the server trusted.
 *
 * **Three faces**, and the three the **Upload state** has:
 *
 * - **idle** — the prototype as drawn.
 * - **busy** — _Adding the playback component…_ over _Copying it in and
 *   checking it runs_, the input disabled, and nothing reported by a second
 *   drop or pick: two uploads cannot race into the same slot.
 * - **refused** — the title as drawn and the reason in the danger ink on the
 *   second line, the Setup step's danger line in the zone's own 12.5px slot.
 *   It stays until the next attempt replaces it; silence on a refusal was
 *   rejected, because a `.dll` dropped by a parent following the old copy must
 *   not do nothing.
 *
 * **Replaced is not a face.** The write echoes the **Codec report** and the
 * screen redraws from it — no success flash, no snackbar.
 *
 * 16 — Playback component upload, Phase 4: "the ✕ takes it back" (issue
 * #155). The busy face gains the second thing it can be busy doing. The
 * **Upload state**'s `action` is what tells them apart, and the zone is where
 * both are said — the ✕ is pressed on the **Component row**, but the row has
 * nowhere to put a sentence, and the zone already owns the one that says what
 * is happening. The prototype's own copy: _Removing the playback component…_
 * over _The formats it added go with it_ — which is the warning, said as a
 * fact.
 */

/** One half of a **Playback component**, as a browser hands it over. */
const binary = (name: string) =>
  new File(['MZ binary bytes'], name, { type: 'application/octet-stream' });

const FFMPEG = binary('ffmpeg.exe');
const FFPROBE = binary('ffprobe.exe');

const IDLE: UploadState = { kind: 'idle' };
const INSTALLING: UploadState = { kind: 'busy', action: 'install' };
const REMOVING: UploadState = { kind: 'busy', action: 'remove' };
const refused = (reason: string): UploadState => ({ kind: 'refused', reason });

/** #c97a6a, the `danger` token, as jsdom reports it. */
const DANGER_INK = 'rgb(201, 122, 106)';
/** The accent wash the prototype's hover paints the zone with. */
const ACCENT_SOFT = 'rgba(217, 122, 78, 0.14)';

function renderZone(upload: UploadState = IDLE) {
  const onFiles = vi.fn<(files: File[]) => void>();

  const { container } = render(
    <ThemeProvider theme={theme}>
      <ComponentDropZone upload={upload} onFiles={onFiles} />
    </ThemeProvider>
  );

  const label = container.querySelector('label');
  const input = container.querySelector('input[type="file"]');
  if (label === null || input === null) {
    throw new Error('ComponentDropZone drew no label over a file input');
  }

  return { onFiles, zone: label, input: input as HTMLInputElement };
}

/** A drop of the files given, as the browser reports one. */
function drop(zone: Element, files: File[]) {
  return fireEvent.drop(zone, {
    dataTransfer: { files, types: files.length > 0 ? ['Files'] : [] },
  });
}

describe('ComponentDropZone — the idle face', () => {
  it('reads the prototype’s title and line', () => {
    const { zone } = renderZone();

    // The words stay the family's: "pack" is what they drop, and only the
    // code, the wire and the glossary say **Playback component**.
    expect(zone.textContent).toContain('Add a codec pack');
    expect(zone.textContent).toContain(
      'Drop a playback component (ffmpeg) here, or browse'
    );
  });

  it('sets the binary’s name apart, the way the prototype does', () => {
    renderZone();

    expect(screen.getByText('ffmpeg')).toBeDefined();
  });

  it('is the file input itself, and takes more than one file', () => {
    const { input } = renderZone();

    // A **Playback component** arrives as two **Component binaries** in one
    // gesture, so one dialog has to be able to return both.
    expect(input.type).toBe('file');
    expect(input.multiple).toBe(true);
    expect(input.disabled).toBe(false);
  });

  it('keeps the input in the accessibility tree and in the tab order', () => {
    const { input } = renderZone();
    const hidden = getComputedStyle(input);

    // Clipped, never `display: none`: the label naming it and the keyboard
    // reaching it both go with it if it leaves the tree.
    expect(hidden.display).not.toBe('none');
    expect(hidden.visibility).not.toBe('hidden');
    expect(hidden.position).toBe('absolute');
    expect(hidden.width).toBe('1px');

    input.focus();
    expect(document.activeElement).toBe(input);
  });

  it('opens the dialog when the zone itself is pressed', async () => {
    const { zone, input } = renderZone();
    const opened = vi.fn();
    input.addEventListener('click', opened);

    await userEvent.click(zone);

    // The label forwards the press to the input it names — which is what
    // makes Enter and Space on the focused input open the dialog too.
    expect(opened).toHaveBeenCalled();
  });

  it('reports both binaries when they are picked', async () => {
    const { input, onFiles } = renderZone();

    await userEvent.upload(input, [FFMPEG, FFPROBE], { applyAccept: false });

    expect(onFiles).toHaveBeenCalledTimes(1);
    expect(onFiles.mock.calls[0][0]).toEqual([FFMPEG, FFPROBE]);
  });

  it('reports nothing when the dialog is opened and dismissed', () => {
    const { input, onFiles } = renderZone();

    fireEvent.change(input, { target: { files: [] } });

    expect(onFiles).not.toHaveBeenCalled();
  });
});

describe('ComponentDropZone — the drop', () => {
  it('reports both binaries dropped in one gesture', () => {
    const { zone, onFiles } = renderZone();

    drop(zone, [FFMPEG, FFPROBE]);

    expect(onFiles).toHaveBeenCalledTimes(1);
    expect(onFiles.mock.calls[0][0]).toEqual([FFMPEG, FFPROBE]);
  });

  it('reports nothing at all for an empty drop', () => {
    const { zone, onFiles } = renderZone();

    drop(zone, []);

    expect(onFiles).not.toHaveBeenCalled();
  });

  it('keeps the browser from opening the files instead', () => {
    const { zone } = renderZone();

    // Without both defaults prevented the drop navigates the window to the
    // file, and the Settings page is gone.
    const over = fireEvent.dragOver(zone, {
      dataTransfer: { types: ['Files'] },
    });
    const dropped = drop(zone, [FFMPEG, FFPROBE]);

    expect(over).toBe(false);
    expect(dropped).toBe(false);
  });

  it('draws the prototype’s hover while a drag is over it', () => {
    const { zone } = renderZone();

    expect(getComputedStyle(zone).backgroundColor).not.toBe(ACCENT_SOFT);

    fireEvent.dragOver(zone, { dataTransfer: { types: ['Files'] } });

    expect(getComputedStyle(zone).backgroundColor).toBe(ACCENT_SOFT);
  });

  it('takes the hover off again when the drag leaves', () => {
    const { zone } = renderZone();

    fireEvent.dragOver(zone, { dataTransfer: { types: ['Files'] } });
    fireEvent.dragLeave(zone, { dataTransfer: { types: ['Files'] } });

    expect(getComputedStyle(zone).backgroundColor).not.toBe(ACCENT_SOFT);
  });
});

describe('ComponentDropZone — the busy face', () => {
  it('reads what is happening and how long it will take', () => {
    const { zone } = renderZone(INSTALLING);

    expect(zone.textContent).toContain('Adding the playback component…');
    expect(zone.textContent).toContain('Copying it in and checking it runs');
    expect(zone.textContent).not.toContain('Add a codec pack');
  });

  it('disables the input, so a second pick cannot be made', () => {
    const { input } = renderZone(INSTALLING);

    expect(input.disabled).toBe(true);
  });

  it('reports nothing for a second drop while the copy runs', () => {
    const { zone, onFiles } = renderZone(INSTALLING);

    drop(zone, [FFMPEG, FFPROBE]);

    // Two uploads cannot race into the same slot, and a maintainer who drops
    // again because nothing looked like it happened is told nothing new.
    expect(onFiles).not.toHaveBeenCalled();
  });
});

describe('ComponentDropZone — the refused face', () => {
  it('keeps the title and puts the reason on the second line', () => {
    const { zone } = renderZone(refused('Both ffmpeg and ffprobe are needed.'));

    expect(zone.textContent).toContain('Add a codec pack');
    expect(zone.textContent).toContain('Both ffmpeg and ffprobe are needed.');
    expect(zone.textContent).not.toContain('Drop a playback component');
  });

  it('draws that line in the danger ink', () => {
    renderZone(refused('That isn’t a working ffmpeg build.'));

    const line = screen.getByText('That isn’t a working ffmpeg build.');

    expect(getComputedStyle(line).color).toBe(DANGER_INK);
  });

  it('still takes a drop, so the next attempt replaces the reason', () => {
    const { zone, onFiles } = renderZone(refused('Nothing was dropped.'));

    drop(zone, [FFMPEG, FFPROBE]);

    expect(onFiles).toHaveBeenCalledTimes(1);
  });
});

describe('ComponentDropZone — the removing face', () => {
  it('reads the prototype’s removing copy rather than the install’s', () => {
    const { zone } = renderZone(REMOVING);

    expect(zone.textContent).toContain('Removing the playback component…');
    expect(zone.textContent).toContain('The formats it added go with it');
    expect(zone.textContent).not.toContain('Adding the playback component…');
    expect(zone.textContent).not.toContain('Add a codec pack');
  });

  it('is as closed as the installing face while it runs', () => {
    const { zone, input, onFiles } = renderZone(REMOVING);

    drop(zone, [FFMPEG, FFPROBE]);

    // One slot, one write at a time: a drop landing on a removal would be two
    // answers for one component.
    expect(zone.textContent).toContain('Removing the playback component…');
    expect(input.disabled).toBe(true);
    expect(onFiles).not.toHaveBeenCalled();
  });
});
