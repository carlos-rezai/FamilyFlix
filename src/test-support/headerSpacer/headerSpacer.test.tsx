import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import styled from 'styled-components';

import { headerSpacer } from './headerSpacer';

const Grower = styled.div`
  flex: 1 1 auto;
`;

const Fixed = styled.div`
  flex: 0 0 auto;
`;

describe('headerSpacer', () => {
  it('finds the header child that grows, whatever sits either side of it', () => {
    render(
      <header>
        <Fixed>start</Fixed>
        <Grower data-testid="spacer" />
        <Fixed>end</Fixed>
      </header>
    );

    expect(headerSpacer().getAttribute('data-testid')).toBe('spacer');
  });

  it('finds it written as the flex shorthand or as longhand alike', () => {
    // Both spellings compute to the same `flexGrow`, which is what makes the
    // spacer the spacer — the layouts are free to write either.
    const Longhand = styled.div`
      flex-grow: 1;
      flex-shrink: 1;
      flex-basis: auto;
    `;

    render(
      <header>
        <Fixed>start</Fixed>
        <Longhand data-testid="spacer" />
      </header>
    );

    expect(headerSpacer().getAttribute('data-testid')).toBe('spacer');
  });

  it('throws, naming the failure, when the header has no spacer left', () => {
    render(
      <header>
        <Fixed>start</Fixed>
        <Fixed>end</Fixed>
      </header>
    );

    // A missing spacer is the failure worth reporting, not something for three
    // other tests to go quiet about.
    expect(() => headerSpacer()).toThrow(
      'The header has no flex spacer to split the strip.'
    );
  });

  it('throws when there is no header at all', () => {
    render(<div>no chrome here</div>);

    expect(() => headerSpacer()).toThrow();
  });
});
