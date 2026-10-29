/**
 * The **Start-up splash**: the page the shell's window opens over at
 * `whenReady`, before the server's `ready`, as a `data:` URL of static HTML.
 * The 88px tile with the FF mark beating (a fade under reduced motion) over
 * _Opening your library_, on `bg`. It is the window's first paint, so it loads
 * nothing: no network, no server, no font file.
 *
 * The shell imports only types from `src/`, so the token values and the F
 * paths are copies: of `src/tokens/` and
 * `docs/handoff/brand/familyflix-mark.svg` (the beat of
 * `src/primitives/LogoLoader/LogoLoader.styles.ts`). They change only if
 * those do.
 */

/** `bg`, `text` and `accent` from `src/tokens/colors.ts`. */
const BG = '#14110d';
const TEXT = '#f3ece0';
const ACCENT = '#d97a4e';

/** `sans` from `src/tokens/typography.ts`; only what is installed is drawn. */
const SANS = "'Hanken Grotesk', system-ui, sans-serif";

/**
 * The mark's two Fs, copied from `src/tokens/brand.ts` (`MARK_F1`, `MARK_F2`),
 * the paths of `docs/handoff/brand/familyflix-mark.svg`.
 */
const F1 =
  'M380.23 704.39L174.08 704.39L174.08 666.32L220.93 663.98Q220.93 654.61 220.93 645.82L220.93 377.59Q220.93 368.81 220.93 360.02L174.08 357.10L174.08 319.61L489.16 319.61L493.84 420.93L446.41 420.93L432.35 357.10L324.59 357.10Q324.59 367.64 324.59 377.59Q324.01 407.46 324.01 436.74L324.01 488.87L388.43 488.87L396.04 444.94L434.69 444.94L434.69 574.37L396.04 574.37L388.43 527.52L324.01 527.52L324.01 586.08Q324.01 615.95 324.59 645.24Q324.59 654.61 324.59 663.39L380.23 666.32';
const F2 =
  'M736.30 704.39L530.16 704.39L530.16 666.32L577.01 663.98Q577.01 654.61 577.01 645.82L577.01 377.59Q577.01 368.81 577.01 360.02L530.16 357.10L530.16 319.61L845.23 319.61L849.92 420.93L802.48 420.93L788.43 357.10L680.67 357.10Q680.67 367.64 680.67 377.59Q680.08 407.46 680.08 436.74L680.08 488.87L744.50 488.87L752.12 444.94L790.77 444.94L790.77 574.37L752.12 574.37L744.50 527.52L680.08 527.52L680.08 586.08Q680.08 615.95 680.67 645.24Q680.67 654.61 680.67 663.39L736.30 666.32';

const HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">
<title>FamilyFlix</title>
<style>
html, body { margin: 0; height: 100%; background: ${BG}; }
body { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; }
svg { display: block; overflow: visible; }
.f { transform-box: fill-box; transform-origin: 50% 100%; animation: beat 1.3s ease-in-out infinite; }
.f2 { animation-delay: 0.22s; }
p { margin: 0; font-family: ${SANS}; font-size: 15px; font-weight: 600; color: ${TEXT}; }
@keyframes beat {
  0%, 64%, 100% { opacity: 0.28; transform: translateY(0); }
  22% { opacity: 1; transform: translateY(-7%); }
}
@keyframes fade {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 1; }
}
@media (prefers-reduced-motion: reduce) {
  .f { animation-name: fade; }
}
</style>
</head>
<body>
<svg viewBox="0 0 1024 1024" width="88" height="88" aria-hidden="true">
<rect width="1024" height="1024" rx="225.28" fill="${BG}"/>
<path class="f" fill="${TEXT}" d="${F1}"/>
<path class="f f2" fill="${ACCENT}" d="${F2}"/>
</svg>
<p role="status">Opening your library</p>
</body>
</html>
`;

/** The splash as a `data:` URL of base64 HTML. */
export function splashPage(): string {
  return `data:text/html;charset=utf-8;base64,${Buffer.from(HTML, 'utf8').toString('base64')}`;
}
