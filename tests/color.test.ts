import { describe, expect, it } from 'vitest';
import {
  contrastLevel,
  contrastRatio,
  formatOklch,
  formatRatio,
  formatRgb,
  hexToOklch,
  hexToRgb,
  inGamut,
  keepHue,
  maxChromaFor,
  oklchToHex,
  oklchToRgb,
  readableOn,
  relativeLuminance,
  rgbToHex,
  rgbToOklab,
  rgbToOklch,
  toGamut,
  wcagLevels,
} from '../src/color';

const hueOfHex = (hex: string): number => hexToOklch(hex)!.h;

const rgb = (hex: string) => {
  const value = hexToRgb(hex);
  if (!value) throw new Error(`bad hex ${hex}`);
  return value;
};

describe('hex parsing and formatting', () => {
  it('parses six- and three-digit hex, with or without #', () => {
    expect(hexToRgb('#ff8000')).toEqual({ r: 1, g: 128 / 255, b: 0 });
    expect(hexToRgb('0f0')).toEqual({ r: 0, g: 1, b: 0 });
    expect(hexToRgb(' #ABCDEF ')).toEqual({ r: 0xab / 255, g: 0xcd / 255, b: 0xef / 255 });
  });

  it('rejects text that is not a hex colour', () => {
    expect(hexToRgb('#12345')).toBeNull();
    expect(hexToRgb('red')).toBeNull();
    expect(hexToRgb('#ggg')).toBeNull();
  });

  it('formats rgb as lowercase hex and clamps out-of-range channels', () => {
    expect(rgbToHex({ r: 1, g: 0.5, b: 0 })).toBe('#ff8000');
    expect(rgbToHex({ r: 1.2, g: -0.1, b: 0.5 })).toBe('#ff0080');
    expect(formatRgb(rgb('#1a2b3c'))).toBe('rgb(26 43 60)');
  });
});

describe('OKLab and OKLCH', () => {
  it('matches the reference values for pure sRGB red', () => {
    const lch = rgbToOklch(rgb('#ff0000'));
    expect(lch.l).toBeCloseTo(0.62796, 4);
    expect(lch.c).toBeCloseTo(0.25768, 4);
    expect(lch.h).toBeCloseTo(29.2339, 2);
  });

  it('maps white to L=1 and black to L=0 with no chroma', () => {
    const white = rgbToOklab({ r: 1, g: 1, b: 1 });
    expect(white.l).toBeCloseTo(1, 4);
    expect(Math.abs(white.a)).toBeLessThan(1e-4);
    expect(Math.abs(white.b)).toBeLessThan(1e-4);
    expect(rgbToOklch({ r: 0, g: 0, b: 0 })).toEqual({ l: 0, c: 0, h: 0 });
  });

  it('round-trips every hex through OKLCH', () => {
    for (const hex of ['#000000', '#ffffff', '#123456', '#ff00ff', '#00ff7f', '#7f7f7f', '#e76f51', '#0a0b0c']) {
      const lch = hexToOklch(hex);
      expect(lch).not.toBeNull();
      expect(oklchToHex(lch!)).toBe(hex);
    }
  });

  it('gives blue a hue near 264 degrees', () => {
    expect(rgbToOklch(rgb('#0000ff')).h).toBeCloseTo(264.05, 1);
  });

  it('formats OKLCH as a CSS colour', () => {
    expect(formatOklch(rgbToOklch(rgb('#ff0000')))).toBe('oklch(62.8% 0.258 29.2)');
    expect(formatOklch({ l: 0.5, c: 0, h: 120 })).toBe('oklch(50% 0 0)');
  });
});

describe('gamut mapping', () => {
  it('keeps colours that are already inside sRGB', () => {
    const lch = { l: 0.6, c: 0.1, h: 40 };
    expect(toGamut(lch)).toEqual(lch);
  });

  it('reduces chroma of out-of-gamut colours until they fit, keeping L and h', () => {
    const wild = { l: 0.9, c: 0.35, h: 140 };
    expect(inGamut(oklchToRgb(wild))).toBe(false);
    const mapped = toGamut(wild);
    expect(mapped.l).toBe(0.9);
    expect(mapped.h).toBe(140);
    expect(mapped.c).toBeLessThan(0.35);
    expect(inGamut(oklchToRgb(mapped))).toBe(true);
  });

  it('has no chroma available at the ends of lightness', () => {
    expect(maxChromaFor(0, 30)).toBe(0);
    expect(maxChromaFor(1, 30)).toBe(0);
    expect(maxChromaFor(0.63, 29.23)).toBeGreaterThan(0.25);
  });
});

