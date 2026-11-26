/**
 * Keyboard shortcuts. Space makes a new palette, 1–5 pick a colour, L locks it, C copies its hex,
 * Ctrl/Cmd+Z undoes and Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y redoes.
 *
 * Space works wherever the focus is, except where Space means something itself:
 * - in a text field or a select (it types a space or opens the list), where no shortcut runs at all;
 * - on a button, link or tab that was reached with the keyboard (it presses it).
 * A button that has focus only because it was clicked (a swatch, say) does not keep Space, so clicking a colour and
 * then pressing Space still makes a new palette instead of pressing that button again.
 */

/** Where the key was pressed, as far as shortcuts care. */
export type KeyTarget = 'text' | 'control' | 'other';

export interface KeyPress {
  key: string;
  code: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

export type Shortcut =
  | { kind: 'generate' }
  | { kind: 'undo' }
  | { kind: 'redo' }
  | { kind: 'select'; index: number }
  | { kind: 'lock' }
  | { kind: 'copy' };

export function shortcutFor(press: KeyPress, target: KeyTarget): Shortcut | null {
  if (press.altKey || target === 'text') return null;
  const key = press.key.toLowerCase();
  if (press.ctrlKey || press.metaKey) {
    if (key === 'z') return { kind: press.shiftKey ? 'redo' : 'undo' };
    if (key === 'y') return { kind: 'redo' };
    return null;
  }
  if (press.code === 'Space' || press.key === ' ') return target === 'control' ? null : { kind: 'generate' };
  if (/^[1-5]$/.test(key)) return { kind: 'select', index: Number(key) - 1 };
  if (key === 'l') return { kind: 'lock' };
  if (key === 'c') return { kind: 'copy' };
  return null;
}

const SPACE_PRESSES_INPUT = new Set(['button', 'checkbox', 'radio', 'reset', 'submit']);

/**
 * Sorts the focused element into the targets above. A range slider is "other": Space does nothing on it.
 * `focusedByPointer` says the element got focus from a click or tap rather than from the keyboard. (The browser's
 * own :focus-visible cannot tell: Chrome turns it on for the focused button as soon as any key is pressed.)
 */
export function keyTargetOf(target: EventTarget | null, focusedByPointer: boolean): KeyTarget {
  if (!(target instanceof HTMLElement)) return 'other';
  if (target.isContentEditable || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) {
    return 'text';
  }
  if (target instanceof HTMLInputElement) {
    if (target.type === 'range') return 'other';
    return SPACE_PRESSES_INPUT.has(target.type) ? 'control' : 'text';
  }
  if (target.matches('button, a[href], [role="tab"], summary')) {
    return focusedByPointer ? 'other' : 'control';
  }
  return 'other';
}

/** Listens for the shortcuts on the whole document and runs `run` for each one. */
export function initShortcuts(run: (shortcut: Shortcut) => void): void {
  // Remember the element that a pointer press focused; focus that arrives any other way (Tab, script) clears it.
  let pointerDown = false;
  let pointerFocused: EventTarget | null = null;
  const onPointerDown = (): void => {
    pointerDown = true;
    window.setTimeout(() => {
      pointerDown = false;
    });
  };
  document.addEventListener('pointerdown', onPointerDown, true);
  document.addEventListener('focusin', (event) => {
    pointerFocused = pointerDown ? event.target : null;
  });
  document.addEventListener('keydown', (event) => {
    if (event.defaultPrevented) return;
    const shortcut = shortcutFor(event, keyTargetOf(event.target, event.target === pointerFocused));
    if (!shortcut) return;
    // Space would otherwise scroll the page or press a clicked button.
    event.preventDefault();
    run(shortcut);
  });
}
