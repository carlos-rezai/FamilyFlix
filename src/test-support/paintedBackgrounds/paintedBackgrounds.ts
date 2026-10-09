/**
 * Every background a root and its descendants paint, as the browser resolves
 * them: one line per element, in document order, the root first — its
 * `background`, `backgroundImage` and `backgroundColor` joined by ` | `, the
 * empty ones left out.
 *
 * Read through `getComputedStyle`, never a class name, so a suite asks what a
 * layer paints rather than which styled part paints it.
 */
export function paintedBackgrounds(root: Element): string[] {
  return [root, ...Array.from(root.querySelectorAll('*'))].map((el) => {
    const style = window.getComputedStyle(el);
    return [style.background, style.backgroundImage, style.backgroundColor]
      .filter(Boolean)
      .join(' | ');
  });
}
