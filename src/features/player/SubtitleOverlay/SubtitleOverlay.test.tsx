import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

import { theme } from '@/styles/theme';

import { SubtitleOverlay } from './SubtitleOverlay';

/**
 * 10 — Video player, Phase 6: "subtitles" (issue #88).
 *
 * The **Subtitle overlay**: the styled box near the foot of the picture drawing
 * the **Cue** that covers the **Absolute position**. A 1:1 translation of the
 * block `feat.PlayerControls.dc.html` draws behind `p.showSubtitle`.
 *
 * **It is ours, not the browser's.** No `<track>`, no `::cue`, no native
 * captions anywhere — which is not a preference. `::cue` cannot reach this
 * box's geometry, and a native track is timed against **Element time** rather
 * than absolute position, so it would desync by the seek distance the moment a
 * stream path exists. Having decided to draw it, we draw all of it.
 *
 * It is presentational: it is handed a line and told whether the **Chrome** is
 * on screen, and decides nothing about which line or when.
 */
const LINE = '— You can see the whole coast from up here.';

/** The prototype's resting offset, with the chrome on screen. */
const LIFTED_BOTTOM = '130px';

function renderOverlay(
  overrides: Partial<Parameters<typeof SubtitleOverlay>[0]> = {}
) {
  return render(
    <ThemeProvider theme={theme}>
      <SubtitleOverlay text={LINE} lifted={false} {...overrides} />
    </ThemeProvider>
  );
}

/** The box the words sit in — the element the prototype styles. */
function box(): HTMLElement {
  return screen.getByText(LINE, { exact: false });
}

/** What the box is positioned by: the full-width band it is centred in. */
function band(): HTMLElement {
  const parent = box().parentElement;
  if (parent === null) {
    throw new Error('The subtitle box was drawn outside anything');
  }
  return parent;
}

describe('SubtitleOverlay', () => {
  it('draws the line it is handed', () => {
    renderOverlay();

    expect(box().textContent).toBe(LINE);
  });

  it('draws nothing at all during a stretch with no dialogue', () => {
    // Not an empty box, and not a transparent one: nothing in the document. An
    // empty box hovering over the picture for most of a film is exactly what
    // the prototype's `sc-if` prevents.
    const { container } = renderOverlay({ text: null });

    expect(container.innerHTML).toBe('');
  });

  it('draws nothing for a cue whose text is blank', () => {
    // Files do contain them. A blank line is no dialogue, whatever the timing
    // said.
    const { container } = renderOverlay({ text: '   ' });

    expect(container.innerHTML).toBe('');
  });

  it('is our own box, in the prototype’s styling', () => {
    // The half-black plate behind white 26px text, its own padding and corner —
    // the styling `::cue` has no way to reach, which is half of why the box is
    // ours in the first place.
    renderOverlay();
    const style = window.getComputedStyle(box());

    expect(style.fontSize).toBe('26px');
    expect(style.color).toBe('rgb(255, 255, 255)');
    expect(style.backgroundColor).toBe('rgba(0, 0, 0, 0.5)');
    expect(style.padding).toBe('6px 16px');
    expect(style.borderRadius).toBe('8px');
  });

  it('uses no native captions machinery of any kind', () => {
    // The other half of why the box is ours: a `<track>` is timed against
    // element time, so on a stream path it desyncs by exactly the seek
    // distance. There is nothing here to desync.
    const { container } = renderOverlay();

    expect(container.querySelector('track')).toBeNull();
    expect(container.querySelector('video')).toBeNull();
  });

  it('keeps a two-line cue on two lines', () => {
    // One cue is one thing said. The break the parsers normalised to `\n` has
    // to survive to the screen rather than collapsing into a single long row.
    const twoLines = 'It was worth the walk.\nEvery step of it.';
    render(
      <ThemeProvider theme={theme}>
        <SubtitleOverlay text={twoLines} lifted={false} />
      </ThemeProvider>
    );

    const drawn = screen.getByText(/Every step of it\./);
    expect(drawn.textContent).toBe(twoLines);
    expect(window.getComputedStyle(drawn).whiteSpace).toContain('pre');
  });

  it('sits at the prototype’s offset while the chrome is on screen', () => {
    renderOverlay({ lifted: true });

    expect(window.getComputedStyle(band()).bottom).toBe(LIFTED_BOTTOM);
  });

  it('drops back down when the chrome fades, so it is not stranded up the picture', () => {
    // The lift exists to clear the transport row. With the chrome gone there is
    // nothing to clear, and a line left at the chrome's height would sit in the
    // middle of the film for the rest of the evening.
    renderOverlay({ lifted: false });
    const resting = parseFloat(window.getComputedStyle(band()).bottom);

    expect(resting).toBeLessThan(parseFloat(LIFTED_BOTTOM));
  });

  it('moves between the two rather than jumping', () => {
    // The prototype transitions `bottom`; the chrome fades over 0.3s and the
    // line has to travel with it rather than snap ahead of it.
    renderOverlay({ lifted: true });

    expect(window.getComputedStyle(band()).transition).toContain('bottom');
  });

  it('never takes the pointer, so a click on the line still pauses the film', () => {
    // The picture underneath is the pause target. A box that swallowed clicks
    // would make the middle of the screen dead for as long as a line is up.
    renderOverlay();

    expect(window.getComputedStyle(band()).pointerEvents).toBe('none');
  });
});
