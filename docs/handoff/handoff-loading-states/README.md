# Loading states — handoff

A loading indicator built from the FF mark, plus a text shimmer for buttons, (`docs/handoff/brand/familyflix-mark.svg`). Use it for **actions the user starts** (save, delete, clear, sync) and for **app start-up**. Page and detail loads keep the existing skeletons.

Prototype: `prototype/Loading States.dc.html` (open in a browser, the demos are clickable). Component source: `prototype/prim.LogoLoader.dc.html`.

## Screenshots

- `screenshots/01-modes.png`: inline, block, determinate
- `screenshots/02-save-button-loading.png`: save button while busy
- `screenshots/03-delete-dialog-loading.png`: delete dialog while busy
- `screenshots/04-app-splash.png`: start-up splash
- `screenshots/05-rules.png`: the rules

## Component: `LogoLoader`

Suggested location: `src/primitives/LogoLoader/` (`LogoLoader.tsx`, `LogoLoader.styles.ts`, `index.ts`).

The mark is drawn from the two F paths in `familyflix-mark.svg`. F1 is filled `text` and F2 is filled `accent`. With `tone="current"`, both use `currentColor`.

| Prop       | Type                   | Default                        | Notes                                                                                                                   |
| ---------- | ---------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| `size`     | `number`               | `48`                           | Width in px. Height is `size × 424/704` (the mark's bounds) or `size` when `tile` is set                                |
| `progress` | `number?`              | —                              | 0–1. When set, the mark fills from left to right (determinate). When left out, the Fs take turns rising (indeterminate) |
| `tone`     | `'brand' \| 'current'` | `'brand'`                      | Use `current` inside buttons so the mark takes the button's ink                                                         |
| `tile`     | `boolean`              | `false`                        | Draws the app-icon tile behind the mark (`bg`, radius 22% of the tile). Splash only                                     |
| `label`    | `string?`              | —                              | 15/600 `text`, shown under the mark                                                                                     |
| `detail`   | `string?`              | `"NN%"` when `progress` is set | 13 `textFaint`, tabular numbers. Use for the step name or "12 of 40"                                                    |
| `inline`   | `boolean`              | `false`                        | Puts the mark and text in a row (gap 8) instead of a column (gap 14)                                                    |

### Motion

```css
/* indeterminate — applied to each F path; F2 delayed 0.22s */
@keyframes ffLogoBeat {
  0%,
  64%,
  100% {
    opacity: 0.28;
    transform: translateY(0);
  }
  22% {
    opacity: 1;
    transform: translateY(-7%);
  }
}
/* 1.3s cubic-bezier(.45,0,.25,1) infinite; transform-box: fill-box; transform-origin: 50% 100% */

/* mount */
@keyframes ffLogoIn {
  from {
    opacity: 0;
    transform: scale(0.96);
  }
  to {
    opacity: 1;
    transform: none;
  }
} /* 180ms */

@media (prefers-reduced-motion: reduce) {
  @keyframes ffLogoBeat {
    0%,
    100% {
      opacity: 0.4;
    }
    50% {
      opacity: 1;
    }
  } /* fade only, no movement */
}
```

**Determinate:** both Fs are drawn at 20% opacity, with a full-opacity copy on top clipped by a rect that scales across with `scaleX(progress)`. The fill animates with `transform 280ms cubic-bezier(.2,.7,.3,1)`. Each clip path needs its own id, so generate one per instance (`useId`).

### Accessibility

- Root element: `role="status"` and `aria-live="polite"`. `aria-label` is `label`, plus `detail` when present (defaults to "Loading").
- The visible mark and text are `aria-hidden`, so screen readers don't hear the label twice.
- The container that's busy gets `aria-busy="true"`.

## Sizes

| Use                           | Size  | Props                                    |
| ----------------------------- | ----- | ---------------------------------------- |
| Inside a button               | —     | **No mark.** Use the text shimmer below  |
| Inside a row (Manage library) | 18    | `inline`, plus `label` when there's room |
| Panel or dialog               | 56–64 | `label` + `detail`                       |
| App start-up                  | 88–96 | `tile`, `label="Opening your library"`   |

## Inline: button text shimmer

Buttons don't show the FF mark. The button text changes to the "-ing" form (**Save movie → Saving…**) and a shine sweeps across it.

```css
.busyLabel {
  background-image: linear-gradient(
    90deg,
    rgba(26, 17, 9, 0.5) 0%,
    rgba(26, 17, 9, 0.5) 30%,
    #1a1109 50%,
    rgba(26, 17, 9, 0.5) 70%,
    rgba(26, 17, 9, 0.5) 100%
  );
  background-size: 200% 100%;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  animation: ffTextShimmer 1.4s linear infinite;
}
@keyframes ffTextShimmer {
  from {
    background-position: 100% 0;
  }
  to {
    background-position: -100% 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  @keyframes ffTextShimmer {
    0%,
    100% {
      opacity: 0.6;
    }
    50% {
      opacity: 1;
    }
  }
}
```

- The gradient stops use the button's ink: `#1a1109` on primary/danger. For secondary buttons, swap in `text` and `rgba(text, .5)`.
- Suggested home: `src/primitives/Button`, as a `busy` prop with an optional `busyLabel`. It sets `aria-busy` and `disabled`, keeps the width the button had before, and wraps the label in a span with this style and `aria-live="polite"`.
- The same 300ms / 500ms timing rules apply.

## Where it's used

| #   | Place                                                                                              | Trigger                                        | Treatment                                                                                                                                                                                                                                                                                                                                                                       |
| --- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Movie form** (`MovieForm` save), **Series edit** save, **Settings** saves (Network, Theme, etc.) | Save button                                    | Button text shimmer (no mark). Label changes **Save movie → Saving… → Saved ✓** (Saved shows for 1.4s on a `success` background, then goes back). Cancel and inputs stay visible                                                                                                                                                                                                |
| 2   | **Library folders**: add or save a linked folder                                                   | Save / Add button                              | Same as 1                                                                                                                                                                                                                                                                                                                                                                       |
| 3   | **Manage library → Delete** (`page.ManageLibraryPage`)                                             | "Delete folder" in the confirmation dialog     | The dialog body becomes a 64px loader. Label `Deleting "<title>"`, detail shows the current step: `Removing files from disk` → `Removing details and artwork`. No Cancel. Escape, backdrop clicks and ✕ are blocked. When done, the dialog closes, the row is removed and a danger snackbar shows. If it fails, the dialog stays open and shows the error inside it, with Close |
| 4   | **Manage library → Clear metadata**                                                                | Confirm button                                 | Button text shimmer: **Clear metadata → Clearing…**. Then the dialog closes, the row flips to the No-metadata state and an info snackbar shows                                                                                                                                                                                                                                  |
| 5   | **Manage library → Sync with TMDB**                                                                | Edit ▾ menu item                               | 18px `inline` loader in the row's status slot (it replaces the dot): `Syncing with TMDB…`. Row at opacity .75, both action buttons disabled. When done, the status becomes _Synced with TMDB_ and a success snackbar shows                                                                                                                                                      |
| 6   | **Series → delete series** (`routes.deleteSeries`)                                                 | Confirm in the delete dialog                   | Same as 3                                                                                                                                                                                                                                                                                                                                                                       |
| 7   | **Settings → Reset library** (`routes.reset`)                                                      | Confirm                                        | Same as 3, with the label `Resetting library`                                                                                                                                                                                                                                                                                                                                   |
| 8   | **App start-up**                                                                                   | First render, before the first server response | Full screen on `bg`: 88px `tile` loader + `Opening your library`. Fades out over 200ms into the browse skeleton when the server answers. If the server can't be reached after 10s, switch the text to `Can't reach the FamilyFlix server` with a **Try again** button                                                                                                           |

### Not used here

- **Import and TMDB enrichment.** They already have their own live log (`ImportLog` / enrichment flow). Don't add a second indicator.
- **Page and detail loads.** These keep `LoadingDetail`, `LoadingSeries` and the poster-grid skeletons.
- **Anything that usually finishes within 300ms**, such as toggles, filters and tab changes. These show no loader.

## Timing rules (every action loader)

```ts
// suggested: src/hooks/useDelayedBusy.ts
const SHOW_AFTER = 300; // don't show a loader for quick work
const MIN_VISIBLE = 500; // once shown, keep it for at least this long so it never flickers
```

1. Start the request and disable the control that started it right away, keeping its width (`min-width` = width when idle).
2. Show the loader only if the request is still running after **300ms**.
3. Once shown, keep it for at least **500ms**, then show the result: Saved / snackbar / closed dialog.
4. If an action runs longer than about **10s** and the server reports progress, switch to the determinate mode (`progress` + `"12 of 40"`).
5. Destructive actions (delete, reset) can't be cancelled once confirmed (see 3).
6. Errors replace the loader where it was shown: in the button (snackbar + the button returns to normal) or in the dialog (an error message inside it).

## Open questions

1. Can the delete endpoint report its step (files → metadata), or should the detail text stay fixed as `Removing files from disk`?
2. For Reset library, should the determinate mode be used if the server can report a count of titles?
