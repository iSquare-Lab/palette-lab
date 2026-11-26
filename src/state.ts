import { hexToRgb, oklchToHex, type Oklch, type Rgb } from './color';
import type { ExportFormat } from './export';
import { DEFAULT_PALETTE, type Harmony } from './generate';
import type { HarmonyChoice } from './share';

/** The contrast checker can also compare against plain white and black: they follow the five palette slots. */
export const WHITE = 5;
export const BLACK = 6;

/** The one live state of the page. Every panel reads it; main.ts is the only place that replaces the palette. */
export const state = {
  colors: DEFAULT_PALETTE.map((c) => ({ ...c })) as Oklch[],
  locks: [false, false, false, false, false],
  harmony: 'auto' as HarmonyChoice,
  /** The harmony of the last generated palette, or null for the example palette and loaded links. */
  lastHarmony: null as Harmony | null,
  selected: 2,
  fg: 0,
  bg: 4,
  format: 'css' as ExportFormat,
};

export const hexOf = (i: number): string =>
  i === WHITE ? '#ffffff' : i === BLACK ? '#000000' : oklchToHex(state.colors[i]);

export const rgbOf = (i: number): Rgb => hexToRgb(hexOf(i)) as Rgb;

export const nameOf = (i: number): string => (i === WHITE ? 'White' : i === BLACK ? 'Black' : `Colour ${i + 1}`);
