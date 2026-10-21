# FamilyFlix — A Netflix for the Family Movie Folder

A desktop app that turns a folder of movie and series files into a browsable,
searchable library with a built-in player — built for my parents to browse and
watch; I maintain the library. Portfolio project by Carlos Rezai.

**No AI, ever** — no recommendations, smart search or generated summaries.

## Tech Stack

- **Frontend:** React + TypeScript, Vite, Nx, styled-components over a custom design system
- **Backend:** Node.js + Express, SQLite via `better-sqlite3`
- **Shell:** Electron — one sandboxed window over the Express server forked in a `utilityProcess`
- **Playback:** a plain `<video>` driven by our `usePlayback` hook — no video.js or react-player (design log 10 Q2). FFmpeg (the bundled **Default component**, replaceable from Settings → Codecs) remuxes or transcodes anything Chromium can't play natively, behind `server/src/playback/`
- **Testing:** Vitest + @testing-library/react

## Atomic Design

All UI follows Atomic Design; nothing skips a rung.

| Rung      | Folder        | Rule                                             |
| --------- | ------------- | ------------------------------------------------ |
| Atoms     | `primitives/` | Dumb UI, no business logic, no data fetching     |
| Molecules | `components/` | Composed primitives, no domain knowledge         |
| Organisms | `features/`   | Domain UI + logic: owns its hooks, types, `api/` |
| Templates | `layouts/`    | Page chrome, structure only                      |
| Pages     | `pages/`      | Route views, composition only, default exports   |

- **One folder per unit**, its companions co-located: `Button/Button.tsx`,
  `Button.test.tsx`, `Button.styles.ts`. Utils and non-component feature
  modules get a folder too (`gradientFromId/gradientFromId.ts` + test).
  Single-file leaves (`tokens/*.ts`, `types/*.ts`) stay flat.
- **No per-unit barrel.** Only `primitives/`, `components/`, `utils/` and
  `tokens/` have an `index.ts`.
- Reuse an existing primitive or component rather than an inline styled `<div>`.
  A molecule that needs data or domain knowledge has graduated into a feature.

## Layout

```
electron/            the shell's main process — one pure unit per decision; main.ts and preload.ts are wiring only
server/src/
  routes/            HTTP only: parse, call a domain, respond
  library/ media/ import-export/ playback/ enrichment/   the five domains
  db/                connection, migrations, resetDatabase — shared infrastructure
  shell/             the server's half of the shell handshake and shutdown
src/
  App/ tokens/ styles/ primitives/ components/ features/ layouts/ pages/
  api/               wire calls 2+ features share — one folder per call, imported by path, no barrel
  hooks/             hooks used by 2+ features
  utils/             pure helpers, each with a test
  types/             shared interfaces, both build targets
```

`test-support/` (in `src/`, `server/src/` and `electron/`) is never imported by
shipping code. A wire call or hook moves up to `src/api/` or `src/hooks/` only
when a second feature needs it — no feature imports another's wire.

## Architectural Boundaries

- **The server is organized by domain**, each owning its data access and logic.
  No `services/` or `lib/` catch-all: logic that fits no domain earns a new one
  (`playback/` and `enrichment/` were born that way). Domains are injected into
  `createApiRouter`, so no route knows there is an FFmpeg or a TMDB.
- **`src/` never touches SQLite or the filesystem** — all file access goes
  through `server/src/media/`, the only code that touches managed storage.
- **The only writers into a Library folder** are `enrichment/`'s Write targets
  and an Export, each only ever adding what isn't there.
- **Enrichment (TMDB) is the only network client.** File paths are stored
  relative — to the media directory, or a **Linked video**'s to its Library
  folder by id.
- **Dev library:** import `server/src/import-export/createImporter/fixture/`;
  `npm run db:seed-series` adds mock series with watch progress.

## Product Rules

- **Media:** an import links a video where it lies by default (the **Import
  mode**) or copies it; art and subtitles are always copied. A linked video is
  played read-only and removed only by a Delete, only to the Recycle Bin.
- **Movie form** (`/add`): file fields are manual pickers. In the shell an
  add links by default — a picked video's path read through the **Path
  bridge**, a show taken whole by the **Show folder pick** — and copies a file
  under no Library folder; a browser add copies what it's given. On an edit a
  held file travels as its path, only a new pick as bytes; uploads stream
  through `busboy`.
- **Bulk import** reads nothing online, never makes a second copy of a held
  title, imports confident matches during the run, and lists only unsettled
  **Problems** in review. Copies run through `Media.copyIn`, cancellable.
- **Export** only ever adds its own new folder. **Large-file operations** never
  block the UI and show real progress, not a spinner.
- **Settings:** every read draws nothing until it lands. A control whose
  mechanism doesn't exist isn't drawn. Snackbars appear only where the
  prototype draws one.

## The Prototype Is the Spec

`docs/handoff/` is the visual source of truth: build each feature as a **1:1
translation** of its prototype (layout, spacing, states, copy, interaction),
wired to the real backend instead of the prototype's simulation. `prim.*`/
`mol.*`/`feat.*`/`page.*` map to their rungs (`docs/handoff/COMPONENT-SPEC.md`).
If something seems wrong or missing, amend the prototype in a grill-me first.

## Code Rules

- `docs/ubiquitous-language.md` defines every **bold** term — read it before
  naming anything; update it after every grill-me session.
- No `any`. No `console.log` in committed code. All dates are ISO strings.
- No business logic in primitives, components or pages; every `src/utils/`
  function has a test.

## Tooling and the Commit Gate

- **Never `npx`** (Windows): it spawns a focus-stealing console. Call
  `node_modules/.bin/<tool>` directly — the Husky hooks and lint-staged do too,
  so don't "simplify" them back. The Nx daemon stays off (`nx.json`).
- `pre-commit` runs Prettier; `commit-msg` typechecks. A `test:` commit checks
  only the shipping projects, so a RED commit passes — **never `--no-verify`**.

## Commit Messages

`<type>: [<initiative>] issue #<n> <description>` —
types: `feat`, `fix`, `chore`, `refactor`, `test`, `docs`. `<initiative>` is the
PRD name (e.g. `movie-form`), not the issue title. Keep the description under
~60 characters — if it won't fit, the issue is too broad. The release commit,
written by `npm version`, is `chore: [release] v0.2.0`.

**Never write a closing keyword** (`close`, `fix`, `resolve` and their forms)
before `#n` for an issue the commit doesn't close — GitHub closes it anyway,
even mid-sentence. List follow-ups as bare numbers: "filed as 39 and 40".

## Development Workflow

Skills live in `.claude/skills/`; read the matching `SKILL.md` before a task.
`grill-me` → `write-a-prd` → `prd-to-plan` → `prd-to-issues` → `tdd` (stops at
RED) → `build` → `request-refactor-plan` → `refactor`. `issue-loop` drives
`tdd` + `build` unattended.

## What's Next

Shipped features are in `README.md`'s status table.
