# FamilyFlix — Component Specification (Design → Code Handoff)

This document maps the **FamilyFlix design prototype** (the `.dc.html` files in this
project) onto the codebase's **Atomic Design** architecture. It is the contract for the
1:1 translation: every prototype component listed here has a target folder, a typed prop
interface, variants/states, and the tokens it consumes.

The prototype is built as composable component files. Filenames are flat and
rung-prefixed (`prim.*`, `mol.*`, `feat.*`, `page.*`) because the prototype runtime
resolves components as siblings; the **Target path** column below is where each one lands
in `src/`.

---

## 1. Translation rules

- **Styling:** every visual value in the prototype is a CSS custom property from
  `tokens.css` (e.g. `var(--color-accent)`). In code these become the
  **styled-components `ThemeProvider`** theme; a `.styles.ts` file per component holds the
  styled blocks. No inline styles in the codebase — the prototype uses inline styles only
  because that is its authoring constraint.
- **Four-file shape:** each component →
  `Name/{index.ts, Name.tsx, Name.test.tsx, Name.styles.ts}`. Category folders
  (`primitives/`, `components/`) get a barrel `index.ts`.
- **Props:** each prototype component declares a typed `data-props` interface (the
  **Props** tables below are generated from those). `editor: null` props are
  data/callbacks (no design-time control); the rest are design knobs.
- **Presentational vs. container:** primitives and molecules are **pure/presentational**
  — they render from props and emit callbacks, hold no app state. All app state
  (movies, watch status, search/sort/filter, form fields, player position) lives in the
  **container** (`FamilyFlix.dc.html` → in code, feature hooks + a small store/context).
- **Icons:** the prototype inlines SVGs and maps a few by `name` inside `IconButton` /
  `TextField` / `FileField`. In code, lift each into its own component (one per icon)
  through a shared `IconBase` — see §3a.

---

## 2. Tokens — `tokens.css` → `src/tokens/`

| Group      | Prototype vars                                                                                                                                                                                                                        | Target                 |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| Color      | `--color-bg`, `--color-bg-2`, `--color-surface`(`-2`,`-3`), `--color-border`(`-soft`), `--color-text`(`-dim`,`-faint`), `--color-accent`(`-hover`,`-press`,`-soft`,`-line`), `--color-focus-ring`, `--color-watched`, `--color-scrim` | `tokens/colors.ts`     |
| Typography | `--font-serif` (Source Serif 4), `--font-sans` (Hanken Grotesk), `--font-mono` (JetBrains Mono)                                                                                                                                       | `tokens/typography.ts` |
| Spacing    | `--space-1..8` → 4/8/12/16/24/32/48/64 px                                                                                                                                                                                             | `tokens/spacing.ts`    |
| Radius     | `--radius-sm` 8, `--radius-md` 12, `--radius-lg` 18, `--radius-pill` 999                                                                                                                                                              | `tokens/radius.ts`     |
| Motion     | `--dur-fast` 120ms, `--dur-base` 180ms, `--dur-slow` 280ms, `--ease-out` `cubic-bezier(.2,.7,.3,1)`                                                                                                                                   | `tokens/motion.ts`     |
| Runtime    | `--card-w`, `--poster-radius` (set per-render from props/tweaks)                                                                                                                                                                      | component props        |

Assemble these into one `theme` object passed to `<ThemeProvider>`. Keep the names — they
already read as a semantic scale.

### Brand assets — `brand/`

| Asset        | File                                                                       | Target                                                                                                                                                |
| ------------ | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Wordmark** | drawn inline (library header, About card) — no file                        | `layouts/` and `AboutSection`                                                                                                                         |
| **App mark** | `brand/familyflix-mark.svg`, previews `familyflix-mark-{256,512,1024}.png` | `electron/assets/icon.ico` and `public/favicon.ico`, rendered; through `electron/packaging/`, the packaged exe, the **Installer** and the uninstaller |

The **App mark** is the Wordmark reduced: its two F's, `--color-text` (`#f3ece0`) then
`--color-accent` (`#d97a4e`), Source Serif 4 at 700 outlined to paths, on a `--color-bg`
(`#14110d`) square with a 22% corner radius. The SVG carries no `<text>` and no font
reference, so it renders the same on a machine without the font. It is what the OS draws —
window, taskbar, Alt+Tab, shortcut, browser tab — and never appears on a screen that draws
the Wordmark. The icons are rendered from the SVG by a script; change the SVG, then re-run
the script — never edit a rendered icon.

---

## 2a. Interaction & motion contract

Every interactive component follows the same three-state model. Do not invent per-component
variations — if a new component needs a state, extend this section first.

### The rule: buttons signal with colour, cards signal with elevation

| Surface                                                      | Hover                                                                                                      | Press                                                             | Focus (keyboard)              |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ----------------------------- |
| **Controls** (Button, Chip, IconButton, FilterDropdown)      | fill (and border) shift, **no shadow**; `Chip` rises 1px and `IconButton` swells to `1.06`, the files' own | background darkens + `scale(.98)` (IconButton/checkbox `.92–.94`) | 3px `--color-focus-ring` ring |
| **Cards** (PosterCard, ContinueCard, SeasonCard, EpisodeRow) | `translateY(-4px)` + deeper shadow + `--color-accent-line` border                                          | settles to `translateY(-1px)`                                     | 2px outline, 4px offset       |

The two vocabularies are deliberately disjoint. A Control's hover never adds a shadow; a Card
never recolours its fill. This is what keeps a dense grid of posters readable next to a row of controls.

### Timing

- Hover in: `--dur-fast` (120ms). Card transforms: `--dur-base` (180ms).
- **Press: 60–70ms.** Press is always faster than hover — the asymmetry is what makes a control
  feel physical rather than laggy. Do not equalise them.
- Easing is always `--ease-out`. Never `linear` (reads cheap), never `ease-in` on an
  entrance.

### Accent derivation — important

`--color-accent` is **themeable** (the `accentColor` prop on the app root). The hover, press,
soft, line and focus-ring values are **derived from it at runtime**, not hardcoded:

| Var                    | Derivation                        |
| ---------------------- | --------------------------------- |
| `--color-accent-hover` | accent lightened 18% toward white |
| `--color-accent-press` | accent darkened 12% toward black  |
| `--color-accent-soft`  | accent at 14% alpha               |
| `--color-accent-line`  | accent at 32% alpha               |
| `--color-focus-ring`   | hover value at 55% alpha          |

`tokens.css` ships the defaults for the stock accent (`#d97a4e`); `FamilyFlix.dc.html`
recomputes all five from the themed accent and sets them on the app root. **In code, do the
same in the theme factory** — if you alias hover to the base accent, every primary button
silently loses its hover state.

### Accessibility

- Focus rings use `:focus-visible` only (no ring on mouse click).
- Hover is never the sole carrier of information — every hover-revealed affordance
  (e.g. the EpisodeRow play overlay) has a non-hover equivalent (the row is clickable).
- `tokens.css` carries a global `prefers-reduced-motion: reduce` block that collapses all
  durations to ~0. Port it; don't reimplement per component.

---

## 3. Primitives (atoms) → `src/primitives/`

### Button — `prim.Button.dc.html`

Target: `primitives/Button/` · **used** by MovieForm (Save/Cancel), MoviePage (Play),
SettingsPage (Update/Check), ImportFlow (Start/Cancel/Finish), ExportModal (Export/Cancel/Done).
| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `label` | string | "Button" | |
| `variant` | `'primary' \| 'secondary' \| 'ghost' \| 'danger'` | primary | primary = accent fill; secondary = bordered; ghost = text-only; danger = bordered, danger-colored |
| `size` | `'md' \| 'lg'` | md | md = 50px/radius-md; lg = 58px/radius-pill |
| `icon` | `'none' \| 'play'` | none | optional leading glyph |
| `fullWidth` | boolean | false | stretch to container |
| `disabled` | boolean | false | muted fill, no hover/click |
| `busy` | `'idle' \| 'waiting' \| 'shown'` | idle | the **Busy phase** (log 53); button form only, never on the link. `waiting`: disabled, `aria-busy`, the idle label, the variant's face kept (not the muted disabled fill), `cursor: progress`. `shown`: `busyLabel` in a span with `aria-live="polite"` and the shine. The idle width is held as `min-width` while busy. `onClick` never fires while busy |
| `busyLabel` | string | `label` | the _-ing_ form: _Saving…_, _Adding…_, _Clearing…_, _Deleting…_, _Erasing…_, _Testing…_, _Exporting…_ |
| `onClick` | () => void | — | |

States: hover (background lightens per variant), press (darkens + `scale(.98)`),
focus-visible (accent ring), disabled (muted fill, no state changes). **No hover lift or
shadow** — see §2a. Primary hover/press come from `--color-accent-hover` / `-press`.

**Busy** (log 53, from `handoff-loading-states/`): the button never draws the FF mark. The
shine is a moving `mask-image` over the label in the button's own ink, so one rule serves
every variant; the handoff's `background-clip: text` gradient in one fixed ink is not used
(wrong on the bordered `danger`). Under reduced motion it fades, with its own keyframes that
`GlobalStyle`'s `*` rule does not collapse. Shown only under **Loader timing**
(`useDelayedBusy`: nothing for 300ms, then held 500ms). No _Saved ✓_ face. The callers:
the Movie form's save (_Add to library → Adding…_, _Save changes → Saving…_), the Clear
dialog (_Clear details → Clearing…_), _Test connection → Testing…_, Library folders'
_Add → Adding…_ (with _Browse…_ disabled beside it), the Export dialog (_Export as CSV →
Exporting…_), the Delete dialogs (_Delete movie / Delete series → Deleting…_) and the
Reset dialog (_Erase everything → Erasing…_). Not _Check for updates_. The handoff's
_Save movie_, _Clear metadata_ and _Delete folder_ are not the app's words.

### IconButton — `prim.IconButton.dc.html`

Target: `primitives/IconButton/`
| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `icon` | `'heart'\|'heart-filled'\|'gear'\|'more'\|'back'\|'close'\|'plus'` | heart | extend via Icon atom |
| `size` | number | 46 | square px |
| `variant` | `'ghost' \| 'outline'` | ghost | |
| `active` | boolean | false | pressed/selected surface |
| `title` | string | "" | tooltip / a11y label |
| `onClick` | () => void | — | |

### Chip — `prim.Chip.dc.html`

Target: `primitives/Chip/` · genre selector chips + static genre tags.
| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `label` | string | "Chip" | |
| `selected` | boolean | false | accent-soft fill + accent text |
| `size` | `'sm' \| 'md'` | md | sm = tag, md = selectable |
| `onClick` | () => void? | — | omit for static tag (cursor default) |

