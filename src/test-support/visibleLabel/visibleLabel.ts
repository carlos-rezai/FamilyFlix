import { screen } from '@testing-library/react';

/** Whether `node` sits inside an `aria-hidden` subtree, so is not shown. */
const isHidden = (node: Node): boolean => {
  const element = node instanceof Element ? node : node.parentElement;
  return element?.closest('[aria-hidden="true"]') !== null;
};

/**
 * The label a control shows: its text outside every `[aria-hidden="true"]`
 * subtree. A **Busy button** lays out both its labels in one cell and hides
 * the one not drawn, so its `textContent` holds both; this reads only the one
 * drawn.
 */
export function visibleLabel(element: Element): string {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let text = '';
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    if (!isHidden(node)) {
      text += node.textContent ?? '';
    }
  }
  return text;
}

/**
 * Every element whose text is `text` and that is shown: the matches of
 * `queryAllByText` outside an `aria-hidden` subtree. A Busy button's label
 * not drawn is in the document, but does not count as shown.
 */
export function shownText(text: string): HTMLElement[] {
  return screen.queryAllByText(text).filter((element) => !isHidden(element));
}
