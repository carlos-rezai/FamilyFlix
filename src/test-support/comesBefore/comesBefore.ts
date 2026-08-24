/**
 * Does `earlier` come before `later` in the document?
 *
 * Reading order, not visual order — which is what a header slot's contract is
 * about: a slot renders before the spacer or after it, and that is true of the
 * markup whatever the styling later does with it.
 */
export function comesBefore(earlier: Element, later: Element): boolean {
  return Boolean(
    earlier.compareDocumentPosition(later) & Node.DOCUMENT_POSITION_FOLLOWING
  );
}
