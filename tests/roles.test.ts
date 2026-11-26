import { describe, expect, it } from 'vitest';
import type { Oklch } from '../src/color';
import { DEFAULT_PALETTE } from '../src/generate';
import { assignRoles } from '../src/roles';

const sortedRoles = (colors: readonly Oklch[]) => Object.values(assignRoles(colors)).toSorted();

describe('assignRoles', () => {
  it('makes the darkest colour ink, the lightest paper and the most colourful of the rest primary', () => {
    expect(assignRoles(DEFAULT_PALETTE)).toEqual({ ink: 0, paper: 4, primary: 2, accent: 1, soft: 3 });
  });

  it('does not depend on the order of the slots', () => {
    const shuffled = [DEFAULT_PALETTE[3], DEFAULT_PALETTE[0], DEFAULT_PALETTE[4], DEFAULT_PALETTE[2], DEFAULT_PALETTE[1]];
    expect(assignRoles(shuffled)).toEqual({ ink: 1, paper: 2, primary: 3, accent: 4, soft: 0 });
  });

  it('gives every slot exactly one role, even when lightness and chroma tie', () => {
    const same: Oklch[] = Array.from({ length: 5 }, () => ({ l: 0.5, c: 0.1, h: 200 }));
    // Ties keep slot order: the first slot is ink, the last paper.
    expect(assignRoles(same)).toEqual({ ink: 0, paper: 4, primary: 1, accent: 2, soft: 3 });
    const tiedChroma: Oklch[] = [
      { l: 0.2, c: 0.05, h: 0 },
      { l: 0.5, c: 0.12, h: 90 },
      { l: 0.6, c: 0.12, h: 180 },
      { l: 0.7, c: 0.12, h: 270 },
      { l: 0.95, c: 0.02, h: 0 },
    ];
    expect(sortedRoles(tiedChroma)).toEqual([0, 1, 2, 3, 4]);
    expect(assignRoles(tiedChroma).primary).toBe(1);
  });

  it('never makes a grey the primary colour while a coloured one is left', () => {
    // A locked mid grey sits between the ink and paper but has no chroma, so it becomes the soft tone.
    const withGrey: Oklch[] = [
      { l: 0.25, c: 0.04, h: 260 },
      { l: 0.55, c: 0, h: 0 },
      { l: 0.6, c: 0.16, h: 30 },
      { l: 0.75, c: 0.1, h: 70 },
      { l: 0.96, c: 0.02, h: 80 },
    ];
    expect(assignRoles(withGrey)).toEqual({ ink: 0, paper: 4, primary: 2, accent: 3, soft: 1 });
  });

  it('still fills every role for a palette of greys', () => {
    const greys: Oklch[] = [0.9, 0.1, 0.5, 0.3, 0.7].map((l) => ({ l, c: 0, h: 0 }));
    const roles = assignRoles(greys);
    expect(roles.ink).toBe(1);
    expect(roles.paper).toBe(0);
    expect(sortedRoles(greys)).toEqual([0, 1, 2, 3, 4]);
  });

  it('leaves the input untouched', () => {
    const colors = DEFAULT_PALETTE.map((c) => ({ ...c })).toReversed();
    const before = JSON.stringify(colors);
    assignRoles(colors);
    expect(JSON.stringify(colors)).toBe(before);
  });
});
