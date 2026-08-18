import styled, { keyframes } from 'styled-components';

/**
 * The box the panel is positioned against, and the box an outside pointerdown
 * is measured against — a press anywhere inside it, trigger included, is never
 * "outside". `relative` is the default a caller can replace: the movie detail
 * page pins its slot to the corner of the viewport instead.
 */
export const Slot = styled.div`
  position: relative;
`;

const pop = keyframes`
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
`;

/**
 * The popup itself, hanging under the trigger and aligned to its right edge —
 * the one arrangement every menu in the handoff draws. A left-aligned consumer
 * will earn the prop that makes it configurable; there isn't one yet.
 */
export const Panel = styled.div`
  position: absolute;
  top: 52px;
  right: 0;
  min-width: 170px;
  background: ${({ theme }) => theme.colors.surface2};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.md};
  padding: 6px;
  /* The cap a twelve-genre filter list needs. auto, not scroll, so the
     four-row edit menu that fits inside it shows nothing new. */
  max-height: 340px;
  overflow-y: auto;
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.5);
  animation: ${pop} 0.14s ease;
  z-index: 30;
`;

/** A real button, so the menu is operable by keyboard like everything else. */
export const Item = styled.button<{ $selected: boolean }>`
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  background: transparent;
  border: none;
  border-radius: ${({ theme }) => theme.radius.sm};
  cursor: pointer;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 15px;
  font-weight: ${({ $selected }) => ($selected ? 600 : 400)};
  color: ${({ theme, $selected }) =>
    $selected ? theme.colors.accent : theme.colors.text};
  text-align: left;
  white-space: nowrap;

  &:hover {
    background: ${({ theme }) => theme.colors.surface3};
  }
`;

/** The item's leading glyph — decorative, so it stays out of the item's name. */
export const Glyph = styled.span`
  font-size: 14px;
  line-height: 1;
`;

/**
 * The item's trailing chrome — the filter list's count, sitting at the row's
 * right edge. `margin-left: auto` rather than the prototype's `float: right`:
 * the row is a flex line here, where a float does nothing and auto margin is
 * the same result. Decorative, so it stays out of the item's name.
 */
export const Trailing = styled.span`
  margin-left: auto;
  padding-left: 12px;
  font-size: 13px;
  font-weight: 400;
  color: ${({ theme }) => theme.colors.textFaint};
`;
