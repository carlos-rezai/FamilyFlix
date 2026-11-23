import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

import { PosterCard } from './PosterCard';
import { theme } from '@/styles/theme';
import { makePosterCardMovie } from '@/test-support/makePosterCardMovie/makePosterCardMovie';

/**
 * The **Warm start**'s trigger: the card says when someone is about to open
 * it, by pointer or by keyboard, and stays presentational; what to warm is the
 * feature's business.
 */
describe('PosterCard — onWarm', () => {
  function renderCard() {
    const onWarm = vi.fn();
    const onOpen = vi.fn();
    render(
      <ThemeProvider theme={theme}>
        <PosterCard
          movie={makePosterCardMovie({ title: 'Comet Season' })}
          onOpen={onOpen}
          onToggleFavorite={() => undefined}
          onWarm={onWarm}
        />
      </ThemeProvider>
    );
    return {
      onWarm,
      onOpen,
      card: screen.getByRole('button', { name: 'Comet Season' }),
    };
  }

  it('emits onWarm when the pointer enters the card', () => {
    const { onWarm, card } = renderCard();

    fireEvent.pointerEnter(card);

    expect(onWarm).toHaveBeenCalledTimes(1);
  });

  it('emits onWarm when the card takes focus', () => {
    const { onWarm, card } = renderCard();

    fireEvent.focus(card);

    expect(onWarm).toHaveBeenCalledTimes(1);
  });

  it('does not emit onWarm on a press alone, then does on the pointer entering', () => {
    const { onWarm, onOpen, card } = renderCard();

    fireEvent.click(card);
    fireEvent.keyDown(card, { key: 'Enter' });

    expect(onOpen).toHaveBeenCalledTimes(2);
    expect(onWarm).not.toHaveBeenCalled();

    fireEvent.pointerEnter(card);
    expect(onWarm).toHaveBeenCalledTimes(1);
  });
});
