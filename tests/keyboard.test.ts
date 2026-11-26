import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initShortcuts, keyTargetOf, repeats, shortcutFor, type KeyPress } from '../src/keyboard';

const press = (key: string, extra: Partial<KeyPress> = {}): KeyPress => ({
  key,
  code: key === ' ' ? 'Space' : `Key${key.toUpperCase()}`,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  altKey: false,
  ...extra,
});

describe('shortcutFor', () => {
  it('makes a new palette with Space', () => {
    // A swatch button that has focus only because it was clicked counts as "other", so Space still generates.
    expect(shortcutFor(press(' '), 'other')).toEqual({ kind: 'generate' });
    expect(shortcutFor(press(' ', { code: '' }), 'other')).toEqual({ kind: 'generate' });
  });

  it('leaves Space to a keyboard-focused button, link or tab, and every key to text fields', () => {
    expect(shortcutFor(press(' '), 'control')).toBeNull();
    for (const key of [' ', '1', 'l', 'c', 'z']) expect(shortcutFor(press(key), 'text')).toBeNull();
    expect(shortcutFor(press('z', { ctrlKey: true }), 'text')).toBeNull();
  });

  it('picks, locks and copies with 1–5, L and C anywhere outside a text field', () => {
    expect(shortcutFor(press('1'), 'other')).toEqual({ kind: 'select', index: 0 });
    expect(shortcutFor(press('5'), 'control')).toEqual({ kind: 'select', index: 4 });
    expect(shortcutFor(press('6'), 'other')).toBeNull();
    expect(shortcutFor(press('L', { shiftKey: true }), 'other')).toEqual({ kind: 'lock' });
    expect(shortcutFor(press('c'), 'control')).toEqual({ kind: 'copy' });
  });

  it('undoes with Ctrl or Cmd+Z and redoes with Shift or Y', () => {
    expect(shortcutFor(press('z', { ctrlKey: true }), 'other')).toEqual({ kind: 'undo' });
    expect(shortcutFor(press('z', { metaKey: true }), 'control')).toEqual({ kind: 'undo' });
    expect(shortcutFor(press('Z', { ctrlKey: true, shiftKey: true }), 'other')).toEqual({ kind: 'redo' });
    expect(shortcutFor(press('y', { ctrlKey: true }), 'other')).toEqual({ kind: 'redo' });
  });

  it('leaves browser shortcuts alone', () => {
    expect(shortcutFor(press('c', { ctrlKey: true }), 'other')).toBeNull();
    expect(shortcutFor(press('l', { metaKey: true }), 'other')).toBeNull();
    expect(shortcutFor(press('1', { altKey: true }), 'other')).toBeNull();
    expect(shortcutFor(press('Enter', { code: 'Enter' }), 'other')).toBeNull();
  });
});

describe('repeats', () => {
  it('makes one palette per Space press, however long it is held', () => {
    expect(repeats({ kind: 'generate' })).toBe(false);
    expect(repeats({ kind: 'lock' })).toBe(false);
    expect(repeats({ kind: 'copy' })).toBe(false);
  });

  it('lets undo, redo and picking a colour repeat while held', () => {
    expect(repeats({ kind: 'undo' })).toBe(true);
    expect(repeats({ kind: 'redo' })).toBe(true);
    expect(repeats({ kind: 'select', index: 2 })).toBe(true);
  });
});

describe('keyTargetOf', () => {
  // Just enough of the DOM element classes for the checks keyTargetOf makes.
  class FakeElement extends EventTarget {
    isContentEditable = false;
    constructor(readonly tag: string) {
      super();
    }
    matches(selector: string): boolean {
      return selector.split(', ').some((part) => part.split(/[[.]/)[0] === this.tag);
    }
  }
  class FakeInput extends FakeElement {
    constructor(readonly type: string) {
      super('input');
    }
  }
  class FakeTextArea extends FakeElement {}
  class FakeSelect extends FakeElement {}

  beforeEach(() => {
    vi.stubGlobal('HTMLElement', FakeElement);
    vi.stubGlobal('HTMLInputElement', FakeInput);
    vi.stubGlobal('HTMLTextAreaElement', FakeTextArea);
    vi.stubGlobal('HTMLSelectElement', FakeSelect);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('lets Space make a palette on a button that has focus only because it was clicked', () => {
    // The bug: clicking a swatch left focus on its Edit button, and Space pressed that button instead.
    const swatch = new FakeElement('button');
    expect(keyTargetOf(swatch, true)).toBe('other');
    expect(shortcutFor(press(' '), keyTargetOf(swatch, true))).toEqual({ kind: 'generate' });
  });

  it('leaves Space to a button reached with the keyboard', () => {
    expect(keyTargetOf(new FakeElement('button'), false)).toBe('control');
    expect(keyTargetOf(new FakeElement('a'), false)).toBe('control');
    expect(shortcutFor(press(' '), keyTargetOf(new FakeElement('button'), false))).toBeNull();
  });

  it('keeps every key for text fields and selects, but not for sliders', () => {
    expect(keyTargetOf(new FakeInput('text'), false)).toBe('text');
    expect(keyTargetOf(new FakeInput('text'), true)).toBe('text');
    expect(keyTargetOf(new FakeTextArea('textarea'), false)).toBe('text');
    expect(keyTargetOf(new FakeSelect('select'), false)).toBe('text');
    expect(keyTargetOf(new FakeInput('checkbox'), false)).toBe('control');
    expect(keyTargetOf(new FakeInput('range'), false)).toBe('other');
    expect(keyTargetOf(new FakeElement('section'), false)).toBe('other');
    expect(keyTargetOf(null, false)).toBe('other');
  });
});

/** A key event as initShortcuts reads it. */
const keyEvent = (type: string, init: Partial<KeyPress> & { repeat?: boolean } = {}): Event =>
  Object.assign(new Event(type, { cancelable: true }), { ...press(' '), repeat: false, ...init });

/** A document to listen on; no element is focused, so every key lands on it. */
function listen(): { doc: EventTarget; ran: string[] } {
  const doc = new EventTarget();
  vi.stubGlobal('document', doc);
  vi.stubGlobal('window', { setTimeout: (fn: () => void) => setTimeout(fn) });
  vi.stubGlobal('HTMLElement', class NoElement extends Error {});
  const ran: string[] = [];
  initShortcuts((shortcut) => ran.push(shortcut.kind));
  return { doc, ran };
}

describe('initShortcuts', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('makes one palette for a held Space and cancels its release', () => {
    const { doc, ran } = listen();
    const first = keyEvent('keydown');
    const held = keyEvent('keydown', { repeat: true });
    doc.dispatchEvent(first);
    doc.dispatchEvent(held);
    expect(ran).toEqual(['generate']);
    expect(first.defaultPrevented).toBe(true);
    expect(held.defaultPrevented).toBe(true);

    const release = keyEvent('keyup');
    doc.dispatchEvent(release);
    expect(release.defaultPrevented).toBe(true);
    // A later release of a Space the app did not use is left alone.
    const other = keyEvent('keyup');
    doc.dispatchEvent(other);
    expect(other.defaultPrevented).toBe(false);
  });

  it('keeps undoing while Ctrl+Z is held', () => {
    const { doc, ran } = listen();
    doc.dispatchEvent(keyEvent('keydown', { key: 'z', code: 'KeyZ', ctrlKey: true }));
    doc.dispatchEvent(keyEvent('keydown', { key: 'z', code: 'KeyZ', ctrlKey: true, repeat: true }));
    expect(ran).toEqual(['undo', 'undo']);
  });
});
