import type { UploadState } from '../useCapabilities/useCapabilities';

/** What the **Component drop zone** prints, for one **Upload state**. */
export interface ZoneFace {
  /** The zone's first line: the invitation, or which write is running. */
  title: string;
  /**
   * The second line — or `null` for the invitation, which is the one face the
   * molecule composes itself because its `ffmpeg` is a `<Mono>` span rather
   * than a word. Recorded here rather than hidden: a reader of this table can
   * see that one of the four lines is not a string.
   */
  line: string | null;
  /** Whether that line is drawn in the danger ink. */
  refused: boolean;
}

/** The invitation, which the refusal keeps over the reason it gives. */
const INVITATION = 'Add a codec pack';

/** The two busy faces, by which write is running. */
const BUSY: Record<'install' | 'remove', ZoneFace> = {
  install: {
    title: 'Adding the playback component…',
    line: 'Copying it in and checking it runs',
    refused: false,
  },
  remove: {
    title: 'Removing the playback component…',
    line: 'The formats it added go with it',
    refused: false,
  },
};

/**
 * Pure: an **Upload state** → the face the **Component drop zone** draws, on
 * `importView`'s precedent — six pieces of copy and one danger flag are a
 * table, and a molecule that spelled them as control flow would be deciding
 * what it says in the middle of saying it.
 *
 * The three faces the **Upload state** has. **Idle** is the invitation over a
 * line the molecule composes. **Busy** says which of the two writes is running
 * — _Adding_ over _Copying it in and checking it runs_, or _Removing_ over
 * _The formats it added go with it_. **Refused** keeps the invitation as its
 * title and puts the route's own reason under it in the danger ink, where it
 * stays until the next attempt replaces it.
 *
 * **Copy only.** Whether the input is disabled, whether the hover paints and
 * whether a drop reports anything are behaviour, and stay on the molecule — a
 * face carrying a `disabled` flag would be this table deciding what a control
 * does.
 *
 * The words stay the family's: the zone says _codec pack_ because that is what
 * they drop; the code, the wire and the glossary say **Playback component**.
 */
export function zoneFace(upload: UploadState): ZoneFace {
  switch (upload.kind) {
    case 'busy':
      return BUSY[upload.action];
    case 'refused':
      return { title: INVITATION, line: upload.reason, refused: true };
    case 'idle':
      return { title: INVITATION, line: null, refused: false };
  }
}
