import { describe, expect, it } from 'vitest';
import type { Oklch } from '../src/color';
import { History, sameSnapshot, type PaletteSnapshot } from '../src/history';

const grey = (l: number): Oklch => ({ l, c: 0, h: 0 });
const palette = (l: number, locks = [false, false, false, false, false]): PaletteSnapshot => ({
  colors: [grey(l), grey(l + 0.1), grey(l + 0.2), grey(l + 0.3), grey(l + 0.4)],
  locks,
});

describe('History', () => {
  it('starts with nothing to undo or redo', () => {
    const history = new History();
    expect(history.canUndo).toBe(false);
    expect(history.canRedo).toBe(false);
    expect(history.undo()).toBeNull();
    history.push(palette(0.1));
    expect(history.canUndo).toBe(false);
    expect(history.redo()).toBeNull();
  });

  it('undoes and redoes in order', () => {
    const history = new History();
    history.push(palette(0.1));
    history.push(palette(0.2));
    history.push(palette(0.3));
    expect(history.undo()?.colors[0].l).toBe(0.2);
    expect(history.undo()?.colors[0].l).toBe(0.1);
    expect(history.canUndo).toBe(false);
    expect(history.redo()?.colors[0].l).toBe(0.2);
    expect(history.redo()?.colors[0].l).toBe(0.3);
    expect(history.canRedo).toBe(false);
  });

  it('drops the redo states when something new happens after an undo', () => {
    const history = new History();
    history.push(palette(0.1));
    history.push(palette(0.2));
    history.undo();
    history.push(palette(0.5));
    expect(history.canRedo).toBe(false);
    expect(history.undo()?.colors[0].l).toBe(0.1);
  });

  it('does not record a state equal to the current one, so every undo changes something', () => {
    const history = new History();
    expect(history.push(palette(0.1))).toBe(true);
    expect(history.push(palette(0.2))).toBe(true);
    // A slider released where it started fires "change" without changing the colour.
    expect(history.push(palette(0.2))).toBe(false);
    expect(history.undo()?.colors[0].l).toBe(0.1);
    expect(history.canUndo).toBe(false);
  });

  it('records a lock change as its own step', () => {
    const history = new History();
    history.push(palette(0.1));
    expect(history.push(palette(0.1, [true, false, false, false, false]))).toBe(true);
    expect(history.undo()?.locks[0]).toBe(false);
  });

  it('keeps copies, so editing the live palette never changes what undo brings back', () => {
    const history = new History();
    const live = palette(0.1);
    history.push(live);
    history.push(palette(0.2));
    live.colors[0].l = 0.9;
    live.locks[0] = true;
    const back = history.undo();
    expect(back?.colors[0].l).toBe(0.1);
    expect(back?.locks[0]).toBe(false);
    back!.colors[0].l = 0.7;
    expect(history.redo()?.colors[0].l).toBe(0.2);
    expect(history.undo()?.colors[0].l).toBe(0.1);
  });

  it('forgets the oldest states past its limit', () => {
    const history = new History(3);
    for (let i = 1; i <= 5; i += 1) history.push(palette(i / 10));
    expect(history.undo()?.colors[0].l).toBe(0.4);
    expect(history.undo()?.colors[0].l).toBe(0.3);
    expect(history.canUndo).toBe(false);
  });
});

describe('sameSnapshot', () => {
  it('compares every colour channel and every lock', () => {
    expect(sameSnapshot(palette(0.1), palette(0.1))).toBe(true);
    const hueChanged = palette(0.1);
    hueChanged.colors[3] = { ...hueChanged.colors[3], h: 120 };
    expect(sameSnapshot(palette(0.1), hueChanged)).toBe(false);
    expect(sameSnapshot(palette(0.1), palette(0.1, [false, false, true, false, false]))).toBe(false);
  });
});
