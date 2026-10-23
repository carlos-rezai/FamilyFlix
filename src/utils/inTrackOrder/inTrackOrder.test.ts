import { describe, it, expect } from 'vitest';

import { inTrackOrder } from './inTrackOrder';

const first = { id: 'a', position: 0 };
const second = { id: 'b', position: 1 };
const third = { id: 'c', position: 2 };

describe('inTrackOrder', () => {
  it('puts rows that arrive out of order in track order', () => {
    expect(inTrackOrder([third, first, second])).toEqual([
      first,
      second,
      third,
    ]);
  });

  it('gives rows already in track order back equal', () => {
    expect(inTrackOrder([first, second, third])).toEqual([
      first,
      second,
      third,
    ]);
  });

  it('leaves the list it is handed as it was', () => {
    const rows = [second, first];

    inTrackOrder(rows);

    expect(rows).toEqual([second, first]);
  });

  it('gives nothing for no rows', () => {
    expect(inTrackOrder([])).toEqual([]);
  });
});
