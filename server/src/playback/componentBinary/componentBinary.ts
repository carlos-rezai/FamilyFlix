/**
 * Which half of a **Playback component** a file is, by its name and nothing
 * else — `'ffmpeg'`, `'ffprobe'`, or `null` for anything that is neither.
 *
 * This feature's security boundary, the way `fileKinds` is media's. The client
 * sorts nothing and labels nothing: every file part of an upload arrives under
 * the one field name, and this is what tells the two apart. A part that is
 * neither half never becomes a file on disk.
 *
 * Two rules pull in opposite directions on purpose. A build downloaded from a
 * build site is called `ffmpeg-7.1.exe` as often as `ffmpeg`, so a version in
 * the name must not make a real component unrecognisable; but `myffmpeg.exe`
 * and `ffmpeg.dll` are halves of nothing, and a `.dll` in the drop is exactly
 * the mistake the parent makes. Hence: the name, lowercased, is the binary's
 * own word, optionally followed by a `-` and whatever the build called itself,
 * optionally under a `.exe` — and nothing else.
 *
 * The name says which half; the **platform** says what that half is called
 * once it is stored, which is why what the client called it is never kept.
 */

/** The two halves, which are the only two things that may be added. */
const BINARIES = ['ffmpeg', 'ffprobe'] as const;

/** One half of a **Playback component**, as the slot stages it. */
export type ComponentBinary = (typeof BINARIES)[number];

export function componentBinary(filename: string): ComponentBinary | null {
  // The `.exe` a Windows build carries is the one extension a component has;
  // every other suffix is part of what the build calls itself, or is what makes
  // the file something else entirely.
  const name = filename.toLowerCase().replace(/\.exe$/, '');

  return (
    BINARIES.find(
      (binary) => name === binary || name.startsWith(`${binary}-`)
    ) ?? null
  );
}