describe('WCAG 2 contrast', () => {
  it('computes relative luminance', () => {
    expect(relativeLuminance(rgb('#ffffff'))).toBeCloseTo(1, 6);
    expect(relativeLuminance(rgb('#000000'))).toBe(0);
    expect(relativeLuminance(rgb('#808080'))).toBeCloseTo(0.2159, 4);
  });

  it('gives 21:1 for black on white and 1:1 for identical colours', () => {
    expect(contrastRatio(rgb('#000'), rgb('#fff'))).toBeCloseTo(21, 6);
    expect(contrastRatio(rgb('#fff'), rgb('#000'))).toBeCloseTo(21, 6);
    expect(contrastRatio(rgb('#3a7'), rgb('#3a7'))).toBe(1);
  });

  it('matches known ratios', () => {
    expect(contrastRatio(rgb('#777777'), rgb('#ffffff'))).toBeCloseTo(4.48, 2);
    expect(contrastRatio(rgb('#767676'), rgb('#ffffff'))).toBeCloseTo(4.54, 2);
    expect(contrastRatio(rgb('#0000ff'), rgb('#ffffff'))).toBeCloseTo(8.59, 2);
  });

  it('applies the AA and AAA thresholds without rounding up', () => {
    expect(wcagLevels(4.48)).toEqual({ aaNormal: false, aaLarge: true, aaaNormal: false, aaaLarge: false });
    expect(wcagLevels(4.5)).toEqual({ aaNormal: true, aaLarge: true, aaaNormal: false, aaaLarge: true });
    expect(wcagLevels(7.1)).toEqual({ aaNormal: true, aaLarge: true, aaaNormal: true, aaaLarge: true });
    expect(wcagLevels(2.9)).toEqual({ aaNormal: false, aaLarge: false, aaaNormal: false, aaaLarge: false });
  });

  it('picks the more readable text colour', () => {
    expect(readableOn(rgb('#ffeeaa'))).toBe('#000000');
    expect(readableOn(rgb('#1f2a44'))).toBe('#ffffff');
  });
});

describe('alpha in hex', () => {
  it('accepts #rgba and #rrggbbaa and drops the alpha', () => {
    expect(hexToRgb('#ff800080')).toEqual(hexToRgb('#ff8000'));
    expect(hexToRgb('0f0c')).toEqual(hexToRgb('#00ff00'));
    expect(hexToRgb('#ff80008')).toBeNull();
  });
});

describe('greys keep their hue', () => {
  it('gives a grey hex no hue of its own (0, which is red)', () => {
    expect(hexToOklch('#808080')?.h).toBe(0);
  });

  it('keeps the previous hue when an edit turns the colour grey', () => {
    const before = { l: 0.6, c: 0.12, h: 250 };
    const greyHex = hexToOklch('#808080')!;
    const kept = keepHue(greyHex, before);
    expect(kept.h).toBe(250);
    expect(kept.l).toBe(greyHex.l);
    expect(kept.c).toBe(greyHex.c);
    // Raising chroma again (slider or plane) now stays blue instead of jumping to red.
    expect(oklchToHex({ ...kept, c: 0.1 })).toBe(oklchToHex({ l: kept.l, c: 0.1, h: 250 }));
    expect(hueOfHex(oklchToHex({ ...kept, c: 0.1 }))).toBeCloseTo(250, 0);
  });

  it('takes the new hue when the new colour has one', () => {
    const red = hexToOklch('#e76f51')!;
    expect(keepHue(red, { l: 0.5, c: 0.1, h: 250 })).toEqual(red);
  });
});

describe('ratio display', () => {
  it('cuts ratios down instead of rounding them up', () => {
    expect(formatRatio(4.499)).toBe('4.49');
    expect(formatRatio(4.46, 1)).toBe('4.4');
    expect(formatRatio(4.5, 1)).toBe('4.5');
    expect(formatRatio(6.99, 1)).toBe('6.9');
    expect(formatRatio(1)).toBe('1.00');
    expect(formatRatio(4.6)).toBe('4.60');
    expect(formatRatio(2.9999999999)).toBe('2.99');
    expect(formatRatio(4.4999999999, 1)).toBe('4.4');
  });

  it('reads black on white as 21, not 20.99', () => {
    const ratio = contrastRatio(rgb('#000000'), rgb('#ffffff'));
    expect(formatRatio(ratio)).toBe('21.00');
    expect(formatRatio(ratio, 1)).toBe('21.0');
  });

  it('never shows a passing number on a failing level', () => {
    // #777 on white is 4.48:1: below AA. It used to show "4.5" in a cell coloured as a fail.
    const ratio = contrastRatio(rgb('#777777'), rgb('#ffffff'));
    expect(contrastLevel(ratio)).toBe('large');
    expect(formatRatio(ratio, 1)).toBe('4.4');
    for (let r = 1; r <= 21; r += 0.001) {
      const shown = Number(formatRatio(r, 1));
      expect(contrastLevel(shown)).toBe(contrastLevel(r));
    }
  });

  it('names the best level reached', () => {
    expect(contrastLevel(7)).toBe('aaa');
    expect(contrastLevel(6.99)).toBe('aa');
    expect(contrastLevel(4.5)).toBe('aa');
    expect(contrastLevel(4.49)).toBe('large');
    expect(contrastLevel(3)).toBe('large');
    expect(contrastLevel(2.99)).toBe('fail');
  });
});
