import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hexToOklch, oklchToHex } from '../src/color';
import { PALETTE_KEY, loadSavedPalette, readStored, savePalette, writeStored } from '../src/storage';
import { THEME_KEY, initTheme } from '../src/theme';

class MemoryStorage {
  items = new Map<string, string>();
  getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.items.set(key, value);
  }
}

const hexes = ['#1f2a44', '#7a2e6b', '#e8735a', '#f6c48a', '#fbf4e6'];
const colors = hexes.map((h) => hexToOklch(h)!);

describe('saved palette', () => {
  let storage: MemoryStorage;
  beforeEach(() => {
    storage = new MemoryStorage();
    vi.stubGlobal('window', { localStorage: storage });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('brings back the colours, the locks and the harmony', () => {
    savePalette({ colors, locks: [false, true, false, false, true], harmony: 'split' });
    const back = loadSavedPalette();
    expect(back?.colors.map(oklchToHex)).toEqual(hexes);
    expect(back?.locks).toEqual([false, true, false, false, true]);
    expect(back?.harmony).toBe('split');
  });

  it('starts fresh when nothing or something unreadable was saved', () => {
    expect(loadSavedPalette()).toBeNull();
    storage.setItem(PALETTE_KEY, 'c=not-a-palette');
    expect(loadSavedPalette()).toBeNull();
  });

  it('works without storage (private mode, blocked site data)', () => {
    vi.stubGlobal('window', {
      get localStorage(): never {
        throw new Error('SecurityError');
      },
    });
    expect(() => writeStored('k', 'v')).not.toThrow();
    expect(readStored('k')).toBeNull();
    expect(() => savePalette({ colors, locks: [false, false, false, false, false], harmony: 'auto' })).not.toThrow();
    expect(loadSavedPalette()).toBeNull();
  });
});

describe('theme', () => {
  let storage: MemoryStorage;
  let systemDark: boolean;
  let systemListener: (() => void) | null;
  const root = { dataset: {} as Record<string, string | undefined> };

  beforeEach(() => {
    storage = new MemoryStorage();
    systemDark = false;
    systemListener = null;
    root.dataset = {};
    vi.stubGlobal('document', { documentElement: root });
    vi.stubGlobal('window', {
      localStorage: storage,
      matchMedia: () => ({
        get matches() {
          return systemDark;
        },
        addEventListener: (_type: string, listener: () => void) => {
          systemListener = listener;
        },
      }),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('follows the system theme until the person picks one', () => {
    const seen: string[] = [];
    initTheme((theme) => seen.push(theme));
    expect(seen).toEqual(['light']);
    systemDark = true;
    systemListener?.();
    expect(seen).toEqual(['light', 'dark']);
    expect(root.dataset.theme).toBeUndefined();
  });

  it('remembers the toggled theme and uses it next time', () => {
    systemDark = true;
    const seen: string[] = [];
    const toggle = initTheme((theme) => seen.push(theme));
    toggle();
    expect(seen).toEqual(['dark', 'light']);
    expect(root.dataset.theme).toBe('light');
    expect(storage.getItem(THEME_KEY)).toBe('light');

    root.dataset = {};
    const again: string[] = [];
    initTheme((theme) => again.push(theme));
    expect(again).toEqual(['light']);
    // A picked theme stays put when the system changes.
    systemListener?.();
    expect(again).toEqual(['light', 'light']);
  });
});
