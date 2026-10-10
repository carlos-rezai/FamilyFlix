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
| `onClick` | () => void | — | |

States: hover (background lightens per variant), press (darkens + `scale(.98)`),
focus-visible (accent ring), disabled (muted fill, no state changes). **No hover lift or
shadow** — see §2a. Primary hover/press come from `--color-accent-hover` / `-press`.

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
| `MoreIcon` (3-dot)                 | fill          | MoviePage edit/delete menu                                        |
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
Props: `season { number, label?, episodeCount, watchedCount, g1, g2 }`, `onOpen`.
Sub-label switches between "8 episodes" and "3 of 8 watched".

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
Props: `label`, `filename`, `chooseLabel`, `icon` (`'video'|'poster'|'file'`), `onPick`, `onRemove`.

### PillTabs — `mol.PillTabs.dc.html`

Target: `components/PillTabs/` · the pill track: two or more `aria-pressed` buttons in a
labelled `group` — the surface fill, the soft border, pill corners, 4px in and between;
each tab 38px tall, 20px either side, the sans at 15px; the pressed one the accent in the
near-black ink at 700, the rest transparent in the faint ink at 500. A **Control** (§2a).
Extracted from `page.LibraryPage`'s Movies / Series track, which now imports it; the
**Movie form**'s **Kind tabs** are its second use. Presentational — no URL: the caller
decides what a press writes.
Props: `label`, `options: { value, label }[]`, `value`, `onChange(value)`.

### EpisodeFileRow — `mol.EpisodeFileRow.dc.html`

Target: `components/EpisodeFileRow/` · one episode file on the series Files card, in the
FileField's filled-row furniture: an `S` number field (digits, at most 2), an `E` number
field (digits, at most 3), the episode title field (placeholder _Untitled episode_) and the
✕; under them the filename in mono, then a children slot for the row's SubtitleRows and its
_＋ Add subtitle_ picker. Presentational, like SubtitleRow.
Props: `filename`, `season`, `number`, `title`, `onSeasonChange(season)`,
`onNumberChange(number)`, `onTitleChange(title)`, `onRemove`, `children`.

### FolderRow — `mol.FolderRow.dc.html`

Target: `features/import-export/FolderRow/` · one **Library folder** on the Library folders
page, in CodecRow's shape: the 40px accent tile with the folder glyph, the path in mono, then
the line — _N titles_, or _Can't be reached right now_ in `danger` for an **Unreachable**
folder — and last the ✕ (`RemoveButton`, labelled _Remove `<path>`_). Feature-local rather
than a `components/` molecule: one caller, and it draws a domain record. Presentational: the
press is handed back.
Props: `folder { path, titleCount, reachable }` (a `LibraryFolder`), `onRemove`.

### DetailBackdrop — drawn inline in `page.MoviePage` and `page.SeriesPage`

