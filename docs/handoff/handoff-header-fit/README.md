# Header fit: handoff

Step 55, design log `docs/design-logs/73-header-fit.md`. This README is the
spec for the **Header fit** until phase 1 amends `page.LibraryPage.dc.html`,
`page.SettingsPage.dc.html`, the model in `FamilyFlix.dc.html` and
`COMPONENT-SPEC.md` to it; after that the prototype rules, as everywhere.
Nothing here is newly drawn: two pills go, one dropdown gains two rows, and
the end of the header learns to wrap.

## The browse header

Left to right, as today less two pills:

| Part       | Value                                                                   |
| ---------- | ----------------------------------------------------------------------- |
| First line | the Wordmark, `mol.PillTabs` (Movies / Series), `mol.SearchBar`         |
| Header end | Genre, ★ Rating, Sort (`mol.FilterDropdown` each), then Settings (gear) |
| Gone       | the _Quality_ pill (log 70) and the _View_ pill (log 63)                |

The **Header end** is one unit: the three pills and the Settings button,
24px apart, never split and never shrunk. It sits at the right of the first
line while that line can hold it; when it cannot, it moves whole to a second
line, right-aligned, 12px below the first, and the search grows into the
room it left. The header's padding (16px, 32px) is unchanged; the strip is
simply taller by a line.

| Window      | Lines                                           |
| ----------- | ----------------------------------------------- |
| ≥ ~1347px   | one                                             |
| 1024–1347px | two: the Header end on the second, at the right |

## The Genre dropdown

The pill keeps its caption, `Genre`. Its rows, in order:

| Row                                          | Count           | Checked when                                     |
| -------------------------------------------- | --------------- | ------------------------------------------------ |
| `All Genres`                                 | the tab's total | no genre chosen, and the tab is browsed by genre |
| `All movies` (Movies), `All series` (Series) | the tab's total | no genre chosen, and the tab is one grid         |
| each genre, busiest first, A to Z on a tie   | its count       | that genre is chosen                             |

| Choosing                    | Does                                                             |
| --------------------------- | ---------------------------------------------------------------- |
| `All Genres`                | clears the genre; the tab draws its genre rows and its Other row |
| `All movies` / `All series` | clears the genre; the tab draws one grid under that heading      |
| a genre                     | narrows to that genre; how the tab is browsed stays as it was    |

The pill shows the checked row's label: the genre, `All Genres`, or
`All movies` / `All series`. A fresh household reads `All Genres` on Movies
and `All series` on Series, today's faces. The choice of the first two rows
is the household's, per tab, kept across relaunches, never in the URL. No
snackbar. In the app the pill is not drawn until the settings read lands.

Every body, the Genre rows, View all and the Genre page are unchanged.

## Settings → Display

_Show video quality_ keeps its row and its toggle. Its description becomes:

| Part        | Value                                                                       |
| ----------- | --------------------------------------------------------------------------- |
| Description | `Tag each poster with how sharp its video is: 4K, 1080p, 720p, 480p or SD.` |

The toggle turns the Quality tag on the posters on or off, nothing else.
