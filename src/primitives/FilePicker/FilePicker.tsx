import { Box, Input } from './FilePicker.styles';

export interface FilePickerProps {
  /** What the dashed box reads: "Choose video file", "Add subtitle file". */
  label: string;
  /**
   * What the file dialog offers, as the `accept` attribute spells it. A
   * convenience and never a guarantee — the server re-checks — but the
   * difference between a folder the maintainer can pick from and one greyed out.
   */
  accept: string;
  /** Reports the file that was chosen — the `File` itself, never its name. */
  onPick: (file: File) => void;
}

/**
 * The **File picker**: a dashed "＋ …" box that opens a file dialog and reports
 * what was chosen. The one control in the app that can, because it is the
 * `<label>` of a hidden `<input type="file">` — see the styles for why.
 *
 * It is an atom with no state of its own. `FileField` composes it for an empty
 * **File slot**, and the Files card composes it for the ＋ under the subtitle
 * rows; neither tells it what a **Movie** is, and it never learns what the
 * file it reports will be used for.
 *
 * The input's value is cleared after every pick, whether or not the caller is
 * still showing this control afterwards. An input still holding the last file
 * reports nothing when the same one is chosen again — harmless in a slot that
 * unmounts on pick, and exactly what a maintainer does in a list after
 * removing the wrong row.
 */
export function FilePicker({ label, accept, onPick }: FilePickerProps) {
  return (
    <Box>
      ＋ {label}
      <Input
        type="file"
        accept={accept}
        onChange={(event) => {
          // A cancelled dialog fires a change with nothing in it, and a caller
          // that acted on one would empty a slot or append a track with no
          // file.
          const file: File | undefined = event.target.files?.[0];
          if (file) {
            onPick(file);
          }
          event.target.value = '';
        }}
      />
    </Box>
  );
}
