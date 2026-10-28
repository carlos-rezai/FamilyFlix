/**
 * The **Busy phase** of an action the household started (log 53): `idle`
 * before and after, `waiting` from the press until the work has run 300ms
 * (locked, nothing drawn), and `shown` once its loader is drawn.
 */
export type BusyPhase = 'idle' | 'waiting' | 'shown';
