import styled, { css } from 'styled-components';

/** Where a step is: ticked behind the run, the one the run is on, or still ahead. */
export type StepState = 'done' | 'active' | 'pending';

/** The row of three, set the prototype's 26px over the headline. */
export const Steps = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 26px;
`;

/** A dot and its label, side by side. */
export const Step = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space.s2};
`;

/** The 24px circle: the tick when done, the number otherwise. */
export const Dot = styled.div<{ $state: StepState }>`
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 12px;
  font-weight: 700;
  ${({ $state, theme }) => {
    switch ($state) {
      case 'done':
        return css`
          background: ${theme.colors.watched};
          /* The ink on a coloured dot is the page background, so the tick
             reads on green and accent alike. */
          color: ${theme.colors.bg};
        `;
      case 'active':
        return css`
          background: ${theme.colors.accent};
          color: ${theme.colors.bg};
        `;
      case 'pending':
        return css`
          background: ${theme.colors.surface3};
          color: ${theme.colors.textFaint};
        `;
    }
  }}
`;

/** The step's name: full ink while active, dimmed once done, faint until then. */
export const Label = styled.span<{ $state: StepState }>`
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 14px;
  font-weight: 600;
  color: ${({ $state, theme }) =>
    $state === 'active'
      ? theme.colors.text
      : $state === 'done'
        ? theme.colors.textDim
        : theme.colors.textFaint};
`;

/** The 28px hairline between two steps. */
export const Rule = styled.div`
  flex: 0 0 28px;
  height: 1px;
  background: ${({ theme }) => theme.colors.border};
`;
