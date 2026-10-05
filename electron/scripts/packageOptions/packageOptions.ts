/** What `electron:package` builds, and whether electron-builder uploads it. */
export interface PackageOptions {
  /** `nsis` for the **Installer**, `dir` for the **Packaged layout** alone. */
  target: 'nsis' | 'dir';
  /** `always` only under `--publish` — the release workflow's — so a local package uploads nothing. */
  publish: 'never' | 'always';
}

/**
 * Pure: `electron:package`'s arguments → its options. `--dir` chooses the
 * layout alone, `--publish` the upload to the **Release feed**; either order.
 *
 * Written with erasable types only, so `packageApp.mjs` imports it directly
 * under Node's own type stripping (`verifyDigest`'s precedent).
 */
export function packageOptions(args: readonly string[]): PackageOptions {
  return {
    target: args.includes('--dir') ? 'dir' : 'nsis',
    publish: args.includes('--publish') ? 'always' : 'never',
  };
}
