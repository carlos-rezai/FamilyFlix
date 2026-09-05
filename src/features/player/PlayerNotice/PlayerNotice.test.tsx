import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

import { PlayerNotice } from './PlayerNotice';
import { theme } from '@/styles/theme';

/**
 * 10 — Video player, Phase 3 (issue #85).
 *
 * The centre of the picture is **one** element — the 96px circle — drawn as the
 * big play glyph, as **buffering**, or as **unavailable**. That is
 * `COMPONENT-SPEC`'s rule for this component and the reason the two notices
 * were amended into `feat.PlayerControls.dc.html` rather than given an element
 * of their own: a second centred thing would give the screen two vocabularies
 * for one idea.
 *
 * Neither notice carries its own way out. The Back pill in the chrome is the
 * way out, and the chrome is held on screen for exactly as long as a notice is
 * showing, so a film that cannot be played is never a trap.
 *
 * The copy is the prototype's, verbatim — `FamilyFlix.dc.html`'s `noticeCopy`.
 */
const BUFFERING = 'Getting this film ready…';
const MISSING_TITLE = 'This film’s file is missing';
const MISSING_BODY =
  'FamilyFlix can’t find the video file for this title. It may have been ' +
  'moved or renamed outside the app.';

/**
 * The third message, added with the FFmpeg pipeline (issue #89) — the state
 * that only becomes possible once there is more than one **Playback path** to
 * fail to find. Also the prototype's copy verbatim.
 */
const CANNOT_TITLE = 'This film can’t be played';
const CANNOT_BODY =
  'FamilyFlix can’t decode this file’s format. Adding a playback component in ' +
  'Settings may fix it.';

/**
 * The fourth message (issue #96) — the **Failed conversion**. It is reached
 * *through* the buffering notice rather than instead of it: the film was
 * decodable as far as the probe could tell, a conversion was begun, and it
 * stopped without producing a frame. Prototype copy verbatim, as the rest are.
 */
const COULD_NOT_START_TITLE = 'This film could not be started';
const COULD_NOT_START_BODY =
  'FamilyFlix started getting this film ready and it stopped. Adding a ' +
  'playback component in Settings may fix it.';

/** The prototype's circle, to the pixel. */
const CIRCLE_SIZE = '96px';

function renderNotice(
  kind:
    | 'play'
    | 'buffering'
    | 'missing-file'
    | 'cannot-play'
    | 'could-not-start'
) {
  return render(
    <ThemeProvider theme={theme}>
      <PlayerNotice kind={kind} />
    </ThemeProvider>
  );
}

/** The one 96px circle every state is drawn inside, or nothing. */
function circle(container: HTMLElement): HTMLElement | undefined {
  return Array.from(container.querySelectorAll<HTMLElement>('*')).find(
    (element) => {
      const style = window.getComputedStyle(element);
      return style.width === CIRCLE_SIZE && style.height === CIRCLE_SIZE;
    }
  );
}

describe('PlayerNotice', () => {
  it('draws the big play circle over a stopped film, and says nothing', () => {
    const { container } = renderNotice('play');

    expect(circle(container)).toBeDefined();
    expect(container.querySelector('svg')).not.toBeNull();
    expect(container.textContent).toBe('');
  });

  it('says what a film is doing while it is getting ready', () => {
    renderNotice('buffering');

    // A frozen black screen reads as a crash; this is the sentence that stops
    // it doing that.
    expect(screen.getByText(BUFFERING)).toBeDefined();
  });

  it('says what has happened when the film’s file is missing', () => {
    renderNotice('missing-file');

    expect(screen.getByText(MISSING_TITLE)).toBeDefined();
    expect(screen.getByText(MISSING_BODY)).toBeDefined();
  });

  it('says what has happened when this build cannot decode the film', () => {
    // The message the FFmpeg pipeline made possible: the file is right there,
    // and nothing installed can read it.
    renderNotice('cannot-play');

    expect(screen.getByText(CANNOT_TITLE)).toBeDefined();
    expect(screen.getByText(CANNOT_BODY)).toBeDefined();
  });

  it('keeps a film it cannot decode apart from a film it cannot find', () => {
    // Two different things have gone wrong and they have two different
    // remedies — find the file, or install a component. One message for both
    // would send the family looking for a disc that is on the shelf.
    const undecodable = renderNotice('cannot-play');
    const absent = renderNotice('missing-file');

    expect(undecodable.container.textContent).not.toBe(
      absent.container.textContent
    );
    expect(undecodable.container.textContent).not.toContain(MISSING_TITLE);
  });

  it('says what has happened when a conversion begins and then stops', () => {
    // Not the same sentence as `cannot-play`. That one is known before a byte
    // is sent, from the probe; this one is known only after a conversion was
    // attempted, and has to say the film was begun.
    renderNotice('could-not-start');

    expect(screen.getByText(COULD_NOT_START_TITLE)).toBeDefined();
    expect(screen.getByText(COULD_NOT_START_BODY)).toBeDefined();
  });

  it('keeps a conversion that stopped apart from a format it cannot decode', () => {
    // One message for both would tell a family their MKV is undecodable on the
    // evening their graphics card happened to be busy.
    const stopped = renderNotice('could-not-start');
    const undecodable = renderNotice('cannot-play');

    expect(stopped.container.textContent).not.toBe(
      undecodable.container.textContent
    );
    expect(stopped.container.textContent).not.toContain(CANNOT_TITLE);
  });

  it('draws every state inside the same circle', () => {
    // One centred element with five faces, not five centred elements.
    for (const kind of [
      'play',
      'buffering',
      'missing-file',
      'cannot-play',
      'could-not-start',
    ] as const) {
      const { container, unmount } = renderNotice(kind);

      expect(circle(container)).toBeDefined();
      unmount();
    }
  });

  it('offers no way out of its own, because the Back pill is the way out', () => {
    const { container } = renderNotice('missing-file');

    expect(container.querySelector('button')).toBeNull();
  });
});
