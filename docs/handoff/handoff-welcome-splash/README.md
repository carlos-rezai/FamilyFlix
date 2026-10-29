# Welcome splash — handoff (option 2a "Bounce, sweep, handoff")

Open `prototype/Welcome Splash.dc.html` in a browser. Option **2a** (top of page) is the chosen one; 1a–1f are the explored alternatives, kept for reference only.

## When it plays

- **Cold start only**: first launch of the app process. Not on resume from background, not after sign-in, not on route changes.
- **Skippable**: any tap, click or remote/keyboard key jumps straight to home (150ms fade).
- If the app is **not ready** at the end of the sequence, hold the final splash frame (mark + wordmark centred) and switch to `prim.LogoLoader` size large, then run the handoff (step 5) when ready. If the app is ready early, still finish the sequence — never cut mid-way.
- No sound.

## Layers (bottom → top)

1. Home screen, rendered underneath with its header wordmark **hidden** (the splash wordmark becomes it).
2. Splash background: `--color-bg`, full screen.
3. FF mark, centred, 26px above centre. Prototype size 132×80 (viewBox `160 300 704 424`, paths in `prim.LogoLoader`). F1 `--color-text`, F2 `--color-accent`.
4. Wordmark "FamilyFlix", Source Serif 4 700, 30px, letter-spacing −0.01em, centred 42px below centre. "Family" `--color-text`, "Flix" `--color-accent`.

Scale positions/sizes proportionally to the screen (prototype stage is 480×270).

## Timeline (ms from start, total ≈ 2250)

| #   | Element                      | Start       | Duration | Easing                   | Motion                                                                                                       |
| --- | ---------------------------- | ----------- | -------- | ------------------------ | ------------------------------------------------------------------------------------------------------------ |
| 1   | F1                           | 0           | 520      | cubic-bezier(.3,.6,.4,1) | Drop in: translateY −70% → +5% (55%) → −3% (75%) → 0; opacity 0→1 by 55%. Origin bottom centre               |
| 1   | F2                           | 150         | 520      | same                     | same                                                                                                         |
| 2   | Each letter of wordmark (10) | 520 + i×40  | 420      | cubic-bezier(.2,.7,.3,1) | translateY 60% → 0, opacity 0→1, blur 4px → 0                                                                |
| 3   | Sweep over mark              | 1000        | 700      | cubic-bezier(.4,0,.2,1)  | 220-unit-wide band, translateX −260 → +760 (viewBox units), clipped to each F                                |
| 3   | Sweep over letters           | 1150 + i×45 | 380      | linear                   | Band clipped to letter glyph, background-position 160% → −60%                                                |
| 4   | FF mark                      | 1750        | 300      | ease-out                 | opacity 1→0, scale 1 → 0.7                                                                                   |
| 5   | Wordmark                     | 1750        | 500      | cubic-bezier(.3,.7,.2,1) | Move from centre to home-header position (16px, 16px), scale 30px → 16px (0.5333), transform-origin top-left |
| 6   | Splash background            | 1800        | 400      | ease-out                 | opacity 1→0                                                                                                  |
| 7   | Home content                 | 1850        | 400      | ease-out                 | opacity 0→1                                                                                                  |

At the end, unhide the real header wordmark and remove the splash layers in the same frame.

## Sweep colours (inverted per colour)

- Over **white** shapes (F1, "Family"): warm orange `rgb(255,150,90)`, peak opacity 0.95–1.
- Over **orange** shapes (F2, "Flix"): white, peak opacity 0.7 (mark) / 0.9 (letters).
- Gradient: 0 → peak at 50% → 0, angle 100° for text. Implement as a masked/clipped gradient per shape (SVG `clipPath` for the mark; per-glyph `background-clip: text` or a shader/mask on native).

## Reduced motion

No drop, blur, sweep or move. Mark + wordmark fade in (0–300ms), hold, splash fades out at 900ms (300ms), home fades in at 1000ms (300ms). Header wordmark simply appears with home.

## Accessibility

- Splash container: `role="status"`, `aria-label="Opening FamilyFlix"`; decorative layers `aria-hidden`.
- Don't trap focus; the first focusable element on home receives focus after the handoff.

## Screenshots

`screenshots/` — frames at 450, 1250, 1450, 1950 and 2600ms.
