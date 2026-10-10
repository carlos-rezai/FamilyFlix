> **Initiative:** `open-media-folder`
> **Design log:** `docs/design-logs/35-open-media-folder.md`
> **Issue:** #291
> **Build order:** step 18, the third of the third chain (log 32 §5) — a `feat:`, after one `refactor:`

## Problem Statement

I keep the family library up to date. The Storage card in Settings shows me
where FamilyFlix keeps its copies of the films, the **Managed media
directory**, and how much space it takes. But I can only read that path. To
look inside the folder, I have to type `%APPDATA%\FamilyFlix\media` into
Explorer by hand. That folder is hidden under AppData, and I cannot remember
the path. It is worse on my parents' machine, where I am usually helping over
the phone.

## Solution

The Storage card's path row gets an **Open folder** button beside the path.
One press opens the Managed media directory in Explorer. On a fresh install,
before anything has been imported, the folder does not exist yet. FamilyFlix
creates it first, so the press still opens a real (empty) folder rather than
failing.

Only the desktop app can open a folder, so the button is drawn only there. In
a plain browser the row looks exactly as it does today. If Windows cannot open
the folder, nothing pops up. The reason is written to the **Shell log**,
where I already look when something goes wrong on my parents' machine.

The renderer never names the path it wants opened. It asks main to "open the
media folder", and main opens the one folder it already knows. A page cannot
use this button to open anything else.

## User Stories

1. As the maintainer, I want an _Open folder_ button on the Storage card, so that I can reach the media folder without typing its path.
2. As the maintainer, I want the button beside the path it opens, so that it is obvious which folder it opens.
3. As the maintainer, I want one press to open the folder in Explorer, so that I can look at the files FamilyFlix holds.
4. As the maintainer on a fresh install, I want the button to work before anything is imported, so that it never fails just because the folder is not there yet.
5. As the maintainer, I want the folder FamilyFlix creates on that first press to be the same folder imports later fill, so that I am never shown an empty decoy.
6. As the maintainer, I want the button drawn even before the space count has loaded, so that I can open the folder on a slow disk without waiting.
7. As the maintainer, I want a long path to shorten with an ellipsis while the button keeps its full width, so that the button is always readable and pressable.
8. As the maintainer, I want the button to look like the other small secondary buttons in the app, so that the Storage card matches the prototype.
9. As the maintainer, I want Explorer opening to be the only confirmation, so that no snackbar announces something I can already see.
10. As the maintainer, I want a failed open recorded in the Shell log with the folder and Windows' reason, so that I can diagnose it later on my parents' machine.
11. As the maintainer, I want a failure to leave the app as it was, with no error face and no stuck button, so that one bad press does not break Settings.
12. As the maintainer, I want to be able to press the button again right away, so that a dismissed Explorer window can be reopened without reloading.
13. As a developer running FamilyFlix in a browser, I want no _Open folder_ button, so that the browser never draws a control it cannot honour.
14. As a developer running `electron:dev` or `electron:start`, I want the button to open the repo's own `media` folder, so that it opens the folder the server is really using.
15. As the maintainer, I want the installed app's server and the button to read one spelling of the media path, so that the two can never point at different folders.
16. As the maintainer, I want the renderer unable to ask main to open an arbitrary path, so that a compromised page cannot use this channel to open anything else on the machine.
17. As the maintainer, I want the Package smoke to check the button on a fresh install, so that every Installer is proven to open `%APPDATA%\FamilyFlix\media`.
18. As the maintainer, I want the prototype to show _Open folder_ before the code does, so that the prototype stays the spec.
19. As a developer, I want the Settings feature to reach the shell's folder bridge without importing another feature's plumbing, so that the `api/` rule ("no feature imports another's wire") holds.
20. As a developer, I want the Library folders page and the Export dialog to keep working unchanged after the bridge moves, so that the refactor is invisible.
21. As a family member, I want nothing on my screens to change, so that the library looks the same as before.

## Implementation Decisions