Target: `components/DetailBackdrop/` · the **Detail backdrop**, the one art layer both detail
pages draw. No `mol.*` file of its own (`CreditsRow`'s precedent): both page prototypes draw
it inline, identically. The root is `aria-hidden`, `position: sticky; top: 0; height: 100vh;
margin-bottom: -100vh` — pinned to the top of the page's scroller while the content scrolls
over it; the `100vh` is coupled to the scroller's own height. Inside, the backdrop over its
**Gradient fallback**, then the **Backdrop veil**: a 180° gradient — `rgba(20,17,13,.65)` 0%,
`.85` 50%, `--color-bg` 100% — over `--color-accent-soft`. No motion, no blur.
Props: `url` (string | null), `g1`, `g2`.

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

| Feature            | Target                                  | Composes                                                                                                          | Model (props)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------ | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **LibraryHeader**  | `features/library/LibraryHeader`        | SearchBar, FilterDropdown ×3, IconButton (gear menu)                                                              | `{ search, onSearch, genre/sort/rating filter models, onAdd, onImport, onExport }`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **CardCarousel**   | `features/library/CardCarousel`         | PosterCard / ContinueCard                                                                                         | `{ items, variant: 'poster' \| 'continue' }` — horizontal scroller with **paged left/right arrow buttons**. Arrows auto-hide at the start/end and when the row doesn't overflow; mouse/trackpad scroll still works. Rows are capped (15 cards) by the container, with "View all" → GenrePage for the full set. Used by GenreRow, Favorites, and Continue rows.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **GenreRow**       | `features/library/GenreRow`             | CardCarousel (poster)                                                                                             | `{ name, count, movies: PosterCardMovie[] (≤15), onOpenAll, onOpenMovie, onToggleFav }` — title + "View all {count}" header above a CardCarousel                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **LibraryGrid**    | `features/library/LibraryGrid`          | PosterCard                                                                                                        | `{ movies, onOpenMovie, onToggleFav }` (genre page grid, full set)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **MovieForm**      | `features/movie-form/MovieForm`         | PillTabs (Kind), TextField, Textarea, Chip, RatingPicker, FileField ×2, SubtitleRow ×n, EpisodeFileRow ×n, Button | `{ kind, showKindTabs, title, year, director, cast, description, genres[], rating, video, poster, subtitles[], episodes[], canSave, + onChange handlers, onSave, onCancel }` — see _The Movie form's two kinds_ below                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| **PlayerControls** | `features/player/PlayerControls`        | ProgressBar (scrubber), IconButton                                                                                | `{ playing, currentTime, duration, volume, muted, subsOn, controlsVisible, + handlers }`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **ImportFlow**     | `features/import-export/ImportFlow`     | TextField, Button, ProgressBar                                                                                    | `{ step, sheetPath, rootPath, progress, matched, problems[], + handlers }`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **ExportModal**    | `features/import-export/ExportModal`    | Modal, FormatCard ×2, TextField (mono, folder glyph), Toggle ×2, Button                                           | the **Export dialog**: Format, _Save to_ (mono field, folder glyph, _Browse…_ only when the folder bridge exists, a destination refusal as one 13px `danger` line under it, the typed path kept), _Folder name_ (the heading with `N titles` / `1 title` in accent at its row's right end, absent until the summary lands; a mono field with the folder glyph, prefilled with the **Export name** and never overwritten once edited; a name refusal as one 13px `danger` line under it, the typed name kept), _Include_ (Images on, Subtitles off, each a Toggle row), the sixteen Column pills, _Export as CSV / Excel_ (_Exporting…_ in flight) and _Cancel_; **Export ready** reads _Saved `<folder>` to `<destination>` with N titles._, the count clause dropped with no summary. `{ open, format, onFormat, destination, onDestination, browse, onBrowse, destinationRefused, name, onName, nameRefused, refusal, defaultName, counted, rowLabel, images, onImages, subtitles, onSubtitles, columns[], exportLabel, onExport, done, folderWritten, onClose }` |
| **EnrichmentFlow** | `features/enrichment/EnrichmentFlow`    | Chip ×10, Toggle ×2, Button, ProgressBar, LogConsole                                                              | `{ step: 'setup'                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | 'running' | 'review', needsKey, offline, scope, fields[], writeSheet, writePosters, sheetPath, posterPathExample, percent, log[], matched, pending: PendingRow[], + handlers }` — the TMDB sync surface (see §5a) |
| **LibraryFolders** | `features/import-export/LibraryFolders` | IconButton (Back), FolderRow ×n, TextField (mono, folder glyph), Button                                           | the **Library folders page**'s screen: the maintainer header (Back, **Library folders**, the lede) over the group **Folders** — the Folder rows (or _No folders yet._), a divider, the add row (the path field, _Add_, and _Browse…_ only when the folder bridge exists), and a refusal as one 13px `danger` line under it, the typed path kept. Blank under the header until the list lands. `{ landed, onBack, empty, folders: FolderItem[], typed, onTyped, onAdd, browse, onBrowse, refused, refusal }` — each `FolderItem`: `{ key, path, titleCount, reachable, onRemove }`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **CodecManager**   | `features/settings/CodecManager`        | IconButton (Back), CodecRow ×n, ComponentDropZone                                                                 | the **Codecs page**'s screen: the maintainer header (Back, **Codecs**, the lede) over two Settings groups — **Playback component** (the Component row when there is one, then the dashed drop zone) and **Formats** (the Codec summary over the codec rows). `{ landed, onBack, component, summaryLabel, codecs: CodecItem[], onBrowse }` — each `CodecItem`: `{ id, name, exts[], size, builtIn, statusLabel, onRemove }`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

### The Movie form's two kinds

On a plain add the header row carries the **Kind tabs** — PillTabs labelled _Kind_, _Movie_ /
_Series_, after the heading and pushed to the row's end. Beside an edit or a Resolve there
are no tabs, and the form is the movie's. The series kind reads _Add a series_, its lede
_Pick the poster and every episode's video and subtitles for this series._, the placeholders
_Series title_, _2019–2023_ and _A short synopsis of the series_, and _Created by_ /
_Creator name_ for the credit; its Files card holds the Poster slot, the _Episodes_ label
beside one EpisodeFileRow per episode file, and _＋ Add episode files_ under them — no video
slot of its own and no backdrop. The shared fields are one record both kinds draw, and each
kind's files are held side by side, so a switch either way loses nothing.

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
3. **Movie detail → ⋯ menu → "Fetch from TMDB"** — single-title run (`scope: 'single'`),
   returns to the movie when done.

**Three steps** (`setup` → `running` → `review`), mirroring ImportFlow so the two read
as siblings:

- **setup** — key/offline banners, scope radio cards (_Only what's missing_ | _Everything_ |
  _Just this movie_), the field chips, and the write-target list. Start is `secondary` +
  inert until `tmdbConnected && online`.
- **running** — determinate ProgressBar (count is known up front, unlike the import scan),
  LogConsole, elapsed/ETA, _Stop_ (keeps what was already fetched).
- **review** — two stat tiles + a list of rows that need a human. Three row kinds:
  `ambiguous` (horizontal poster-picker of candidates + % match + "Search by title"),
  `conflict` (field-by-field **Yours | TMDB** two-column diff, per-field selection, then
  _Apply choices_ / _Keep all mine_), `missing` (manual TMDB search box). Every row has _Skip_.

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

## 6. Layout + Pages → `src/layouts/`, `src/pages/`

> Status: **all screens are extracted as `page.*.dc.html` files and the root template is a
> pure router** — ten `<sc-if>` → `<dc-import>` mounts, with the logic class as the sole
> state container. Each page receives one typed model object built in `renderVals()`.

| Page (prototype file)     | Target                     | Composition                                                                                                                                                                                                                                                                                                                                      |
| ------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `page.LibraryPage` ✅     | `pages/LibraryPage`        | browse header (SearchBar + FilterDropdown ×3 + gear → Settings) + ContinueCard row + Favorites row + `GenreRow` ×n                                                                                                                                                                                                                               |
| `page.GenrePage` ✅       | `pages/GenrePage`          | genre header (SearchBar + Sort FilterDropdown) + `LibraryGrid`                                                                                                                                                                                                                                                                                   |
| `page.MoviePage` ✅       | `pages/MoviePage`          | backdrop + poster + meta (StarRating, Chip tags, director/cast) + actions                                                                                                                                                                                                                                                                        |
| `page.SettingsPage` ✅    | `pages/SettingsPage`       | grouped settings hub: **Library** (Add / 📁 Library folders → `/settings/folders` / Import / Export actions) · **Playback** (the **Codecs row** → `/settings/codecs`, its line the Codec summary + default-subtitle FilterDropdown) · **Display** (the _Ultrawide margins_ Toggle) · **Network** · **Storage** (media folder, space) · **About** |
| `page.CodecsPage` ✅      | `pages/CodecsPage`         | the maintainer sheet at 780 around `feat.CodecManager`; reached from the Codecs row, Back to Settings                                                                                                                                                                                                                                            |
| `page.LibraryFoldersPage` | `pages/LibraryFoldersPage` | `/settings/folders`: the maintainer sheet at 780 around `LibraryFolders`; reached from the Library group's _Library folders_ row, its Landing `/settings`                                                                                                                                                                                        |
| `feat.PlayerControls` ✅  | `pages/PlayerPage`         | full player surface + subtitle overlay (player is one self-contained screen)                                                                                                                                                                                                                                                                     |
| `feat.MovieForm` ✅       | `pages/AddMoviePage`       | the Add/Edit form (also resolves an import row)                                                                                                                                                                                                                                                                                                  |
| `feat.ImportFlow` ✅      | `pages/ImportPage`         | the import setup → running → review flow                                                                                                                                                                                                                                                                                                         |
| `feat.EnrichmentFlow` ✅  | `pages/EnrichmentPage`     | TMDB sync setup → running → review (see §5a)                                                                                                                                                                                                                                                                                                     |
| `page.SeriesPage` ✅      | `pages/SeriesPage`         | series hero + Seasons grid (see §5aa)                                                                                                                                                                                                                                                                                                            |
| `page.SeasonPage` ✅      | `pages/SeasonPage`         | episode list for one season                                                                                                                                                                                                                                                                                                                      |

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
code, factor the shared bits (logo, gear button) into `layouts/` as desired. The Export
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
(`/`, `/genre/:name`, `/movie/:id`, `/movie/:id/play`, `/add`, `/import`, `/settings`,
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
