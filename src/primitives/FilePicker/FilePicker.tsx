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
 * The same picker over a dialog that takes many files at once — the series'
 * _＋ Add episode files_ — reporting every file chosen, in the order given.
 */
export interface MultiFilePickerProps {
  label: string;
  accept: string;
  multiple: true;
  onPickFiles: (files: File[]) => void;
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
export function FilePicker(props: FilePickerProps | MultiFilePickerProps) {
  const { label, accept } = props;
  return (
    <Box>
      ＋ {label}
      <Input
        type="file"
        accept={accept}
        multiple={'multiple' in props}
        onChange={(event) => {
          // A cancelled dialog fires a change with nothing in it, and a caller
          // that acted on one would empty a slot or append a track with no
          // file.
          const files = Array.from(event.target.files ?? []);
          if ('multiple' in props) {
            if (files.length > 0) {
              props.onPickFiles(files);
            }
          } else if (files[0]) {
            props.onPick(files[0]);
          }
          event.target.value = '';
        }}
      />
    </Box>
  );
}