- **`ShellPaths.mediaRoot` (new field).** When installed it is `join(userData, 'media')`. Unpackaged (`dev` and `start`) it is `join(appPath, 'media')`, which is the directory the server's default `./media` resolves to under `serverCwd`. main never builds the path itself.
- **`serverLaunch` reads it.** When installed, the fork's `FAMILYFLIX_MEDIA_PATH` is `paths.mediaRoot` rather than a path `serverLaunch` builds itself. Unpackaged it still sets nothing, so a developer's own variable is honoured as today. After this change, every path main hands the **Server process** comes from **Shell paths**, as the glossary says.
- **`openMediaFolder` (new shell unit), shaped like `shellDialogs`:** `openMediaFolder(root, world): Promise<void>` over a `MediaFolderWorld { mkdir(path), openPath(path): Promise<string>, log(text) }`. It runs `mkdir` (recursive) first and then `openPath`. A non-empty answer from `openPath` is logged as `Couldn’t open the media folder: <error>`, with the root named. A `mkdir` that throws is logged the same way, and nothing is opened. It never rejects. main injects `mkdirSync`, `shell.openPath` and the Shell log's `main`.
- **The channel.** `FOLDER_CHANNELS.openMedia` = `'familyflix:folders:open-media'`. It is an `invoke` that takes **no argument** and resolves to nothing once main is done. main registers one `ipcMain.handle` for it, beside the two pickers, calling `openMediaFolder(paths.mediaRoot, world)`. `send` (fire-and-forget) was rejected, because the other two members use `invoke` and an awaitable call is something a test can wait on.
- **The bridge.** `FolderBridge.openMedia(): Promise<void>`, the **Folder bridge**'s third member. It is named for what it opens, not for a path. The preload adds it in one line.
- **`folderBridge` graduates to `src/api/`.** It is the one reader of `window.familyflix?.folders`, and it moves out of `features/import-export/` with its test unchanged, imported by path. Settings is the second feature to need it. The preload is the shell's wire, and no feature imports another's wire. `updateBridge` stays in `software-update/`, because only one feature uses it. `familyflix.d.ts`'s comment and CLAUDE.md's `api/` list are updated to name `folderBridge`.
- **The button.** The `Button` primitive, `variant="secondary"` and `size="sm"`, labelled _Open folder_, with no glyph. It sits in the Storage card's `Folder` row after the title and path, placed through `styled(Button)` as `OpenFolder` with `flex: 0 0 auto`. `StorageSection` reads the bridge once (`useState(folderBridge)`, `LibraryFolders`' precedent). The button is drawn whenever the bridge is not `null`, whether or not the **Storage report** has landed: **Blank until it lands** governs reads, not controls. A press is `void bridge.openMedia()`. There is no busy state, no snackbar and no error face. The component comment saying _No Change…_ is reworded to match.
- **The prototype first, in the same issue.** In `page.SettingsPage.dc.html`, the Storage card's _Change…_ button is relabelled _Open folder_, with the same element and styles. `FamilyFlix.dc.html` composes the page and needs no edit. _Change…_ stays the Roadmap's **Move the media folder**.
- **Shipping.** One issue, two commits. First, a `refactor:` moves `folderBridge` into `api/` with no change in behaviour. Then the `feat:` slice adds the prototype revision, `mediaRoot`, `serverLaunch` reading it, `openMediaFolder`, the channel and bridge member, the preload and main lines, the fake's member, the button and the Package smoke line.

## Testing Decisions

- A good test checks what a unit answers or what a user sees, never how it is wired. Shell units are tested over injected worlds, never over Electron. Components are tested through the DOM and the fake bridge, never through their internals.
- **`shellPaths`**: `mediaRoot` is `userData\media` when installed and `<appPath>\media` in `dev` and `start`.
- **`serverLaunch`**: when installed, `FAMILYFLIX_MEDIA_PATH` equals `paths.mediaRoot`. A fake `ShellPaths` with a distinct root proves the value is read, not rebuilt. Unpackaged, the variable is not set.
- **`openMediaFolder`** (new suite): the root is made before it is opened. `''` logs nothing. An error string is logged with the root and the error. A `mkdir` that throws is logged and nothing is opened. It never rejects. Prior art: `shellDialogs`' suite over its `DialogWorld`.
- **`folderBridge`**: its suite moves unchanged to `src/api/folderBridge/`.
- **`fakeFolderBridge`**: gains `openMedia`, counted as `openMedias()`, following its `pick` and `pickOne` counters.
- **`StorageSection`**: in a browser, there is no _Open folder_. Under the bridge, the button is drawn before the report lands and comes after the path (`comesBefore`). A press calls `openMedia` once. Prior art: `LibraryFolders`' and `useExport.browse`'s suites under `fakeFolderBridge`.
- `preload.ts` and `main.ts` stay untested wiring, as today. The **Package smoke** (`docs/release-checklist.md`) gains one check: _Settings → Storage → Open folder_ opens `%APPDATA%\FamilyFlix\media` in Explorer, on a fresh install too, before anything has been imported.

## Out of Scope

- Opening any other folder, such as a **Library folder** or an **Export folder**. Each would be its own decision (log 32), though it would follow this unit's shape.
- Revealing a single file (`shell.showItemInFolder`).
- _Change…_: the Roadmap's **Move the media folder**.
- A snackbar or any notice for a failed open.
- Passing a path from the renderer to main.
- Main reading the server's environment. Unpackaged, a developer who sets `FAMILYFLIX_MEDIA_PATH` themselves moves the server but not the button. That trade-off is accepted (log 35, Trade-offs).

## Further Notes

- `shell.openPath` resolves to `''` on success and to an error string otherwise. It never rejects, which is why the unit's only failure path is a log line.
- The glossary already holds **Managed media directory**, **Shell paths**, **Folder bridge** and **Shell log**. Log 35's glossary commit (`f6cf151`) records `mediaRoot` and the bridge's third member.
