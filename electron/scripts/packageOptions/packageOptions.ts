/** What `electron:package` builds, for which platform, and whether electron-builder uploads it. */
export interface PackageOptions {
  /**
   * `nsis` for the **Installer**, `AppImage` for the **AppImage**, `dir` for
   * the **Packaged layout** alone.
   */
  target: 'nsis' | 'AppImage' | 'dir';
  /** `always` only under `--publish` — the release workflow's — so a local package uploads nothing. */
  publish: 'never' | 'always';
  /** The platform built for, which `packageApp.mjs` maps to electron-builder's `Platform`. */
  platform: 'windows' | 'linux';
}

/**
 * Pure: `electron:package`'s arguments and the running platform → its
 * options. `--dir` chooses the layout alone, `--publish` the upload to the
 * **Release feed**; either order. Any platform but Windows and Linux is
 * refused.
 *
 * Written with erasable types only, so `packageApp.mjs` imports it directly
 * under Node's own type stripping (`verifyDigest`'s precedent).
 */
export function packageOptions(
  args: readonly string[],
  platform: string
): PackageOptions {
  const publish = args.includes('--publish') ? 'always' : 'never';
  const dir = args.includes('--dir');

  if (platform === 'win32') {
    return { target: dir ? 'dir' : 'nsis', publish, platform: 'windows' };
  }
  if (platform === 'linux') {
    return { target: dir ? 'dir' : 'AppImage', publish, platform: 'linux' };
  }
  throw new Error(
    `FamilyFlix packages only for Windows and Linux, not for ${platform}.`
  );
}
