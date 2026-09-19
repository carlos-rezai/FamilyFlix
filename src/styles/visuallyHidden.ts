import { css } from 'styled-components';

/**
 * The clipping rule that hides a control from the screen and from nothing
 * else — the `FilePicker`'s hidden `<input type="file">`, and the **Component
 * drop zone**'s.
 *
 * It clips rather than using `display: none`, and that is the whole of the
 * rule: a display-hidden input leaves the accessibility tree, taking the label
 * that names it and the tab order that reaches it with it — and the tab order
 * is the one way a file control is operated without a mouse.
 *
 * It lives here rather than in either of them because both need the same
 * bargain, and two copies of a rule this load-bearing are two chances for one
 * of them to drift into `display: none` on a tidy-up.
 */
export const visuallyHidden = css`
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
`;
