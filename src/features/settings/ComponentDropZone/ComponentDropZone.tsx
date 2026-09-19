import { useState, type ChangeEvent, type DragEvent } from 'react';

import { UploadIcon } from '@/primitives';

import type { UploadState } from '../useCapabilities/useCapabilities';
import { zoneFace } from '../zoneFace/zoneFace';
import {
  Glyph,
  Input,
  Line,
  Mono,
  Title,
  Zone,
} from './ComponentDropZone.styles';

export interface ComponentDropZoneProps {
  /** What the zone is doing, and so which of its three faces it draws. */
  upload: UploadState;
  /** The files as they came — sorted by nothing, labelled as nothing. */
  onFiles: (files: File[]) => void;
}

/**
 * The **Component drop zone**, `feat.CodecManager.dc.html` → the dashed _Add
 * a codec pack_ box under the rows: a `<label>` over a visually hidden
 * `<input type="file" multiple>`, taking a drop or a pick of the two
 * **Component binaries** and reporting them as they came.
 *
 * It sorts nothing and labels nothing: both files go up as they are and the
 * route tells them apart by filename. A zone that decided which half a file
 * was would be a client the server trusted.
 *
 * **Three faces**, the three the **Upload state** has, and `zoneFace` is the
 * table of what each one says — including the refusal's, which keeps the title
 * and puts the route's own reason in the danger ink, where it stays until the
 * next attempt replaces it; silence on a refusal was rejected, because a `.dll`
 * dropped by a parent following the old copy must not do nothing. The
 * invitation's line is the one this composes itself, its `ffmpeg` being a
 * `<Mono>` span rather than a word.
 *
 * What the faces do *not* carry is `busy`, which stays here: it disables the
 * input, kills the hover, and makes a second drop report nothing, so two
 * writes cannot race into the same slot. That is behaviour, not copy.
 *
 * **Replaced is not a face**: the write echoes the **Codec report** and the
 * screen redraws from it — no success flash, no snackbar.
 *
 * The words stay the family's. The zone says _codec pack_ because that is what
 * they drop; the code, the wire and the glossary say **Playback component**.
 */
export function ComponentDropZone({ upload, onFiles }: ComponentDropZoneProps) {
  const [over, setOver] = useState(false);

  const busy = upload.kind === 'busy';
  // The ✕ is pressed on the **Component row**, but the row has nowhere to put
  // a sentence and the zone already owns the one that says what is happening.
  const face = zoneFace(upload);

  const report = (files: FileList | null) => {
    // A cancelled dialog and an empty drop are both nothing at all.
    const picked = Array.from(files ?? []);
    if (picked.length > 0) {
      onFiles(picked);
    }
  };

  const onDragOver = (event: DragEvent<HTMLLabelElement>) => {
    // Without the default prevented the drop navigates the window to the file,
    // and the Settings page is gone.
    event.preventDefault();
    if (!busy) {
      setOver(true);
    }
  };

  const onDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setOver(false);
    if (!busy) {
      report(event.dataTransfer.files);
    }
  };

  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    report(event.target.files);
    // Cleared after every pick, so the same pair chosen twice is heard twice.
    event.target.value = '';
  };

  return (
    <Zone
      $over={over}
      $busy={busy}
      onDragOver={onDragOver}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
    >
      <Glyph>
        <UploadIcon size={24} />
      </Glyph>
      <Title>{face.title}</Title>
      <Line $refused={face.refused}>
        {face.line ?? (
          <>
            Drop a playback component (<Mono>ffmpeg</Mono>) here, or browse
          </>
        )}
      </Line>
      <Input type="file" multiple disabled={busy} onChange={onChange} />
    </Zone>
  );
}
