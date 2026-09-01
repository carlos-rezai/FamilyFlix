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

/** The prototype's circle, to the pixel. */
const CIRCLE_SIZE = '96px';

function renderNotice(kind: 'play' | 'buffering' | 'missing-file') {
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

  it('draws every state inside the same circle', () => {
    // One centred element with three faces, not three centred elements.
    for (const kind of ['play', 'buffering', 'missing-file'] as const) {
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
