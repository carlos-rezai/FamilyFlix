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

| Group      | Prototype vars                                                                                                                                                                                         | Target                 |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------- |
| Color      | `--color-bg`, `--color-bg-2`, `--color-surface`(`-2`,`-3`), `--color-border`(`-soft`), `--color-text`(`-dim`,`-faint`), `--color-accent`(`-hover`,`-soft`,`-line`), `--color-watched`, `--color-scrim` | `tokens/colors.ts`     |
| Typography | `--font-serif` (Source Serif 4), `--font-sans` (Hanken Grotesk), `--font-mono` (JetBrains Mono)                                                                                                        | `tokens/typography.ts` |
| Spacing    | `--space-1..8` → 4/8/12/16/24/32/48/64 px                                                                                                                                                              | `tokens/spacing.ts`    |
| Radius     | `--radius-sm` 8, `--radius-md` 12, `--radius-lg` 18, `--radius-pill` 999                                                                                                                               | `tokens/radius.ts`     |
| Runtime    | `--card-w`, `--poster-radius` (set per-render from props/tweaks)                                                                                                                                       | component props        |

Assemble these into one `theme` object passed to `<ThemeProvider>`. Keep the names — they
already read as a semantic scale.

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

States: hover (variant-specific), disabled.

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
| `movie` | `{ title, g1, g2, rating, watched, progress, favorite }` | `g1/g2` = poster gradient stops (placeholder art; swap for real `posterUrl`) |
| `onOpen` | () => void | navigate to detail |
| `onToggleFav` | () => void | stops propagation internally |

States: hover (lift), watched (badge), in-progress (bottom bar), favorite (filled heart).

### ContinueCard — `mol.ContinueCard.dc.html`

Target: `components/ContinueCard/` · wide 16:10 resume tile.
Props: `movie { title, g1, g2, resumeLabel, progress }`, `onOpen`.

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

---

## 5. Features (organisms) → `src/features/`

> Status: **all 6 features are extracted and wired** as `feat.*.dc.html` files. Each
> receives a single typed model object from the container and composes the molecules above
> (App → feature → molecule → primitive — proven 4 levels deep). The container builds the
> model object in `renderVals()` and mounts the feature via `<dc-import>`.
>
> **Molecule wiring:** all 8 molecules are mounted in the live app — PosterCard (3 grids,
> via GenreRow + LibraryGrid), ContinueCard (resume row), SearchBar + FilterDropdown ×3
> (header), RatingPicker + FileField ×2 + SubtitleRow (inside MovieForm).

| Feature            | Target                               | Composes                                                                      | Model (props)                                                                                                                                                                                                                                                                                                                                                  |
| ------------------ | ------------------------------------ | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **LibraryHeader**  | `features/library/LibraryHeader`     | SearchBar, FilterDropdown ×3, IconButton (gear menu)                          | `{ search, onSearch, genre/sort/rating filter models, onAdd, onImport, onExport }`                                                                                                                                                                                                                                                                             |
| **CardCarousel**   | `features/library/CardCarousel`      | PosterCard / ContinueCard                                                     | `{ items, variant: 'poster' \| 'continue' }` — horizontal scroller with **paged left/right arrow buttons**. Arrows auto-hide at the start/end and when the row doesn't overflow; mouse/trackpad scroll still works. Rows are capped (15 cards) by the container, with "View all" → GenrePage for the full set. Used by GenreRow, Favorites, and Continue rows. |
| **GenreRow**       | `features/library/GenreRow`          | CardCarousel (poster)                                                         | `{ name, count, movies: PosterCardMovie[] (≤15), onOpenAll, onOpenMovie, onToggleFav }` — title + "View all {count}" header above a CardCarousel                                                                                                                                                                                                               |
| **LibraryGrid**    | `features/library/LibraryGrid`       | PosterCard                                                                    | `{ movies, onOpenMovie, onToggleFav }` (genre page grid, full set)                                                                                                                                                                                                                                                                                             |
| **MovieForm**      | `features/movie-form/MovieForm`      | TextField, Textarea, Chip, RatingPicker, FileField ×2, SubtitleRow ×n, Button | `{ title, year, director, cast, description, genres[], rating, video, poster, subtitles[], + onChange handlers, onSave, onCancel }`                                                                                                                                                                                                                            |
| **PlayerControls** | `features/player/PlayerControls`     | ProgressBar (scrubber), IconButton                                            | `{ playing, currentTime, duration, volume, muted, subsOn, controlsVisible, + handlers }`                                                                                                                                                                                                                                                                       |
| **ImportFlow**     | `features/import-export/ImportFlow`  | TextField, Button, ProgressBar                                                | `{ step, sheetPath, rootPath, progress, matched, problems[], + handlers }`                                                                                                                                                                                                                                                                                     |
| **ExportModal**    | `features/import-export/ExportModal` | Modal, Chip/segmented, Button                                                 | `{ open, format, filename, rowCount, columns[], onFormat, onExport, onClose }`                                                                                                                                                                                                                                                                                 |
| **CodecManager**   | `features/settings/CodecManager`     | (list rows + dashed upload zone)                                              | `{ summaryLabel, codecs: CodecItem[], onBrowse }` — each `CodecItem`: `{ id, name, exts[], size, builtIn, statusLabel, onRemove }`                                                                                                                                                                                                                             |

