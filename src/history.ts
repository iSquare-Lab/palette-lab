import type { Oklch } from './color';

/** What undo and redo bring back: the colours and which of them are locked. */
export interface PaletteSnapshot {
  colors: Oklch[];
  locks: boolean[];
}

export function copySnapshot(snapshot: PaletteSnapshot): PaletteSnapshot {
  return { colors: snapshot.colors.map((c) => ({ ...c })), locks: [...snapshot.locks] };
}

export function sameSnapshot(a: PaletteSnapshot, b: PaletteSnapshot): boolean {
  return (
    a.colors.length === b.colors.length &&
    a.colors.every((c, i) => c.l === b.colors[i].l && c.c === b.colors[i].c && c.h === b.colors[i].h) &&
    a.locks.length === b.locks.length &&
    a.locks.every((locked, i) => locked === b.locks[i])
  );
}

/**
 * An undo/redo list. Each entry is a state the person reached; the current one is the newest unless they undid.
 * It holds copies, so later edits to the live palette never change what undo brings back.
 */
export class History {
  readonly #limit: number;
  #entries: PaletteSnapshot[] = [];
  #index = -1;

  constructor(limit = 100) {
    this.#limit = limit;
  }

  get canUndo(): boolean {
    return this.#index > 0;
  }

  get canRedo(): boolean {
    return this.#index < this.#entries.length - 1;
  }

  /**
   * Records a new state after the current one and drops anything that could have been redone. A state equal to the
   * current one is not recorded (a slider released where it started, Enter then blur on the same hex), so one undo
   * always changes something. Returns whether it was recorded.
   */
  push(snapshot: PaletteSnapshot): boolean {
    const current = this.#entries[this.#index];
    if (current && sameSnapshot(current, snapshot)) return false;
    this.#entries.splice(this.#index + 1);
    this.#entries.push(copySnapshot(snapshot));
    if (this.#entries.length > this.#limit) this.#entries.shift();
    this.#index = this.#entries.length - 1;
    return true;
  }

  /** Steps back one state and returns it, or null when there is nothing to undo. */
  undo(): PaletteSnapshot | null {
    if (!this.canUndo) return null;
    this.#index -= 1;
    return copySnapshot(this.#entries[this.#index]);
  }

  /** Steps forward one state and returns it, or null when there is nothing to redo. */
  redo(): PaletteSnapshot | null {
    if (!this.canRedo) return null;
    this.#index += 1;
    return copySnapshot(this.#entries[this.#index]);
  }
}