### TextField — `prim.TextField.dc.html`

Target: `primitives/TextField/`
| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `value` | string | "" | |
| `placeholder` | string | "" | |
| `icon` | `'none'\|'search'\|'folder'\|'sheet'` | search | optional leading icon |
| `mono` | boolean | false | monospace (file paths) |
| `rounded` | boolean | true | pill vs. radius-md |
| `height` | number | 46 | |
| `onInput` | (e) => void | — | |

### Textarea — `prim.Textarea.dc.html`

Target: `primitives/Textarea/` · props: `value`, `placeholder`, `minHeight` (96), `onInput`.
**Used** by MovieForm (Description). IconButton is **used** for the back-arrows on
MovieForm/SettingsPage/ImportFlow.

### StarRating — `prim.StarRating.dc.html`

Target: `primitives/StarRating/` · **display only** (0–100% → 5 stars, half-star steps).
| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `rating` | number (0–100) | 80 | percent |
| `size` | number | 14 | star px |
| `showValue` | boolean | false | append "4.0" |

### ProgressBar — `prim.ProgressBar.dc.html`

Target: `primitives/ProgressBar/` · props: `percent` (0–100), `indeterminate` (bool),
`height` (5), `track` (bool). Determinate fills to `percent`; **indeterminate** renders an
animated sliding segment (no value) for unknown-total work — use it during a discovery/scan
phase, then switch to determinate once the total is known. Used on poster cards (watch
progress), the player scrubber base, and the Import scan/import phases.

### StatusBadge — `prim.StatusBadge.dc.html`

Target: `primitives/StatusBadge/` · props: `kind` (`'watched'`), `size` (30). Round
check badge. In-progress state is shown by `ProgressBar`, not a badge.

### Toggle — `prim.Toggle.dc.html`

Target: `primitives/Toggle/` · a switch atom. Props: `checked` (boolean),
`onToggle` (callback). `role="switch"` + `aria-checked`; knob slides, track fills accent
when on. Used in Settings → Subtitles ("Turn on automatically"); reuse for any on/off
setting.

### LogoLoader: `prim.LogoLoader.dc.html`

