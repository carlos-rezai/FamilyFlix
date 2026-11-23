import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';

import { useDecodedArt } from './useDecodedArt';
import { warmArt } from '@/api/warmArt/warmArt';
import { stubImage } from '@/test-support/stubImage/stubImage';

/**
 * `warmArt` holds what it warmed for the life of the page, so every test here
 * asks for urls of its own: one test's warm picture is never another's.
 */
describe('useDecodedArt', () => {
  const images = stubImage();

  /** Render the hook and keep every answer it gave, the first render's first. */
  function renderAnswers(initial: string | null) {
    const answers: (string | null)[] = [];
    const hook = renderHook(
      ({ url }: { url: string | null }) => {
        const answer = useDecodedArt(url);
        answers.push(answer);
        return answer;
      },
      { initialProps: { url: initial } }
    );
    return { ...hook, answers };
  }

  it('answers null until the url is decoded, then the url', async () => {
    const url = '/api/images/cold/backdrop.jpg';
    const { result, answers } = renderAnswers(url);

    expect(answers[0]).toBeNull();
    expect(result.current).toBeNull();

    await images.decode(url);

    expect(result.current).toBe(url);
  });

  it('answers the url at the first render when it is already warm', async () => {
    const url = '/api/images/warm/backdrop.jpg';
    const warming = warmArt(url);
    await images.decode(url);
    await warming;

    const { answers } = renderAnswers(url);

    expect(answers[0]).toBe(url);
    expect(images.created(url)).toBe(1);
  });

  it('stays null on a failure: the Gradient fallback alone', async () => {
    const url = '/api/images/broken/backdrop.jpg';
    const { result, answers } = renderAnswers(url);

    await images.fail(url);

    expect(result.current).toBeNull();
    expect(answers.every((answer) => answer === null)).toBe(true);
  });

  it('starts again on a changed url, and never answers the one it left', async () => {
    const first = '/api/images/first/backdrop.jpg';
    const second = '/api/images/second/backdrop.jpg';
    const { result, rerender } = renderAnswers(first);
    await images.decode(first);
    expect(result.current).toBe(first);

    rerender({ url: second });
    expect(result.current).toBeNull();

    await images.decode(second);
    expect(result.current).toBe(second);
  });

  it('drops a url still decoding when the url changes', async () => {
    const left = '/api/images/left/backdrop.jpg';
    const next = '/api/images/next/backdrop.jpg';
    const { result, rerender } = renderAnswers(left);

    rerender({ url: next });
    await images.decode(left);

    expect(result.current).toBeNull();
  });

  it('answers null for null, and asks for nothing', () => {
    const { result } = renderAnswers(null);

    expect(result.current).toBeNull();
    expect(images.sources()).toEqual([]);
  });
});