Domain model — `PosterCardMovie` and the form/import/player models — should be promoted to
`src/types/`. The canonical movie record (id, title, year, genres[], runtime, rating,
director, cast[], watchState, resumePosition, files{video,poster,subtitles[]}) is the
SQLite row; the prototype's `view(movie)` mapper is the reference for what each component
needs.

---

## 6. Layout + Pages → `src/layouts/`, `src/pages/`

> Status: **all screens are extracted as `page.*.dc.html` files and the root template is a
> pure router** — seven `<sc-if>` → `<dc-import>` mounts, with the logic class as the sole
> state container. Each page receives one typed model object built in `renderVals()`.

| Page (prototype file)    | Target               | Composition                                                                                                                                                                     |
| ------------------------ | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `page.LibraryPage` ✅    | `pages/LibraryPage`  | browse header (SearchBar + FilterDropdown ×3 + gear → Settings) + ContinueCard row + Favorites row + `GenreRow` ×n                                                              |
| `page.GenrePage` ✅      | `pages/GenrePage`    | genre header (SearchBar + Sort FilterDropdown) + `LibraryGrid`                                                                                                                  |
| `page.MoviePage` ✅      | `pages/MoviePage`    | backdrop + poster + meta (StarRating, Chip tags, director/cast) + actions                                                                                                       |
| `page.SettingsPage` ✅   | `pages/SettingsPage` | grouped settings hub: **Library** (Add/Import/Export actions) · **Playback** (`CodecManager` + default-subtitle FilterDropdown) · **Storage** (media folder, space) · **About** |
| `feat.PlayerControls` ✅ | `pages/PlayerPage`   | full player surface + subtitle overlay (player is one self-contained screen)                                                                                                    |
| `feat.MovieForm` ✅      | `pages/AddMoviePage` | the Add/Edit form (also resolves an import row)                                                                                                                                 |
| `feat.ImportFlow` ✅     | `pages/ImportPage`   | the import setup → running → review flow                                                                                                                                        |

The gear icon now opens **`page.SettingsPage`** (a full route), not a dropdown — the old
maintenance menu's actions (Add / Import / Export) are the Library section there, so tasks
and configuration share one home and the menu scales as settings grow. The browse and genre
headers differ, so each page owns its header rather than sharing a `MainLayout` chrome; in
code, factor the shared bits (logo, gear button) into `layouts/` as desired. The Export
dialog (`feat.ExportModal`) renders as an overlay above the current route.

Routing: `react-router-dom` v6. The prototype's `screen` state enumerates the routes
(`/`, `/genre/:name`, `/movie/:id`, `/movie/:id/play`, `/add`, `/import`). The Export
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
radii, hover states, and copy exactly.
