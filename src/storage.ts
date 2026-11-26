import { decodeHash, encodeHash, type SharedState } from './share';

/** localStorage key for the last palette, stored in the same text form as the URL hash. */
export const PALETTE_KEY = 'palette-lab:palette';

export function readStored(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStored(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage can be unavailable (private mode, blocked site data); the app works without it.
  }
}

/** Remembers the palette, its locks and the harmony, so reopening the app without a link brings them back. */
export function savePalette(state: SharedState): void {
  writeStored(PALETTE_KEY, encodeHash(state));
}

/** The palette saved last time, or null when there is none or it cannot be read. */
export function loadSavedPalette(): SharedState | null {
  const text = readStored(PALETTE_KEY);
  return text ? decodeHash(text) : null;
}
