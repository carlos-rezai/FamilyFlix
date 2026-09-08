/**
 * A client-supplied filename to something that can be joined to a **Movie
 * folder** without leaving it.
 *
 * The other half of the dangerous logic in this feature, and the half a hostile
 * client aims at: the name travelling in a multipart part is a string this
 * server did not write, and this function is the only thing between it and a
 * write.
 *
 * **The guarantee is about the joined path, not about the string.** A check
 * that refused the substring `..` would still let `a/b.mp4` write into a
 * subdirectory nobody asked for; what this promises is that
 * `join(folder, safeFilename(name))` is a file *directly inside* `folder`,
 * whatever the name was. So the name is reduced to its last segment on both
 * separators — it came off a browser on someone else's machine, not off this
 * disk, so the separator this platform happens to use is not the question.
 *
 * **The name the maintainer picked is otherwise left alone**, extension,
 * accents, spaces and inner dots included. The **Managed media directory** is
 * something they open by hand, and a file slugged into `rear-window-mp4` is a
 * file they would not recognise as the one they added.
 *
 * A name that reduces to nothing, or to nothing but dots, becomes
 * {@link FALLBACK}: `..` joined to a folder *is* the folder above it, `.srt` is
 * a hidden file on every POSIX machine and no name at all on Windows, and a
 * part can arrive carrying no filename whatsoever.
 */
export function safeFilename(name: string): string {
  const segment =
    name
      // Node refuses a path containing a null byte by throwing, which would
      // turn a crafted name into a failed save rather than a stored file. The
      // rest of the control characters go with it — none of them is part of a
      // name anybody typed. The rule that objects to control characters in
      // a pattern is objecting to precisely what this pattern is for.
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u001f]/g, '')
      .split(/[/\\]/)
      .pop()
      ?.trim() ?? '';

  if (segment === '' || /^\.+$/.test(segment)) {
    return FALLBACK;
  }

  // A name that is only an extension gets something to go in front of it: the
  // extension is the half worth keeping.
  return segment.startsWith('.') ? `${FALLBACK}${segment}` : segment;
}

/** What a name with nothing usable left in it is called instead. */
const FALLBACK = 'file';
