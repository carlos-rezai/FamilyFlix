# FamilyFlix — Design Handoff

This folder is the **canonical design prototype** for FamilyFlix and the source of truth for
the UI. Every feature is built as a **1:1 translation** of this prototype into the codebase —
same layout, spacing, states, copy, and interaction. See `COMPONENT-SPEC.md` for the full
component-by-component contract and the repo folder mapping.

## How to open it

Open `FamilyFlix.dc.html` in any modern browser (no build step, no server). It's a fully
interactive prototype — browse, search, sort, filter, open a movie, play it, add/import/export,
and walk through Settings. Everything works.

## What's here

- **`FamilyFlix.dc.html`** — the entry point / router. Composes every screen and holds the
  app state (all the sample data and the per-screen model objects live in its one logic class).
- **`prim.*` / `mol.*` / `feat.*` / `page.*`** — the 33 components, one file each. The prefix
  is the atomic layer and maps to a repo folder:
  | Prefix | Layer | Repo folder |
  | --- | --- | --- |
  | `prim.*` | atoms | `src/primitives/` |
  | `mol.*` | molecules | `src/components/` |
  | `feat.*` | organisms | `src/features/` |
  | `page.*` | pages | `src/pages/` |
- **`tokens.css`** — the single source of design tokens (`--color-*`, `--font-*`, `--space-*`,
  `--radius-*`). Translates to `src/tokens/` + the styled-components theme.
- **`support.js`** — the prototype runtime (renders the `.dc.html` components in the browser).
  **Not** part of the translation — it's only here so the prototype runs. Do not port it.
- **`COMPONENT-SPEC.md`** — prop tables, variants, states, and the target path for every
  component. Read this alongside each file when translating.

## Translating to code

1. Each `.dc.html` is one component. Its `data-props` JSON (on the `<script data-dc-script>`
   tag) is the **prop interface**; the template markup is the JSX; the logic class is the
   component logic.
2. Inline `var(--token)` values become styled-components reading the theme — don't hardcode.
3. The container (`FamilyFlix.dc.html`) builds a typed **model object** per screen and passes
   it down. In code this becomes the page/route + its hooks/state; the child components keep
   the same prop shapes.

## Important: 1:1 means the UI surface, not the fake behavior

The prototype **simulates** the backend — sample movies, fake folder scans, `setTimeout`
"installing", canned update checks. Reproduce the _surface_ exactly (pixels, tokens, states,
transitions), then wire the behavior to the real Express + SQLite layer. **Never port the
simulation itself.**

If something in the prototype seems wrong while building, amend the prototype first
(raise it), then build to the amended prototype — don't redesign mid-implementation.