Target: `primitives/LogoLoader/`, in the `primitives` barrel (no per-unit `index.ts`, the
handoff's suggestion notwithstanding). The **Logo loader** (log 53): the two F paths of
`brand/familyflix-mark.svg`, F1 in `text` and F2 in `accent`.
| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `size` | number | 48 | width px; height `size × 424/704`, or `size` with `tile` |
| `progress` | number? | none | 0–1: the mark fills left to right (determinate, both Fs at 20% under a full copy clipped by `scaleX(progress)`, 280ms). Left out, the Fs take turns rising (indeterminate, `ffLogoBeat` 1.3s, F2 0.22s behind) |
| `tone` | `'brand' \| 'current'` | brand | `current`: both Fs in `currentColor` |
| `tile` | boolean | false | the app-icon tile behind the mark (`bg`, radius 22%) |
| `label` | string? | none | 15/600 `text`, under the mark |
| `detail` | string? | `NN%` with `progress` | 13 `textFaint`, tabular numbers |
| `inline` | boolean | false | mark and text in a row (gap 8), not a column (gap 14) |

`role="status"`, `aria-live="polite"`, `aria-label` the label plus the detail (_Loading_
when neither); the visible mark and text `aria-hidden`. The clip path's id comes from
`useId`, stripped of characters a `url(#…)` reference can't carry, so two loaders on a page
never share one. Mounts with a 180ms pop-in that collapses under reduced motion like every
other animation; the beat instead fades (opacity only, no movement), with its own keyframes
that `GlobalStyle`'s `*` rule does not collapse, so it never freezes at its dimmest frame.
**Never drawn inside a button** (a **Busy button** shines its label instead). Callers: the
**Dialog loader** (64px). The **Start-up splash** draws the same mark at 88px with `tile`,
but as static HTML in the shell (`electron/splashPage/`), not this atom. The determinate
mode ships with no caller: nothing reports a count yet.

---

## 3a. Icons → `src/primitives/Icon/`

Icons are **atoms**: one component per icon, all funneled through a shared `IconBase`, all
colored with `currentColor`. The prototype inlines the raw SVGs (and maps a few by name
inside `IconButton`/`TextField`/`FileField` as an authoring shortcut) — in code, lift each
one into its own component. Every `<path>` you need is already sitting in the `.dc.html`
files; this section is just the inventory + the contract.

### IconBase contract

```tsx
// primitives/Icon/IconBase.tsx
type IconProps = {
  size?: number;
  title?: string;
} & React.SVGProps<SVGSVGElement>;

export function IconBase({ size = 20, title, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

// primitives/Icon/HeartIcon.tsx
export const HeartIcon = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M12 21.35l-1.45-1.32C5.4 …" fill="currentColor" />
  </IconBase>
);
```

Rules:

- **`currentColor` only** — never hardcode `fill`/`stroke` hex. An icon inherits the
  surrounding text `color`, so it works on accent buttons, dim captions, and white player
  chrome with zero variants. (The prototype already uses `stroke="currentColor"` /
  `fill="currentColor"` for this reason.)
- **`size` prop** (number → px), default `20`. `strokeWidth` stays per-icon (most are 1.6–2).
- **a11y:** decorative icons render `aria-hidden`; pass `title` for a meaningful one.
- Stroke icons keep `stroke-linecap="round" stroke-linejoin="round"`; fill icons (heart,
  play, status check) use `fill="currentColor"`.

### Inventory (pulled from the prototype)

| Icon                               | Style         | Used by (prototype)                                               |
| ---------------------------------- | ------------- | ----------------------------------------------------------------- |
| `SearchIcon`                       | stroke        | SearchBar / TextField                                             |
| `ChevronLeftIcon` (back)           | stroke        | page headers, MoviePage, player, import, form                     |
| `ChevronDownIcon` (caret ▾)        | text/stroke   | FilterDropdown, SubtitleRow (currently the `▾` glyph)             |
| `GearIcon`                         | fill          | LibraryPage maintenance menu                                      |
| `PlusIcon`                         | stroke        | "Add" affordances                                                 |
| `CloseIcon` (✕)                    | stroke        | modal close, remove-row buttons                                   |
| `MoreIcon` (3-dot)                 | fill          | MoviePage and SeriesPage edit/delete menus                        |
| `HeartIcon` / `HeartOutlineIcon`   | fill / stroke | PosterCard fav, MoviePage fav, Favorites header                   |
| `CheckIcon`                        | stroke        | StatusBadge (watched), watched toggle, export success, "All done" |
| `PlayIcon` / `PauseIcon`           | fill          | Play button, ContinueCard badge, player                           |
| `SkipBackIcon` / `SkipForwardIcon` | stroke        | player ±10s                                                       |
| `VolumeIcon` / `VolumeMuteIcon`    | stroke/fill   | player volume                                                     |
| `CaptionsIcon` (CC)                | stroke        | player subtitles                                                  |
| `FullscreenIcon`                   | stroke        | player                                                            |
| `FolderIcon`                       | stroke        | Add-movie hint, Import root field                                 |
| `SpreadsheetIcon`                  | stroke        | Import sheet field, Export filename                               |
| `VideoIcon`                        | stroke        | FileField (video)                                                 |
| `ImageIcon` (poster)               | stroke        | FileField (poster)                                                |
| `FileIcon`                         | stroke        | FileField (generic), SubtitleRow                                  |
| `DownloadIcon`                     | stroke        | Export dialog header                                              |

(`heart` ships as two components — filled and outline — rather than a `filled` prop, since
they're used independently; your call if you'd rather one component with a boolean.)

### Consequence: `IconButton` takes the icon as a child, not a `name` enum

The prototype's `prim.IconButton` switches on an `icon` string internally — that was an
authoring shortcut. In code, make it composable so it stays a dumb chrome atom:

```tsx
<IconButton label="Favorite" onClick={…}><HeartIcon /></IconButton>
```

Same for the PosterCard favorite toggle (pass `HeartIcon` vs `HeartOutlineIcon`) and the
`FileField` video/poster glyphs (pass the component, don't switch on a string). For the few
genuinely data-driven spots, keep a tiny local lookup (`{ video: VideoIcon, poster:
ImageIcon }[kind]`) rather than a global string registry — per-component imports keep
tree-shaking and autocomplete.

---

## 4. Molecules → `src/components/`

### PosterCard — `mol.PosterCard.dc.html` ✅ wired (3 call sites)

Target: `components/PosterCard/` · composes StarRating + StatusBadge + ProgressBar + a
favorite toggle. The library's primary tile.
| Prop | Type | Notes |
| --- | --- | --- |
| `movie` | `{ title, g1, g2, rating, watched, progress, favorite, posterUrl }` | `g1/g2` = poster gradient stops; `posterUrl` (or `null`) a layer over them — none draws the **Default poster** |
| `onOpen` | () => void | navigate to detail |
| `onToggleFav` | () => void | stops propagation internally |

States: hover (lift −4px + deeper shadow + accent-line border, §2a), press (settles to −1px),
focus-visible (offset outline on the card root), watched (badge), in-progress (bottom bar),
favorite (filled heart; the heart button has its own scale hover/press), no poster (the
**Default poster** with the title overlay; a poster url draws neither).

### Default poster

A title with no poster draws the **Default poster**: its own `gradientFromId` gradient with
the FamilyFlix **Wordmark** centred on both axes, plus whatever caption the surface already
draws. Drawn in CSS, never stored, exported or written back.

- **Where it appears:** every poster frame — the Poster card (`mol.PosterCard`), the Continue
  card (`mol.ContinueCard`, the movie's poster or an episode's series poster), and the poster
  frame of `page.MoviePage` and `page.SeriesPage`.
- **Where it doesn't:** the detail backdrops, the player's art layer, the Season card,
  `EpisodeRow`, `UpNextCard` and the Enrichment candidates — each keeps the plain gradient.
  The Season card layers its own **Season poster** over that gradient when it has one, and
  with none draws the gradient alone.
- **The Wordmark:** `Family` in `--color-text`, `Flix` in `--color-accent`, serif 700, the
  header's markup. On the tile it is `11cqmin` (11% of the frame's shorter side — the frame is
  a size container), `opacity: .9`, `text-shadow: 0 1px 8px rgba(0,0,0,.55)` (the title
  overlay's), and `aria-hidden` — the surface's own name stands alone.
- **The layered url:** a poster or backdrop url is a background layer **over** the gradient,
  never in place of it, so an image that fails to load shows the gradient with no script.
  The Continue card anchors its layer at `center 25%`.

### ContinueCard — `mol.ContinueCard.dc.html`

Target: `components/ContinueCard/` · wide 16:10 resume tile.
Props: `movie { title, g1, g2, resumeLabel, progress, posterUrl }`, `onOpen`. `posterUrl`
is drawn at `cover`, anchored `center 25%`, over the gradient; none draws the **Default
poster** under the existing scrim.

### SearchBar — `mol.SearchBar.dc.html`

Target: `components/SearchBar/` · wraps `TextField` (search icon).
Props: `value`, `placeholder`, `grow` (bool), `maxWidth`, `onInput`.

### FilterDropdown — `mol.FilterDropdown.dc.html` (Genre / Sort / Rating — 3 uses)

Target: `components/FilterDropdown/`
| Prop | Type | Notes |
| --- | --- | --- |
| `label` | string | leading caption ("Genre"); empty to omit |
| `value` | string | current selection text |
| `options` | `{ label, count?, selected, onSelect }[]` | menu items |
| `open` | boolean | controlled open state (container owns it) |
| `leadingStar` | boolean | accent ★ before label (Rating filter) |
| `menuWidth` | number | |
| `onToggle` | () => void | |

### Modal — `mol.Modal.dc.html` (pattern)

Target: `components/Modal/` · scrim + centered card + title/subtitle/icon/close. In the
prototype the Export dialog uses this shell directly (see ExportModal). Props:
`open`, `title`, `subtitle`, `icon`, `onClose`, and a body slot (`children`).

`locked` (boolean, false; log 53): the **Locked** modal. Escape and the scrim ask nothing
and the ✕ is not drawn. Only the Delete dialogs and the Reset dialog set it, from the
confirm press (in `waiting` too, with _Cancel_ disabled) until the action settles. The
Clear and Export dialogs stay live while they work.

### DialogLoader: from `handoff-loading-states/` (log 53)

Target: `components/DialogLoader/` · the **Dialog loader**: `{ label: string }`, a 64px
`LogoLoader` with its label, `aria-busy`, drawn inside a **Bare** `Modal` that is `locked`.
Once **Shown**, the three Delete dialogs (through `DeleteTitleBody`) render it as
_Deleting “Coco”_ and the Reset dialog as _Erasing everything_. No step detail (the handoff's
_Removing files from disk_ is not drawn: a Delete is one request and keeps every original)
and no determinate mode. No Cancel and no Close: a failed Delete returns the dialog to its
idle face with _Couldn’t delete “Coco”. Try again._ above the buttons, in the Reset dialog's
refusal style; a refused Reset keeps its own refusal sentence. A Delete or Reset that lands
ends as it did before (its snackbar, leaving or reload), after the hold.

### Fab — `mol.Fab.dc.html`

Target: `components/Fab/` · reusable floating action button — fixed bottom-right, circular,
accent, elevated. Props: `icon` (`'arrow-up' | 'plus'`), `label` (a11y), `size` (52),
`onClick`. **Presentational** — it does not own visibility; the page mounts it
conditionally. In the prototype, `page.LibraryPage` shows it once its scroll body passes
~420px and calls `scrollTo({top:0, behavior:'smooth'})` on click (back-to-top). Note: keep
it transition/animation-free on mount — driving an opacity/transform entrance from a
prop-fed inline style is unreliable across re-renders; mount/unmount it instead.

### ExpandableText — `mol.ExpandableText.dc.html`

Target: `components/ExpandableText/` · long-form copy that clamps to N lines with a
**"Read more" / "Show less"** toggle. Props: `text`, `lines` (4), `fontSize` (17),
`maxWidth` (560). Owns local state (`expanded`, `overflowing`). On mount + resize it
measures `scrollHeight > clientHeight` while clamped and **only renders the toggle when the
text actually overflows** — short copy shows no button. Clamp via `-webkit-line-clamp`
(cuts at a line boundary with ellipsis). Used for the MoviePage synopsis; reuse for any
variable-length copy. In code, `useState` + a `ResizeObserver`/`useLayoutEffect` measure.

### Snackbar — `mol.Snackbar.dc.html`

Target: `components/Snackbar/` · transient bottom-right notification, **4 semantic
variants** (`info` `success` `warning` `error`) mapped to status tokens
(`--color-info/success/warning/danger`). Props: `variant`, `title` (optional bold line),
`message`, `actionLabel` + `onAction` (optional button), `dismissible` + `onDismiss`.
Presentational — colored left bar + icon per variant, optional action, ✕ dismiss; enters
via the `ffSnackIn` keyframe. **The stack/queue/auto-dismiss timers live in the container**
(`pushSnack`/`dismissSnack`), which renders a `column-reverse` stack above all routes. In
code this becomes a `SnackbarProvider` + `useSnackbar()` context. Convention: actionable
snackbars (info + Update button) **persist** until actioned/dismissed; confirmations
(success) **auto-dismiss at 5s**. Used by the software-update flow (Settings → About);
reuse for any app-level feedback.

### LogConsole — `mol.LogConsole.dc.html`

Target: `components/LogConsole/` · auto-scrolling, color-coded activity log for long-running
tasks (installer-style). Props: `lines` (array of `string` or `{ text, kind }`, `kind` ∈
`info`/`scan`/`path`/`success`/`warning`/`error` → token color), `maxHeight` (200).
Monospace, dark terminal background, **auto-follows to the newest line** on update
(`componentDidUpdate` → `scrollTop = scrollHeight`); the parent caps the buffer (~80 lines).
Used in the Import progress console; reuse for any streamed task output (re-scan, codec
install). In code, a `ResizeObserver`/`useEffect` keeps it pinned to the bottom.

### SeasonCard — `mol.SeasonCard.dc.html`

Target: `components/SeasonCard/` · 2:3 season tile for the series page. Composes StatusBadge
(season fully watched) + ProgressBar (partially watched).
Props: `season { number, label?, episodeCount, watchedCount, g1, g2, posterUrl? }`, `onOpen`.
Sub-label switches between "8 episodes" and "3 of 8 watched".
`posterUrl` (`string | null`, absent as `null`) is the **Season poster** — the season's own
art a Sync fetched from TMDB. It is a layer over the `g1`/`g2` gradient (`center`, `cover`),
never in place of it, so an image that fails to load shows the gradient. The `S02` numeral and
its text shadow, the badge, the bar, the caption and the watched line draw over either,
unchanged. With no `posterUrl` the tile is the gradient alone: the card is not a Poster
surface, so never the series poster and never the Wordmark. `page.SeriesPage`'s sample shows
both — _Harbor & Vine_'s Season 1 with art, its Seasons 2 and 3 without.

### EpisodeRow — `mol.EpisodeRow.dc.html`

Target: `components/EpisodeRow/` · one row in a season's episode list: 16:9 thumbnail (hover
play affordance + resume ProgressBar), `S02E04` + title, air date, resume label, and a
watched checkbox. Props: `episode { season, number, title, airDate, watched, progress,
resumeLabel?, g1, g2 }`, `onOpen`, `onToggleWatched`.
The checkbox stops propagation — the row opens the episode, the box only marks it.

### RatingPicker — `mol.RatingPicker.dc.html`

Target: `components/RatingPicker/` · **interactive** half-star input (local hover state).
Props: `value` (0–100), `onChange(percent)`.

### SubtitleRow — `mol.SubtitleRow.dc.html`

Target: `components/SubtitleRow/` · filename + language dropdown (local open state) + remove.
Props: `filename`, `lang`, `langOptions`, `onLangChange(lang)`, `onRemove`.

### FileField — `mol.FileField.dc.html`

Target: `components/FileField/` · labelled file slot: filled row (icon + name + remove) or
dashed "choose" button.
`truncateStart` (the Movie form's Show folder row) ellipsises the name from its start, so its
last segment always shows, and carries the whole name as the row's `title`.
Props: `label`, `filename`, `chooseLabel`, `icon` (`'video'|'poster'|'file'`), `truncateStart?`, `onPick`, `onRemove`.

### PillTabs — `mol.PillTabs.dc.html`

Target: `components/PillTabs/` · the pill track: two or more `aria-pressed` buttons in a
labelled `group` — the surface fill, the soft border, pill corners, 4px in and between;
each tab 38px tall, 20px either side, the sans at 15px; the pressed one the accent in the
near-black ink at 700, the rest transparent in the faint ink at 500. A **Control** (§2a).
Extracted from `page.LibraryPage`'s Movies / Series track, which now imports it; the
**Movie form**'s **Kind tabs** are its second use. Presentational — no URL: the caller
decides what a press writes.
A tab never wraps its label (`white-space: nowrap`); a caller whose track can outgrow its
column — the **Kind filter** with every kind held — sets it in a sideways-scrolling wrapper.
Props: `label`, `options: { value, label }[]`, `value`, `onChange(value)`.

### EpisodeFileRow — `mol.EpisodeFileRow.dc.html`

Target: `components/EpisodeFileRow/` · one episode file on the series Files card, in the
FileField's filled-row furniture: an `S` number field (digits, at most 2), an `E` number
field (digits, at most 3), the episode title field (placeholder _Untitled episode_) and the
✕; under them the mono line, then a children slot for the row's SubtitleRows and its
_＋ Add subtitle_ picker. A row the **Save gate** refuses says why: the refused number
field's border in `danger` (`aria-invalid`), and one 13px `danger` line under the controls —
_Give this episode a season and an episode number._, _Another file is also S01E03._ or _The
series already has S01E03._ Presentational, like SubtitleRow: the caller decides the refusal.
The mono line is the caller's `filename`: a row a **Show folder pick** placed shows its path
inside the show (`Seizoen 2/Aflevering 1.mp4`), a hand-picked file its name (log 51 Q12).
Props: `filename`, `season`, `number`, `title`, `seasonRefused`, `numberRefused`, `refusal`
(string | null), `onSeasonChange(season)`, `onNumberChange(number)`, `onTitleChange(title)`,
`onRemove`, `children`.

### FolderRow — `mol.FolderRow.dc.html`

Target: `features/import-export/FolderRow/` · one **Library folder** on the Library folders
page, in CodecRow's shape: the 40px accent tile with the folder glyph, the path in mono, then
the line, 13px sans, no badge or tint (log 54):

| Folder                 | Line                          | Colour      |
| ---------------------- | ----------------------------- | ----------- |
| Unreachable (any mark) | _Can't be reached right now_  | `danger`    |
| Scanned                | _214 titles_                  | `textFaint` |
| New, no titles         | _Not scanned yet_             | `textFaint` |
| New, holding titles    | _38 titles · not scanned yet_ | `textFaint` |

A **New folder** is one no run has walked to review (`scannedAt: null`); Import setup's
listed folders draw the same line (`folderLine`). A folder with **Left-out videos** draws a second line under it, 13px faint: _3 videos
left out_ (_1 video_ for one) with _Bring back_ beside it, a text button in `GenreRow`'s _View
all_ idiom (13px 600 dim, accent on hover). A press forgets them
(`DELETE /api/library-folders/:id/left-out`) and the line goes. A folder with none draws no
line. Last the ✕ (`RemoveButton`, labelled _Remove `<path>`_). Feature-local rather
than a `components/` molecule: one caller, and it draws a domain record. Presentational: the
press is handed back.
Props: `folder { path, titleCount, reachable, scannedAt, leftOut }` (a `LibraryFolderView`), `onBringBack`, `onRemove`.
The prototype's prop is `scanned: boolean` (default `true`); the row reads `folder.scannedAt === null`.

A refused removal is not the row's: the page draws the route's `409` sentence — _12 titles
play from this folder. Delete them before removing it._, _1 title plays …_ for one — as one
13px `danger` **Refusal** under the row it is about, and the row stays.

### ChoiceCard: drawn inline in `feat.ExportModal`, `feat.ImportFlow`, `page.LibraryFoldersPage` and `feat.MovieForm`

Target: `components/ChoiceCard/` (a molecule, graduated on its third caller) · one card of a pair chosen between, renamed
from `FormatCard` on its second caller, its pixels unchanged: a `role="radio"` button, flex
1, 14px 16px padding, 12px radius; the label 16px 600 in the text ink with the 18px dot at
the row's end, and its line 12.5px faint under it. Chosen, the card takes `--color-accent-soft`
over an `--color-accent-line` border and the dot fills with the accent, inset 3px. The pair
sits 10px apart in a `radiogroup`, which the caller labels. Presentational: the press is
handed back. The Export dialog's Format cards (_CSV_ / _Excel_) are its first caller and
draw exactly as before; the **Import mode**'s are its second. `disabled` draws a card that
can't be chosen — `not-allowed`, at 0.55 opacity, its line still drawn — and a press on it
hands back nothing.
Props: `label`, `line`, `checked`, `onSelect`, `disabled?`.

### ImportModeChoice — drawn inline in `feat.ImportFlow`, `page.LibraryFoldersPage` and `feat.MovieForm`

Target: `components/ImportModeChoice/` (a molecule) · the **Import mode**, `EnrichCheckCard`'s
precedent: one molecule both import starts and the Movie form's series add draw. The caption _Link or copy_ (log 51 Q16), the **Group heading**
(`groupHeadingStyle`, 12px 700 uppercase faint at 0.9px, the Settings `GroupHeading`), sits 12px over
two ChoiceCards in a `radiogroup` labelled by it. A section is labelled by the Group heading;
`labelStyle` (`FieldLabel`) is only the caption over one input (issue #349):

- **Link** — _Play videos where they are. Nothing is copied._
- **Copy** — _Keep FamilyFlix’s own copy, playable with the drive unplugged._

Import setup draws it above the _Also fetch from TMDB_ box; the Library folders page above
**Scan new folders** and **Scan all folders**, in the group **Scan**, in setup's order. **Link** is chosen on every visit
and the choice is never remembered — the caller holds it, posted as `mode` with its start.
The Movie form's shell series add draws it under the Files card, before the TMDB box. With
`linkDisabled` — a show under no Library folder — the Link card is a disabled ChoiceCard
reading _Only for files inside one of your library folders._, and the caller holds Copy.
Props: `mode: ImportMode`, `onChange(mode)`, `linkDisabled?`.

### FieldDiff — `mol.FieldDiff.dc.html`

Target: `components/FieldDiff/` · the field-by-field diff, graduated from
`features/enrichment/` on its second caller (the `CreditsRow` / `CornerMenu` precedent). It
is drawn exactly as the Sync's `conflict` face was. A frame with the `--color-border-soft`
hairline and `--radius-md`. In it, one line per row: the 118px label cell (13px 600 faint on
`--color-bg-2`), then two side buttons. The left side is captioned _Yours_, the right side
`theirsLabel` (11px 700 uppercase faint, then the 13px value). The chosen side is drawn in
`--color-accent-soft` with an inset `--color-accent-line` ring and `aria-pressed`. The theirs
side is chosen on every row until a press says otherwise. Under the frame, _Apply choices_
(`primary`) and _Keep all mine_ (`secondary`). It is generic and presentational: it holds the
choices and reports every row's, default included, and writes nothing. Each caller maps its
own wire type onto it. The Sync's `DecisionRow` draws it as _Yours | TMDB_ and maps `'theirs'`
back to `'tmdb'`. The import's `ProblemRow` draws it as _Yours | Spreadsheet_ and maps
`'theirs'` to `'sheet'`.
Props: `rows: { key: K; label: string; mine: string; theirs: string }[]`, `theirsLabel`,
`onApply(choices: Record<K, 'mine' | 'theirs'>)`, `onKeepAll`.

### EnrichCheckCard — `mol.EnrichCheckCard.dc.html`

Target: `components/EnrichCheckCard/` · the _Also fetch metadata and posters from TMDB_ box,
graduated from `features/import-export/` when the **Movie form** drew it too (design log 45,
the `FieldDiff` precedent). Its pixels are Import setup's card unchanged: a `--color-surface`
card with the `--color-border-soft` hairline, a 10px radius and 14px × 16px padding. In it, the
22px drawn box (a 2px faint border, filled with the accent and a ✓ while ticked) over a real
checkbox in the tab order, clipped. Then the 15px 600 label and the 13px faint hint under it.
The hint while a TMDB key is stored is the caller's `keyedHint`. Import setup passes _Runs
straight after the import, over everything it brings in. Needs the internet._ The Library
folders page passes the scan's sentence, and the Movie form passes _Runs straight after the
save, over this title. Needs the internet._ The key-less hint stays the card's own: _Needs a
TMDB key. Add one under Settings → Network first._ It holds nothing, and a press reports.
Props: `checked`, `keySet`, `keyedHint`, `onToggle()`.

### Accordion — `mol.Accordion.dc.html`

Target: `components/Accordion/` · a header over a body (design log 42 Q12), on the
Problem row's card: `--color-surface`, the `--color-border-soft` hairline, `--radius-md`.
The header row is the toggle — one `button`, 16px in, holding the 16px faint chevron (right
while closed, turned 90° down while open at `--dur-base`), the label (16px 600, ellipsed),
the caller's `marks` 6px apart, and the `count` as the faint pill (11px 700 on
`--color-surface-3`) — then the caller's `actions` beside the button, never inside it, so a
button never nests in a button. The button carries `aria-expanded` and `aria-controls`; the
body is a labelled `region` under it, 16px in and 44px from the left so its rows sit under
the label, its children 10px apart, and **unmounted while closed**. A **Control** (§2a): the
toggle's fill shifts to `--color-surface-2` on hover, darkens to `--color-surface-3` and
settles to `scale(.98)` in 60ms on press, and takes the 3px focus ring on keyboard focus — no
shadow, no lift, `controlStates(press)`. Controlled, `PillTabs`' and `Toggle`'s rule: it
holds no open state. Domain-free: it knows no Problem — the **Review group** is its first
caller, drawing each kind's 8px dot as `marks` and _Skip all_ as `actions`. `marks` is the
one prop beyond log 42 Q12's interface: the log puts each kind's dot in the label line, and
a `label: string` cannot carry one. Not `<details>`: the Kind filter and a bulk press drive
the open state.
Props: `label: string`, `count: number`, `expanded: boolean`, `onToggle()`, `marks?: ReactNode`,
`actions?: ReactNode`, `children: ReactNode`.

### DetailBackdrop — drawn inline in `page.MoviePage` and `page.SeriesPage`

Target: `components/DetailBackdrop/` · the **Detail backdrop**, the one art layer both detail
pages draw. No `mol.*` file of its own (`CreditsRow`'s precedent): both page prototypes draw
it inline, identically. The root is `aria-hidden`, `position: sticky; top: 0; height: 100vh;
margin-bottom: -100vh` — pinned to the top of the page's scroller while the content scrolls
over it; the `100vh` is coupled to the scroller's own height. Inside, the backdrop over its
**Gradient fallback**, then the **Backdrop veil**: a 180° gradient — `rgba(20,17,13,.65)` 0%,
`.85` 50%, `--color-bg` 100% — over `--color-accent-soft`. No motion, no blur.
Props: `url` (string | null), `g1`, `g2`.

### Menu — drawn inline in `page.MoviePage`, `page.SeriesPage` and `page.ManageLibraryPage`

Target: `components/Menu/` · the dropdown both ⋯ menus and the Title row's two menus open:
a trigger the caller draws, a panel of `MenuItem`s, Escape and an outside press closing it.
A `MenuItem` takes `glyph`, `danger` (the **Danger row**), `hint` — a second 13px line in
`--color-text-faint` under the label, the row's accessible description — and `disabled`,
drawn at reduced ink and `aria-disabled` rather than `disabled`, so it stays in the tab order
and a press does nothing (the Title row's _Clear details_ at `none`). `MenuDivider` is the
hairline between groups, the Title row's above _Delete…_. Props: `trigger`, `children`;
`MenuItem` `{ glyph?, danger?, hint?, disabled?, onSelect, children }`.

### CornerMenu — drawn inline in `page.MoviePage` and `page.SeriesPage`

Target: `components/CornerMenu/` · the ⋯ menu's furniture, the same on both detail pages.
No `mol.*` file of its own (`DetailBackdrop`'s precedent): both page prototypes draw it
inline, identically. `mol.Menu` in a fixed slot — `top: 24px; right: 24px; z-index: 30`,
opposite the Back pill — opened by a 44px translucent ⋯ (`rgba(20,17,13,.6)`, a 10px blur,
the `--color-border` hairline, `--color-text-dim` ink; on hover `--color-text` on
`--color-surface-2`, no scale) named _More options_, its glyph `MoreIcon` at 20.
Presentational: it knows no route and no dialog. Its rows are the caller's — `EditMenu`'s
and `SeriesEditMenu`'s, which stay feature units because each navigates and owns a feature's
dialog. Props: `children` (the `MenuItem`s).

---

## 5. Features (organisms) → `src/features/`

> Status: **all 7 features are extracted and wired** as `feat.*.dc.html` files. Each
> receives a single typed model object from the container and composes the molecules above
> (App → feature → molecule → primitive — proven 4 levels deep). The container builds the
> model object in `renderVals()` and mounts the feature via `<dc-import>`.
>
> **Molecule wiring:** all 8 molecules are mounted in the live app — PosterCard (3 grids,
> via GenreRow + LibraryGrid), ContinueCard (resume row), SearchBar + FilterDropdown ×3
> (header), RatingPicker + FileField ×2 + SubtitleRow (inside MovieForm).

| Feature            | Target                              | Composes                                                                                                                                             | Model (props)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------ | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **LibraryHeader**  | `features/library/LibraryHeader`    | SearchBar, FilterDropdown ×3, IconButton (gear menu)                                                                                                 | `{ search, onSearch, genre/sort/rating filter models, onAdd, onImport, onExport }`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **CardCarousel**   | `features/library/CardCarousel`     | PosterCard / ContinueCard                                                                                                                            | `{ items, variant: 'poster' \| 'continue' }` — horizontal scroller with **paged left/right arrow buttons**. Arrows auto-hide at the start/end and when the row doesn't overflow; mouse/trackpad scroll still works. Rows are capped (15 cards) by the container, with "View all" → GenrePage for the full set. Used by GenreRow, Favorites, and Continue rows.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **GenreRow**       | `features/library/GenreRow`         | CardCarousel (poster)                                                                                                                                | `{ name, count, movies: PosterCardMovie[] (≤15), onOpenAll, onOpenMovie, onToggleFav }`: title + "View all {count}" header above a CardCarousel. Also draws the **Other row**: the same row named _Other movies_, holding the films with no genre                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **HomeRows**       | `features/library/home/HomeRows`    | GenreRow ×n, GenreRow (the Other row)                                                                                                                | `{ rows: HomeRow[], other: HomeRow \| null }`: the Movies home's genre rows, then the **Other row** last, titled _Other movies_, every film with no genre capped at 15. Its _View all_ opens the Genre page's `other` mode at `/genre-less`. A search, the rating filter and the sort narrow it; under a genre filter, or when no film lacks a genre, `other` is `null` and the row isn't drawn                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **LibraryGrid**    | `features/library/LibraryGrid`      | PosterCard                                                                                                                                           | `{ movies, onOpenMovie, onToggleFav }` (genre page grid, full set)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **MovieForm**      | `features/movie-form/MovieForm`     | PillTabs (Kind), TextField, Textarea, Chip, RatingPicker, FileField ×2, SubtitleRow ×n, EpisodeFileRow ×n, ImportModeChoice, EnrichCheckCard, Button | The **Import mode**: on a shell add alone, both kinds, under the Files card: Link on every visit, disabled with its line and Copy chosen for a show, or a movie's picked video (its path read through the **Path bridge** and checked with the containing read the moment it is picked), under no Library folder; its caption reads _Link or copy_. The lede ends _To add many at once, use **Library folders**._ (log 51 Q16). **Add and sync**: on a plain add alone, both kinds, the `EnrichCheckCard` sits between the Files card and the actions, off on every mount. A ticked save replaces the form with the new title's page and pushes the **Enrichment flow** over it, **Started on arrival**. `{ kind, showKindTabs, showEnrich, enrich, onToggleEnrich, showImportMode, importMode, onImportMode, linkDisabled, title, year, director, cast, description, genres[], rating, video, poster, subtitles[], episodes[], addShowFolder, showFolder, onRemoveShowFolder, showFolderRefusal, straySubtitles, canSave, + onChange handlers, onSave, onCancel }`; see _The Movie form's two kinds_ below                                                                                                                                                                                                                                                                                          |
| **PlayerControls** | `features/player/PlayerControls`    | ProgressBar (scrubber), IconButton                                                                                                                   | `{ playing, currentTime, duration, volume, muted, subsOn, hasSubtitlePicker, controlsVisible, notice, + handlers }`. The CC pill has two faces, lit while subtitles show: with one subtitle file the on/off toggle; with `hasSubtitlePicker` (two or more) the **Subtitle picker**, whose menu opens upward in the Audio picker's panel listing _Off_ then each file in track order by its language, ` · Track N` after a shared one (_English · Track 1_, _English · Track 2_), the showing one or _Off_ marked; a pick switches and shuts, Escape or a press outside shuts unchanged, and while open it holds the chrome up. Without subtitles the pill is not drawn. Every notice in the one 96px circle: the play triangle, the buffering ring under _Getting this film ready…_, and the crossed circle over a serif title and its line for the four unavailable kinds — `missing-file` (_This film’s file is missing_), `cannot-play` (_This film can’t be played_), `could-not-start` (_This film could not be started_) and `unreachable`, a Linked video whose Library folder does not read: **Can’t reach this film’s folder** — _It plays from one of your library folders, which can’t be reached right now — most likely a drive that isn’t plugged in._ The words are `FamilyFlix.dc.html`'s `noticeCopy`. No notice carries a way out; the chrome holds Back on screen while one shows |
| **ImportFlow**     | `features/import-export/ImportFlow` | TextField, ImportModeChoice, Button, ProgressBar, LogConsole, ProblemRow ×n, PillTabs, Accordion ×n                                                  | setup: the _Spreadsheet_ field, then the group **Library folders** in place of a root field. The run reads every listed folder. Each folder is a row with its path in mono and _N titles_, or _Can't be reached right now_ in `danger`. There is no ✕ and no `FolderRow`, because setup is not where the list is edited. _Manage folders_ (`ghost`, `sm`) sits at the label row's end. With none listed, a dashed box holds _No library folders yet._ and _Add library folders_ (`secondary`), and _Start import_ is `disabled`. Both buttons push `/settings/folders`. The route's `folders` refusal is one 13px `danger` line under the group. The group is blank until the list lands. Then _What the scanner accepts_, the **Import mode** (`ImportModeChoice`, Link chosen), the TMDB box and _Start import_. Review: the two tiles over _Needs attention_, then the **Kind filter** — `PillTabs`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |

labelled _Problem kinds_, _All N_ then one pill per kind held with its count, in the
glossary's order and words: _No folder_, _Ambiguous_, _No video_, _Not in sheet_, _Failed_,
_Unplaced_, _Missing details_, _Differs_ — drawn only with two kinds or more, in a
sideways-scrolling wrapper, screen state and never in the URL; a chosen kind that empties
falls back to _All_. A chosen kind draws its **Bulk actions** at the row's end, wrapping
under the track when it is full: _Skip all_ (the row's Skip) for every kind; _Import all as
guessed_ (`secondary`, `sm`) before it for `no-row`; for `differs`, _Keep all mine_
(`secondary`, `sm`) in its place, the row's own word for the same Dismiss. No confirm. Then
the **Review groups**, 10px apart: a title with one Problem is its bare `ProblemRow`, exactly
as before; two or more are one `Accordion` — the title, each kind's dot, the count, _Skip
all_ (labelled _Skip all for <title>_) as its actions — closed until opened, its rows the
same `ProblemRow`s. Hard kinds' groups come first in the run's order, soft-only groups
(`missing-meta`, `differs`) after them; a group whose last row settles goes. `{ step, sheetPath, foldersLanded, folders: { path, titleCount, reachable }[], foldersRefusal, mode, onMode, progress, matched, problems[], + handlers }` |
| **ExportModal** | `features/import-export/ExportModal` | Modal, ChoiceCard ×2, TextField (mono, folder glyph), Toggle ×2, Button | the **Export dialog**: Format, _Save to_ (mono field, folder glyph, _Browse…_ only when the folder bridge exists, a destination refusal as one 13px `danger` line under it, the typed path kept), _Folder name_ (the heading with `N titles` / `1 title` in accent at its row's right end, absent until the summary lands; a mono field with the folder glyph, prefilled with the **Export name** and never overwritten once edited; a name refusal as one 13px `danger` line under it, the typed name kept), _Include_ (Images on, Subtitles off, each a Toggle row), the sixteen Column pills, _Export as CSV / Excel_ (_Exporting…_ in flight) and _Cancel_; **Export ready** reads _Saved `<folder>` to `<destination>` with N titles._, the count clause dropped with no summary. `{ open, format, onFormat, destination, onDestination, browse, onBrowse, destinationRefused, name, onName, nameRefused, refusal, defaultName, counted, rowLabel, images, onImages, subtitles, onSubtitles, columns[], exportLabel, onExport, done, folderWritten, onClose }` |
| **EnrichmentFlow** | `features/enrichment/EnrichmentFlow` | Chip ×10, Toggle ×2, Button, ProgressBar, LogConsole, PillTabs, SeasonChoices | `{ step: 'setup'                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | 'running' | 'review', needsKey, offline, scope, fields[], writeSheet, writePosters, sheetPath, posterPathExample, percent, log[], matched, pending: PendingRow[], + handlers }` — the TMDB sync surface (see §5a) |
| **LibraryFolders** | `features/import-export/LibraryFolders` | IconButton (Back), FolderRow ×n, TextField (mono, folder glyph), FolderShapes, ImportModeChoice, EnrichCheckCard, Button | the **Library folders page**'s screen: the maintainer header (Back, **Library folders**, the lede) over the group **Folders** — the Folder rows (or _No folders yet._), a divider, the add row (the path field, _Add_, and _Browse…_ only when the folder bridge exists), and a refusal as one 13px `danger` line under it, the typed path kept: the overlap with listed folders first, then the **Media directory refusal** (log 52 Q10) for a folder that is, lies inside or holds the **Managed media directory**, _That folder overlaps where FamilyFlix keeps its own copies. Choose another one._; a refused removal as one 13px `danger` line under its own row. Then the group **Scan**: _What the scanner accepts_, the **Import mode** (Link chosen), the TMDB box and a row of two `lg` presses, `gap: 12px`, wrapping on a narrow window (log 54): **Scan new folders** (`primary`, disabled with no **New folder** listed) walks the New folders in the order added; **Scan all folders** (`secondary`, disabled with none listed) walks every listed folder. Both send the Import mode and the box with `scope: 'new' \| 'all'`, both push `/import`, and both are held while either is in flight; reaching review marks every folder the run read, an unreachable one staying new. The prototype's mono line under the presses stands in for the push to `/import` and is not drawn. Blank under the header until the list lands. `{ landed, onBack, empty, noNew, folders: FolderItem[], typed, onTyped, onAdd, browse, onBrowse, refused, refusal, mode, onMode, enrich, onToggleEnrich, onScanNew, onScanAll }` — each `FolderItem`: `{ key, path, titleCount, reachable, scanned, leftOut, onBringBack, onRemove, removeRefusal }` |
| **CodecManager** | `features/settings/CodecManager` | IconButton (Back), CodecRow ×n, ComponentDropZone | the **Codecs page**'s screen: the maintainer header (Back, **Codecs**, the lede) over two Settings groups — **Playback component** (the Component row when there is one, then the dashed drop zone) and **Formats** (the Codec summary over the codec rows). `{ landed, onBack, component, summaryLabel, codecs: CodecItem[], onBrowse }` — each `CodecItem`: `{ id, name, exts[], size, builtIn, statusLabel, onRemove }` |
| **ResetDialog** | `features/settings/ResetDialog` | Modal, Button ×2 | the **Reset dialog**, opened by the Storage card's _Reset…_: _Erase everything?_ over _This can’t be undone._, the warning triangle in the icon tile; **What goes** — _Every title, with its watch history, ratings and hearts_ · _The library folders list_ · _Every setting, the TMDB key included_ · _Everything in the media folder_ · _An uploaded playback component_ — and **What stays** — _Your library folders and every file in them_ · _Your exports_ · _FamilyFlix itself_ — each a 13px heading over a list; a refusal as one 13px `danger` line above the buttons, held until the next press; _Erase everything_ (`danger`, _Erasing…_ and disabled in flight) then _Cancel_ (`secondary`). Focus lands on the card, so Enter alone erases nothing; no type-to-confirm. `{ open, resetting, eraseLabel, refused, refusal, onErase, onClose }` |
| **SeriesEditMenu** | `features/series/SeriesEditMenu` | CornerMenu, MenuItem ×3 | the **Series edit menu**: `EditMenu`'s ⋯ in the series hero's corner, where the movie page's sits, on `CornerMenu`'s furniture — _✎ Edit details_ (→ `/add?series=<id>`), _⟳ Fetch from TMDB_ (→ `/enrich?series=<id>`), a divider, and the **Danger row** _🗑 Delete series_, which opens `DeleteSeriesDialog`. Opens, closes and takes the keyboard as the movie page's does. The series page alone draws it — never the season page. A feature unit, not a `components/` molecule: it navigates and opens a feature's dialog. `{ seriesId, title, episodeCount, linked }` — `linked` handed on to the dialog |
| **DeleteSeriesDialog** | `features/series/DeleteSeriesDialog` | Modal, GoesAndStays, Button ×2 | the series page's Delete dialog (`page.SeriesPage`), drawing `DeleteTitleDialog`'s body: _Delete “<title>”?_ over _This can’t be undone._, 🗑 in the icon tile; **What goes** / **What stays** as `DeleteTitleDialog` draws them, the same everywhere (log 52 Q4, Q5: a linked show: _Its folder, in your library folder_ kept; a `shared` show: _Its video file(s), which another title plays_); _Delete series_ (`danger`, _Deleting…_ and disabled in flight) then _Cancel_ (`secondary`). No Delete is refused (log 52 Q7). Escape, the scrim, ✕ and _Cancel_ each close it with nothing sent. `{ seriesId, title, episodeCount, linked, open, onClose }` |
| **DeleteMovieDialog** | `features/movie-detail/DeleteMovieDialog` | Modal, GoesAndStays, Button ×2 | the movie page's Delete dialog (`page.MoviePage`), `DeleteSeriesDialog`'s shape worded for a film: **What goes** / **What stays** as `DeleteTitleDialog` draws them, the same everywhere (log 52 Q4, Q5), then _Delete movie_; a `shared` film reads _Its video file(s), which another title plays_ |
| **ManageLibrary** | `features/manage-library/ManageLibrary` | PageHeader, PillTabs, TitleRow ×n, ClearDialog, DeleteTitleDialog | the **Manage library page**'s organism (`page.ManageLibraryPage`): the maintainer header — Back onto Settings, _Manage library_, the lede — then, once the read lands, _Movies N_ / _Series N_ on `PillTabs` (`tab` written as a replace, omitted at movies) beside the summary (_6 movies · 1 without details_), over one **Title row** per title or the empty card (_No movies in your library._). **Blank until it lands**. A clear or a delete that lands closes its dialog with the `success` notice. No props |
| **TitleRow** | `features/manage-library/TitleRow` | Menu ×2, MenuItem ×4, MenuDivider, IconButton | one **Title row** on the Folder row's furniture: the accent tile, the title and its year, the path in mono, _Linked_ / _Copied_, the files, the **Details state**'s dot, and _Can’t be reached right now_ in danger for an unreachable title. _Edit ▾_: _Edit details_ (the Movie form's edit) and _Sync with TMDB_ (the title's page, then its Sync **Started on arrival**), each with its hint; ⋯: _Clear details_ (disabled at `none`), a divider, _Delete…_ as the **Danger row**. `{ title, onClear, onDelete }` |
| **ClearDialog** | `features/manage-library/ClearDialog` | Modal, GoesAndStays, Button ×2 | the **Clear dialog** (log 47 Q13), the Reset dialog's shape: the accent tile, _Clear details?_ and its sentence, the path in the mono well, **What goes** / **What stays**, _Clear details_ (_Clearing…_ in flight) before _Cancel_. `{ title, clearing, onConfirm, onClose }` |
| **DeleteTitleDialog** | `features/manage-library/DeleteTitleDialog` | Modal, GoesAndStays, Button ×2 | the **Delete dialog** (log 47 Q12), the same everywhere, shell or browser (log 52 Q4, Q5): _Delete “Coco”?_ over _This takes the movie out of FamilyFlix. It can’t be undone from here._, the path well, **What goes** / **What stays** by the title's **Linked files** (FamilyFlix's copy goes for a copied title, whose original stays: _Your original in its library folder, Scan all folders would bring it back_; an unreachable title's files stay). A linked title's files always stay: _Its folder, in your library folder_ (or _Its video file(s), in your library folder_) under **What stays**. When the Linked files are `shared` (every video another title's), **What stays** reads _Its video file(s), which another title plays_. Then _Delete movie_ / _Delete series_ (`danger`, _Deleting…_ in flight) before _Cancel_, never _Delete folder_. No Delete is refused (log 52 Q7). `{ title, deleting, onConfirm, onClose }` |
| **GoesAndStays** | `features/manage-library/GoesAndStays` | — | **What goes** beside **What stays**, two even columns: each 12px uppercase tracked heading (What goes in `--color-danger`, What stays in `--color-text-faint`) over its list, each line led by ✕ in danger or ✓ in success. Both dialogs draw it. `{ goes, stays }` |
| **Found-file choice** | `features/movie-form/FoundFileChoice` | radio rows, the dashed picker | a film Resolve whose folder holds two or more videos draws, in place of the Video FileField, the _Video_ label beside a `radiogroup`: one 42px row per video by name (the radio dot, the name in mono), the first preselected, the chosen one in `accent-soft` with the `accent-line` border; under them the dashed _Choose video file_, the slot's own label, whose pick joins the group as its last row, chosen. One video or none: the FileField, as before. Drawn by `MovieFormFiles` in the video slot's place, handed one **Found file** slot per video: it parses no path. `{ videos: MovieFormFile[], video, onChoose(video), onPick }` |
| **ProblemRow** | `features/import-export/ProblemRow` | Button ×2, the face slot: mol.FieldDiff / FolderPicker / Button | one **Problem** of the import's **Review step**, in the Sync `DecisionRow`'s layout. The head is a 10px dot by kind: `danger` for `no-folder`, `no-video`, `unplaced` and `failed`, `accent` for `ambiguous`, the Sync's conflict gold `#c9a86a` for `differs`, faint for `no-row` and `missing-meta`. Then the title, the reason under it, _Resolve_ on every kind but `differs`, and _Skip_ on every kind. **The face slot** sits under the head and is chosen by kind. `differs` draws `mol.FieldDiff` as _Yours \| Spreadsheet_, the sheet chosen by default, _Apply choices_ and _Keep all mine_ (Dismiss); its reason is _The spreadsheet has different values for fields you already filled in._ `ambiguous` draws the `FolderPicker`. `no-row` draws _Import as “Ironwood (2018)”_ (`secondary`, `sm`), the folder imported under the name a Folder scan would give it. Every other kind has no face. A show's `failed` row is folded (log 42 Q11): one row titled with the show, its reason the count and the first error — _3 episodes couldn't be copied: no space left on device._ — its _Resolve_ the **Series Resolve** when the series is held, else the form. Drawn in `mol.ProblemRow.dc.html`, the `FolderRow` precedent — a `mol.` file for a feature-local unit — so a bare row and a grouped one share one template. `{ problem: ImportProblem, onSkip, onApply(choices), onPick(folder), onImportAs }` |
| **FolderPicker** | `features/import-export/FolderPicker` | buttons ×n | an `ambiguous` row's **Folder picker**. It takes `CandidatePicker`'s shape, a horizontally scrolling `group` of cards under the head, but has its own pixels: no poster and no _% match_. Each **Candidate folder** is a 220px card on `--color-surface-2` with the `--color-border-soft` hairline, its border `--color-accent-line` on hover. The card holds the 32px accent folder tile, then the folder's name (13px 600), its path in mono (12px faint) and its video count as a faint pill (_1 video_ / _N videos_). A press imports the row from that folder. A folder with no video or several turns the row into that folder's `no-video` Problem, redrawn in place, whose _Resolve_ is the **Found-file choice**. It is feature-local, not a shared molecule, because a folder is not a TMDB Candidate (log 23 Q40). `{ candidates: CandidateFolder[], onPick(folder) }` |

### The Movie form's two kinds

On a plain add the header row carries the **Kind tabs** — PillTabs labelled _Kind_, _Movie_ /
_Series_, after the heading and pushed to the row's end. Beside an edit or a Resolve there
are no tabs: a film edit or a film Resolve is the movie's form, the **Series edit job** and
the **Series Resolve** the series'. The series kind reads _Add a series_, its lede
_Pick the poster and every episode's video and subtitles for this series._, the placeholders
_Series title_, _2019–2023_ and _A short synopsis of the series_, and _Created by_ /
_Creator name_ for the credit; its Files card holds the Poster slot, the _Season posters_
list, the _Episodes_ label beside one EpisodeFileRow per episode file, and _＋ Add episode
files_ under them — no video slot of its own and no backdrop. **Season posters** (log 42
Q21): a 13px faint caption over one `FileField` per Season the episode rows hold, in season
order, labelled `S01`, `S02`… — a held poster its stored name (`S01-poster.jpg`), a picked
one its file's, an empty slot the dashed _Choose poster for season 3_; ✕ takes one away on
save. Drawn once a row holds a season, on the add and the Series edit job alike. The shared fields are one record both kinds draw, and each
kind's files are held side by side, so a switch either way loses nothing.

The series Files card is `SeriesFormFiles` (`features/movie-form/SeriesFormFiles`). Beside
its poster, Season poster, episode and still props it takes the **Show folder pick**'s four,
all required: `onAddShowFolder` (`null` draws no _＋ Add show folder_ — a browser, or beside
a plain add), `showFolder` (the picked folder, absolute; `null` draws no Show folder row; the
row is `FileField` with `truncateStart`, ellipsised from the start so the folder's own name
always shows, the full path its `title`),
`onRemoveShowFolder` (the row's ✕) and `straySubtitles` (counted in one line under the
episodes, nothing at zero).

**The Series edit job** (`/add?series=<id>`, the ⋯ menu's _Edit details_): heading _Edit
details_, the shared fields prefilled from the series, the Poster slot holding its poster,
and one EpisodeFileRow per held episode in season then episode order — its numbers, title,
subtitles and ✕, the mono line its **Source file** when the library knows one, else its
stored video's name. A ✕ removes the episode on save; _＋ Add episode files_ appends picked
rows. _Save changes_ and _Cancel_; both land on the series page.

**The Series Resolve** (`/add?kind=series&problem=<id>`, an `unplaced` row's _Resolve_): the
_Resolving import_ banner over the series form, one EpisodeFileRow per found video with its
path as the mono line and its numbers prefilled by the **Numbering guess**, every number
editable. _Save & continue_ and _Skip this one_, as the film Resolve's.

**The gate rule.** Save's enabled state is the kind's gate and nothing else — a closed Save
is a disabled button, never a message:

- **Movie** — a title and a video.
- **Series** — a title and complete episodes: at least one EpisodeFileRow, every row's
  season and episode number at least 1, and no (season, number) pair twice.

Domain model — `PosterCardMovie` and the form/import/player models — should be promoted to
`src/types/`. The canonical movie record (id, title, year, genres[], runtime, rating,
director, cast[], watchState, resumePosition, files{video,poster,subtitles[]}) is the
SQLite row; the prototype's `view(movie)` mapper is the reference for what each component
needs.

---

## 5aa. Series (TV) — new in this revision

Series are a **separate top-level tab**, not mixed into the movie rows. Everything below is
additive; the movie flow is untouched.

**Screens**
| Surface | File | Notes |
| --- | --- | --- |
| Library → Series tab | `page.LibraryPage` | segmented Movies/Series control in the header; Series tab = episode Continue Watching row + an "All series" grid (reuses `LibraryGrid` + `PosterCard`) |
| Series detail | `page.SeriesPage` | same hero shape as MoviePage (poster, year range, season/episode count, rating, genres, synopsis, creator/cast) + a **Seasons** grid of `SeasonCard` |
| Season episodes | `page.SeasonPage` | header (series → season), _Resume Enn_, "Mark season watched", the `EpisodeRow` list, and an "Other seasons" pill row |
| Player | `feat.PlayerControls` | unchanged for movies; for episodes the title reads `Show · S02E04 · Episode title` and an **Up next** card appears in the last 15s |

**Decisions** (settled with the user): separate tabs · season posters → its own episode page
(not tabs or an accordion) · episode row shows thumbnail, number+title, air date, watched
check, resume bar (no synopsis, no runtime, no filename) · Continue Watching holds **episode**
cards, not one card per series · the only player addition is **auto-play next with a
countdown** (Play now / Cancel) — no skip-intro, no in-player episode list.

**On-disk shapes the importer accepts** (shown verbatim in the Import setup):

```
Movie Title (2019)/ movie.mkv · subs.en.srt
Show Name/ Season 01/ S01E03.mkv
Show Name/ S01E03.mkv          ← loose episodes at the show root are fine
```

Season/episode numbers come from the **folder first**, then the filename (`S01E03`, `1x03`).
Anything unparsed lands in the existing import review list.

**Data notes for implementers:** the prototype models episodes as
`{ key: '<seriesId>-<season>-<episode>', season, number, title, airDate, runtime, watched,
progress, g1, g2 }` with watch state in one flat `epState` map keyed by that string — in SQLite
this is a `series`, `season`, `episode` trio plus the same `watch_state` columns the movie
table already has. `nextEpisodeOf(seriesId)` (resume the part-watched one, else the first
unwatched) is the reference for both the series **Resume** button and Continue Watching.

---

## 5a. Enrichment (TMDB) — `src/features/enrichment/`

**New in this revision.** The first and only feature that touches the network; everything
else stays offline-first. Three surfaces, one flow component.

**Entry points**

1. **Settings → Network → "Sync metadata & posters"** — the primary route. The Network
   section also owns the API-key field and _Test connection_.
2. **Import setup → "Also fetch metadata and posters from TMDB"** checkbox — opt-in; on
   _Finish_ the import review hands straight off to a full-library run.
3. **Movie or series detail → ⋯ menu → "Fetch from TMDB"** — single-title run (`scope: 'single'`),
   returns to that title when done (_Back to the movie_ / _Back to the series_).

**Three steps** (`setup` → `running` → `review`), mirroring ImportFlow so the two read
as siblings:

- **setup** — key/offline banners, scope radio cards (_Only what's missing_ | _Everything_ |
  _Just this movie_, or _Just this series_ from a series), the field chips, and the write-target list. Start is `secondary` +
  inert until `tmdbConnected && online`. Arriving from a run (log 54), _Finish_ on a run
  carrying `enrich` pushes `/enrich?added=<run.startedAt>` and a third card is drawn beside the
  library's two, chosen: **Just what was added**, _3 titles this run brought in_, in the same
  `scopeCard` / `scopeDot` styles. It is drawn only with `?added=`; "added" means every title
  created since the run started plus a held series that took new episodes, its fields planned
  as _Everything_'s.
- **running** — determinate ProgressBar (count is known up front, unlike the import scan),
  LogConsole, elapsed/ETA, _Stop_ (keeps what was already fetched).
- **review** — two stat tiles + a list of rows that need a human. Three row kinds:
  `ambiguous` (horizontal poster-picker of candidates + % match + "Search by title"),
  `conflict` (`mol.FieldDiff` as **Yours | TMDB**, the field-by-field two-column diff, per-field selection, then
  _Apply choices_ / _Keep all mine_), `missing` (manual TMDB search box). Every row has _Skip_.
  The search box, a `missing` row's and the one _Search by title_ opens, carries the 13px
  faint caption _Try another title. The one you pick becomes its title._ — the **Title fix**:
  a pick from a `missing` or `ambiguous` row makes the candidate's title the title's own. A
  series' row reads exactly like a film's. Above the rows, the **Kind filter** as the
  Import review's — `PillTabs` labelled _Decision kinds_, _All N_, _Ambiguous_, _Missing_,
  _Conflict_, drawn with two kinds or more — and _Skip all_ (`ghost`) at its end while a
  kind is chosen. Filtered, never grouped: a Sync raises one Decision per title.
- **Seasons** — `SeasonChoices` (`features/enrichment/SeasonChoices/`), a single-series run
  only, under the tiles and above _All done_ and the rows, so it is drawn on _All done_ too.
  The Group heading _Seasons_, then one card per **Season choice**, 12px apart, each a
  horizontally scrolling `group` labelled _Posters for S02_: the 112px 2:3 tile with `S02`
  (serif 24px 700, white, shadowed) over its held Season poster, else the series' gradient,
  captioned _Current poster_ or _No poster yet_; a 1px `--color-border-soft` rule; then up to
  ten choices — the season's own, then the series' — each `CandidatePicker`'s 132px card with
  no title, meta or score, the series' marked with the faint pill _Series poster_. A choice
  is an `aria-pressed` button named _Poster 2 for S02_ / _Series poster 5 for S02_, its border
  `--color-accent-line` on hover and while it is the season's pick, the 3px focus ring on
  keyboard focus. A press stores that image as the season's poster, replacing the held one —
  no snackbar, no confirm. `{ seasons: SeasonChoice[], onChoose(season, path) }`

**Decisions this encodes** (settled with the user before design):

| Question       | Decision                                                                                                                                                                                |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Where it lives | Settings row + own screen; Import checkbox; per-movie action                                                                                                                            |
| Storage        | Library DB is the source of truth **and** a `familyflix-metadata.csv` in the collection root + `poster.jpg` in each movie folder — both toggleable, neither overwrites an existing file |
| Fields         | Synopsis, Poster, Backdrop, Runtime, Year, Genres, Director, Cast, Original title, TMDB score                                                                                           |
| Rating         | **Untouched.** TMDB's score is a _separate_ field beside the household rating                                                                                                           |
| Conflicts      | Ask per movie in the review step — never a silent overwrite                                                                                                                             |
| Matching       | Post-run review with a poster picker; no mid-run interruption                                                                                                                           |
| API key        | Settings → **Network**: key field + _Test connection_; enrichment sits under it                                                                                                         |
| Offline        | Explicit banner + Retry; the rest of the app is unaffected                                                                                                                              |

**Server-side note for the implementers:** the run is a pass over the _already-imported_
library keyed by title + year — not a second filesystem scanner. The existing
`walkLibraryFolder`/`scanMovieFolder` path is untouched; the `tmdb_id` column finally gets
a value. Poster/CSV writes are the only place the app writes back into the source folders,
so they need their own permission check and a dry-run log line.

---

## 5b. Welcome splash → `src/App/` (log 55)

From the frozen `handoff-welcome-splash/`, option **2a** (_Bounce, sweep, handoff_), its
alternatives 1a to 1f for reference only. The renderer's cold-start animation, played once
per window session on a **Cold start**, after the shell's **Start-up splash**: the Fs drop
in, _FamilyFlix_ rises letter by letter, a light sweeps both, and the wordmark glides into
the header. No sound, no route, no server change.

| Unit              | Target                     | Role                                                                                                                                                                                                              |
| ----------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `WelcomeProvider` | `src/App/WelcomeProvider/` | Decides whether the welcome plays, owns the phase and its timers, wraps `<Routes>` in the **Home layer**, listens for a skip, leaves focus where it is at the end; mounted in `App` inside `SnackbarProvider`     |
| `WelcomeSplash`   | `src/App/WelcomeSplash/`   | Draws the layers: `bg`, the FF mark (`MARK_F1`, `MARK_F2`, `MARK_VIEWBOX` of `src/tokens/brand.ts`) and the wordmark's ten letters; `role="status"`, `aria-label="Opening FamilyFlix"`, every layer `aria-hidden` |
| `useWelcome`      | `src/App/useWelcome/`      | Answers `{ wordmarkRef, wordmarkHidden }` to `MainLayout`'s `LogoMark`; outside a provider, a no-op ref and `false`                                                                                               |
| `welcomeStep`     | `src/App/welcomeStep/`     | The pure step over `{ phase, ready, skipped }`, with the events `'introEnded' \| 'ready' \| 'skip' \| 'handoffEnded' \| 'skipEnded'`                                                                              |

**Phases.** A **Welcome phase** is `intro`, `holding`, `handoff`, `skipping` or `done`:

- `intro` (the **Welcome intro**, 1950ms, amended; 900ms under reduced motion) at `introEnded`:
  `handoff` when ready, else `holding`. An early `ready` is recorded without leaving
  `intro`: a home that is ready early never cuts the sequence short.
- `holding` (the **Welcome hold**) at `ready`: `handoff`, or `skipping` if skipped.
- `handoff` (the **Wordmark handoff**, 500ms; 400ms reduced) at `handoffEnded`, and
  `skipping` (150ms) at `skipEnded`: `done`.
- **Ready** is the header wordmark mounted (`wordmarkRef` receiving its element once
  `StartTabGate` has settled), never the rows.

**Curves.** Three new motion tokens in `src/tokens/motion.ts`, beside `easeOut`; no
`cubic-bezier(` outside that file:

| Token       | Value                            | Drives                                  |
| ----------- | -------------------------------- | --------------------------------------- |
| `easeDrop`  | `cubic-bezier(0.3, 0.6, 0.4, 1)` | each F's drop-in (520ms, F2 150ms late) |
| `easeSweep` | `cubic-bezier(0.4, 0, 0.2, 1)`   | the light's sweep over the mark (700ms) |
| `easeGlide` | `cubic-bezier(0.3, 0.7, 0.2, 1)` | the wordmark's glide to the header      |

The letters rise on `easeOut`; the mark, splash and Home layer fade on `easeOut`.

**Geometry.** `scale = min(innerWidth / 480, innerHeight / 270)`, read once at start. The
mark is `132·scale × 80·scale`, centred `26·scale` above the window's centre; the wordmark
is Source Serif 4 700 at `30·scale` px, centred `42·scale` below, _Family_ in `text` and
_Flix_ in `accent`. The handoff lands it on the header's measured `LogoMark`, which stays
`visibility: hidden` while `wordmarkHidden`.

**The Welcome hold.** If the home is not ready when the intro ends, the splash keeps the
intro's last frame with a **Logo loader** at the mark's width (`132·scale`) in the mark's
place, beating, no label, `aria-hidden`; on ready the handoff runs from there, the loader
fading out as the mark would.

**The skip.** Any `pointerdown` or `keydown` on `window`, in the capture phase, while the
welcome is up, is swallowed with `preventDefault` and `stopPropagation`, so skipping never
presses what lies beneath. Ready: the splash goes at once, the Home layer fades in over
150ms, the header wordmark is shown, then `done`. Not ready: the **Welcome hold**, ending
the same way on ready. A skip during the handoff finishes it at once.

**Reduced motion.** No drop, blur, sweep or glide: mark and wordmark fade in, hold, and
the splash fades out, 900ms plus 400ms. Hold and skip behave as with full motion.

**Focus.** Never trapped; at `done`, after a full welcome or a skip, focus moves to the
header's logo button. _Amended below: focus stays where it is._

**Amendments.** Departures from the frozen folder, which stays as `e9c9d09c` left it
(`App.welcomeSplashSpec` pins it):

- **The letter sweep copies paint their band once** (`background-repeat: no-repeat`). The
  2a `letters` copies set `backgroundSize: '300% 100%'` and no repeat, so before its run
  a repeating band rests on each glyph's right edge (white over _Flix_, orange over
  _Family_), and after it on its left. The gradient, size and positions are kept.
- **Focus stays where it is at `done`**, the document body as a page load leaves it. The
  header **Wordmark** is no control (issue #509), and the next focusable element is the
  search bar, whose caret (and, on a touch screen, keyboard) no start should raise.
- **The intro lasts 1950ms, not 1750ms.** The last letter's sweep (`1150 + 9·45` for
  380ms) ends at 1935ms, so at 1750 the glide began with the light still on _lix_. The
  sweep's own timing is kept; the intro waits it out.

---

## 6. Layout + Pages → `src/layouts/`, `src/pages/`

> Status: **all screens are extracted as `page.*.dc.html` files and the root template is a
> pure router** — ten `<sc-if>` → `<dc-import>` mounts, with the logic class as the sole
> state container. Each page receives one typed model object built in `renderVals()`.

| Page (prototype file)       | Target                     | Composition                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| --------------------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `page.LibraryPage` ✅       | `pages/LibraryPage`        | browse header (SearchBar + FilterDropdown ×3 + gear → Settings) + ContinueCard row + Favorites row + `GenreRow` ×n + the Other row (`GenreRow`, _Other movies_) last                                                                                                                                                                                                                                                                                                                                                                                                 |
| `page.GenrePage` ✅         | `pages/GenrePage`          | genre header (SearchBar + Sort FilterDropdown) + `LibraryGrid`; an `other` mode at `/genre-less`, headed _Other movies_, lists every film with no genre                                                                                                                                                                                                                                                                                                                                                                                                              |
| `page.MoviePage` ✅         | `pages/MoviePage`          | backdrop + poster + meta (StarRating, Chip tags, director/cast) + actions; the Danger row's **DeleteMovieDialog** (log 52 Q4)                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `page.SettingsPage` ✅      | `pages/SettingsPage`       | grouped settings hub: **Library** (Add / 📁 Library folders → `/settings/folders` / Import / Export actions) · **Playback** (the **Codecs row** → `/settings/codecs`, its line the Codec summary + default-subtitle FilterDropdown) · **Display** (the _Ultrawide margins_ Toggle, then the _Start on_ row: `mol.PillTabs` _Movies_ / _Series_ choosing the **Start tab**, no snackbar) · **Network** · **Storage** (media folder, _Open folder_, space, then a divider and the _Factory reset_ row, whose `danger` _Reset…_ opens the **Reset dialog**) · **About** |
| `page.CodecsPage` ✅        | `pages/CodecsPage`         | the maintainer sheet at 780 around `feat.CodecManager`; reached from the Codecs row, Back to Settings                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `page.LibraryFoldersPage`   | `pages/LibraryFoldersPage` | `/settings/folders`: the maintainer sheet at 780 around `LibraryFolders`; reached from the Library group's _Library folders_ row, its Landing `/settings`                                                                                                                                                                                                                                                                                                                                                                                                            |
| `page.ManageLibraryPage` ✅ | `pages/ManageLibraryPage`  | `/settings/library`: the maintainer sheet around `ManageLibrary`; reached from the Library group's _Manage library_ row, its Landing `/settings`; its **DeleteTitleDialog**'s _What stays_ reads _Its video file(s), which another title plays_ for a `shared` title (log 51 Q8, log 52 Q4)                                                                                                                                                                                                                                                                          |
| `feat.PlayerControls` ✅    | `pages/PlayerPage`         | full player surface + subtitle overlay (player is one self-contained screen)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `feat.MovieForm` ✅         | `pages/AddMoviePage`       | the Add/Edit form (also resolves an import row)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `feat.ImportFlow` ✅        | `pages/ImportPage`         | the import setup → running → review flow; every Needs attention row draws _Resolve_ and _Skip_ — an `unplaced` row is one per show, titled with the show, its reason the count (_24 episodes need numbers_), its _Resolve_ the Series Resolve; a two-video film folder reads _Two videos. Pick the film._                                                                                                                                                                                                                                                            |
| `feat.EnrichmentFlow` ✅    | `pages/EnrichmentPage`     | TMDB sync setup → running → review (see §5a)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `page.SeriesPage` ✅        | `pages/SeriesPage`         | series hero + Seasons grid (see §5aa); the **Series edit menu** (⋯) in the hero's corner and its **DeleteSeriesDialog**, with the `shared` wording (log 51 Q8, log 52 Q4)                                                                                                                                                                                                                                                                                                                                                                                            |
| `page.SeasonPage` ✅        | `pages/SeasonPage`         | episode list for one season                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

**The folder bridge.** _Browse…_ on the Library folders page is drawn only when the
desktop shell exposes `window.familyflix.folders` through its preload — Electron's native
folder dialog, the one thing that can hand the renderer a real path. In a browser the
bridge is absent and the page is the typed field alone. The bridge has a second member, `pickOne(): Promise<string | null>` on
`FOLDER_CHANNELS.pickOne` (`'familyflix:folders:pick-one'`): one folder or `null` for a
cancel, behind the Export dialog's _Browse…_ — named for what it does, since the bridge is
generic; `pick()` is unchanged. `feat.ImportFlow` reads the run's
source for its heading and lede only: _Scan library folders_ / _Finding new movies and
series in your library folders._ for a folder scan, the existing copy for a sheet. With
several library folders, `feat.EnrichmentFlow`'s write-target lines read
_familyflix-metadata.csv in each library folder_ and _`<movie folder>`\poster.jpg in each
library folder_; with one, its two paths as before.

The gear icon now opens **`page.SettingsPage`** (a full route), not a dropdown — the old
maintenance menu's actions (Add / Import / Export) are the Library section there, so tasks
and configuration share one home and the menu scales as settings grow. The browse and genre
headers differ, so each page owns its header rather than sharing a `MainLayout` chrome; in
code, factor the shared bits (the **Wordmark**, never pressable; the gear button) into `layouts/`
as desired. The Export
dialog (`feat.ExportModal`) renders as an overlay above the current route.

### Content frame (Ultrawide margins)

The household's **Ultrawide margins** (Settings → Display) caps every screen but the
player at the **Content measure**, 1920px, centred — `max-width` plus auto side margins,
no media query, since below the measure the cap is already inert. The page's `bg` shows
through the margins, with no border or shade, and nothing transitions. Off, or before the
setting has been read, the frame is a full-width box that changes nothing.

- **What it caps:** every route — the library, genre, movie, series and season pages, the
  Movie form, Import, Enrichment, Settings and the Codecs page. In code it is one layout
  route in `App` (`ContentFrame` around an `<Outlet />`), so no layout or page knows it exists.
- **Outside it:** the player, `/movie/:id/play` and `/episode/:id/play` — a film fills the
  window whatever the setting says.
- **Overlays:** the Modal's scrim still covers the window, and its card is centred on the
  window, which is the frame's centre. The Back-to-top FAB rides the frame, being absolute
  inside the chrome. The **Snackbar stack** sits at the frame's bottom-right corner on a
  window wider than the measure — `right: max(s5, (100vw − 1920px) / 2 + s5)` — and at the
  window's corner on a narrower one; `bottom` is unchanged.

Routing: `react-router-dom` v6. The prototype's `screen` state enumerates the routes
(`/`, `/genre/:name`, `/genre-less`, `/movie/:id`, `/movie/:id/play`, `/add`, `/import`, `/settings`,
`/settings/codecs`). The Export
dialog is an overlay rendered above the current route.

---

## 7. Build order (suggested)

1. `tokens/` + `ThemeProvider` + global reset.
2. `primitives/` (8) with tests — pure render + variant snapshots.
3. `components/` (8) — compose primitives; test interaction callbacks.
4. `types/` — movie record + view models.
5. `features/` — wire molecules to feature hooks (data from the Express/SQLite layer).
6. `layouts/` + `pages/` — route composition.
7. Container/store wiring; then the server (`library`, `media`, `import-export`, `db`).

Each component's prototype file is the visual + behavioral reference; match spacing,
radii, interaction states (§2a), and copy exactly.
