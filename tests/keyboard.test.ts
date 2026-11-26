import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { keyTargetOf, shortcutFor, type KeyPress } from '../src/keyboard';

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

describe('keyTargetOf', () => {
  // Just enough of the DOM element classes for the checks keyTargetOf makes.
  class FakeElement extends EventTarget {
    isContentEditable = false;
    constructor(
      readonly tag: string,
      readonly focusVisible = false,
    ) {
      super();
    }
    matches(selector: string): boolean {
      if (selector === ':focus-visible') return this.focusVisible;
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
    const clickedSwatch = new FakeElement('button', false);
    expect(keyTargetOf(clickedSwatch)).toBe('other');
    expect(shortcutFor(press(' '), keyTargetOf(clickedSwatch))).toEqual({ kind: 'generate' });
  });

  it('leaves Space to a button reached with the keyboard', () => {
    expect(keyTargetOf(new FakeElement('button', true))).toBe('control');
    expect(keyTargetOf(new FakeElement('a', true))).toBe('control');
  });

  it('keeps every key for text fields and selects, but not for sliders', () => {
    expect(keyTargetOf(new FakeInput('text'))).toBe('text');
    expect(keyTargetOf(new FakeTextArea('textarea'))).toBe('text');
    expect(keyTargetOf(new FakeSelect('select'))).toBe('text');
    expect(keyTargetOf(new FakeInput('checkbox'))).toBe('control');
    expect(keyTargetOf(new FakeInput('range'))).toBe('other');
    expect(keyTargetOf(new FakeElement('section'))).toBe('other');
    expect(keyTargetOf(null)).toBe('other');
  });
});
