/**
 * The name of a **Movie folder**: a title and a year to the one directory every
 * one of that movie's files lives in.
 *
 * It is **pure**, and that is the whole point of its shape. A folder name is
 * the first segment of every one of a movie's **Stored paths**, so a name with
 * a second segment in it — or with a `..` in it, or none at all — is a path
 * nobody chose; and the cheapest place to prove none of those can happen is a
 * table of strings rather than a directory on a disk.
 *
 * **Every title produces a usable name.** There is no title this answers the
 * empty string for: `''` resolves to the media root itself, which is a folder
 * every such film would share and `mediaFilePath` would refuse. A film called
 * "!!!" is a film the maintainer is allowed to add, so a title with nothing to
 * slug falls back to {@link FALLBACK}.
 *
 * **Accents are folded rather than dropped.** The **Managed media directory**
 * stays browsable by hand, and a sanitiser that removed every non-ASCII
 * character would answer `am-lie` for *Amélie* — the folder the maintainer
 * cannot find.
 *
 * The alphabet it answers in is lowercase letters, digits and single hyphens:
 * what survives NTFS, a case-sensitive filesystem, and the URL
 * `/api/images/<stored path>` alike.
 *
 * The suffixing that keeps two films with the same title and year apart is
 * `reserveFolder`'s, not this one's — a name that depended on what was already
 * on disk could not be pure.
 */
export function movieFolder(title: string, year: number | null): string {
  const slug = slugify(title);
  return year === null ? slug : `${slug}-${year}`;
}

/** What a title with nothing to build a name out of is called instead. */
const FALLBACK = 'movie';

/**
 * The title's own half of the name.
 *
 * Apostrophes are removed rather than separated on, so `Assassin's` is one word
 * and not two; every other run of anything outside the alphabet becomes a
 * single hyphen, and the hyphens at either end come off.
 */
function slugify(title: string): string {
  const folded = title
    // Split each accented letter into a letter and a combining mark, then drop
    // the marks: `é` becomes `e` rather than becoming nothing.
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/['‘’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return folded === '' ? FALLBACK : folded;
}
