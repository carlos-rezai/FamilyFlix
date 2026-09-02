import {
  Caption,
  Circle,
  NoticeBody,
  NoticeTitle,
  Spinner,
  Stack,
} from './PlayerNotice.styles';

/**
 * What the centre of the picture is saying. One value, because the circle can
 * only be one thing at a time.
 */
export type PlayerNoticeKind =
  | 'play'
  | 'buffering'
  | 'missing-file'
  | 'cannot-play';

export interface PlayerNoticeProps {
  kind: PlayerNoticeKind;
}

/** The prototype's copy, verbatim — `FamilyFlix.dc.html`'s `noticeCopy`. */
const BUFFERING = 'Getting this film ready…';
const MISSING_TITLE = 'This film’s file is missing';
const MISSING_BODY =
  'FamilyFlix can’t find the video file for this title. It may have been ' +
  'moved or renamed outside the app.';
const CANNOT_TITLE = 'This film can’t be played';
const CANNOT_BODY =
  'FamilyFlix can’t decode this file’s format. Adding a playback component in ' +
  'Settings may fix it.';

/**
 * The centre of the picture whenever the film is not simply running: the big
 * play circle over a stopped film, the buffering ring under "getting this film
 * ready", and the cross over a film whose file is not there.
 *
 * All four are drawn inside the **same** 96px circle. That is `COMPONENT-SPEC`'s
 * rule for this component and the reason the notices were amended into
 * `feat.PlayerControls.dc.html` rather than given an element of their own.
 *
 * **No notice carries its own way out.** The Back pill in the chrome is the way
 * out, and the chrome is held on screen for exactly as long as a notice is
 * showing, so a film that cannot be played is never a trap. A second Back here
 * would be a second thing to keep in step with the first.
 *
 * The two unavailable states share the crossed circle and differ only in words,
 * which is the prototype's own `showUnavailable`. The words are the whole
 * point: a film that cannot be found and a film that cannot be decoded have
 * different remedies, and one message for both would send the family looking
 * for a disc that is on the shelf.
 */
export function PlayerNotice({ kind }: PlayerNoticeProps) {
  if (kind === 'play') {
    return (
      <Circle>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="#fff">
          <path d="M7 5l12 7-12 7z" />
        </svg>
      </Circle>
    );
  }

  if (kind === 'buffering') {
    return (
      <Stack>
        <Circle>
          <Spinner width="40" height="40" viewBox="0 0 24 24" fill="none">
            <circle
              cx="12"
              cy="12"
              r="9"
              stroke="rgba(255,255,255,.22)"
              strokeWidth="2.5"
            />
            <path
              d="M21 12a9 9 0 00-9-9"
              stroke="#fff"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </Spinner>
        </Circle>
        <Caption>{BUFFERING}</Caption>
      </Stack>
    );
  }

  const unavailable =
    kind === 'missing-file'
      ? { title: MISSING_TITLE, body: MISSING_BODY }
      : { title: CANNOT_TITLE, body: CANNOT_BODY };

  return (
    <Stack>
      <Circle>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" stroke="#fff" strokeWidth="2" />
          <path
            d="M5.64 5.64l12.72 12.72"
            stroke="#fff"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </Circle>
      <div>
        <NoticeTitle>{unavailable.title}</NoticeTitle>
        <NoticeBody>{unavailable.body}</NoticeBody>
      </div>
    </Stack>
  );
}
