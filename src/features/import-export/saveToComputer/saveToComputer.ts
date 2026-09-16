/**
 * **Save to computer**: hand a blob to the browser as a download under a
 * filename — an object URL minted for the blob, on an anchor carrying
 * `download`, clicked, and the URL revoked once the press has been made.
 *
 * A DOM side effect, and so a unit under `import-export` rather than
 * `utils/`, which has one rule. Navigating the page to the route instead was
 * rejected: a refusal would replace the app with a JSON body, where a blob
 * already in hand has passed every status check. Under Electron the same
 * download raises `will-download` and the shell's save dialog.
 *
 * The anchor is never attached to the document — `click()` works on a
 * detached anchor in every browser the app runs in — so nothing is left
 * behind to tidy.
 */
export function saveToComputer(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
