import './style.css';
import { formatOklch, formatRgb, hexToRgb, keepHue, oklchToHex, readableOn, toGamut, type Oklch, type Rgb } from './color';
import { initContrast, renderContrast } from './contrast-panel';
import { $, copyText, prefersReducedMotion, toast } from './dom';
import { initEditor, renderEditor } from './editor';
import { initExport, renderExport } from './export-panel';
import { DEFAULT_PALETTE, HARMONY_LABELS, generatePalette, mulberry32, pickHarmony } from './generate';
import { History, type PaletteSnapshot } from './history';
import { icons, logo } from './icons';
import { initShortcuts } from './keyboard';
import { assignRoles } from './roles';
import { decodeHash, encodeHash, type HarmonyChoice, type SharedState } from './share';
import { hexOf, state } from './state';
import { loadSavedPalette, savePalette } from './storage';
import { initTheme } from './theme';

const els = {
  brand: $<HTMLAnchorElement>('brand'),
  brandMark: $<HTMLSpanElement>('brand-mark'),
  swatches: $<HTMLElement>('swatches'),
  harmony: $<HTMLSelectElement>('harmony'),
  harmonyNote: $<HTMLParagraphElement>('harmony-note'),
  generate: $<HTMLButtonElement>('generate'),
  generateIcon: $<HTMLSpanElement>('generate-icon'),
  undo: $<HTMLButtonElement>('undo'),
  redo: $<HTMLButtonElement>('redo'),
  share: $<HTMLButtonElement>('share'),
  theme: $<HTMLButtonElement>('theme'),
  jumpEditor: $<HTMLAnchorElement>('jump-editor'),
  editorPanel: $<HTMLElement>('editor-panel'),
  editorTitle: $<HTMLHeadingElement>('editor-title'),
  workbench: $<HTMLElement>('workbench'),
  mock: $<HTMLDivElement>('mock'),
};

/* ---------- history ---------- */

const undoHistory = new History();

const snapshot = (): PaletteSnapshot => ({ colors: state.colors, locks: state.locks });

function commit(): void {
  undoHistory.push(snapshot());
  updateHistoryButtons();
}

function restore(entry: PaletteSnapshot | null): void {
  if (!entry) return;
  state.colors = entry.colors;
  state.locks = entry.locks;
  renderAll();
  updateHistoryButtons();
}

function updateHistoryButtons(): void {
  els.undo.disabled = !undoHistory.canUndo;
  els.redo.disabled = !undoHistory.canRedo;
}

/* ---------- swatches ---------- */

interface SwatchView {
  root: HTMLDivElement;
  select: HTMLButtonElement;
  lock: HTMLButtonElement;
  copy: HTMLButtonElement;
  hex: HTMLSpanElement;
  oklch: HTMLSpanElement;
  rgb: HTMLSpanElement;
}

const swatchViews: SwatchView[] = state.colors.map((_, i) => {
  const root = document.createElement('div');
  root.className = 'swatch';
  root.innerHTML = `
    <button type="button" class="swatch-select"></button>
    <div class="swatch-tools">
      <button type="button" class="swatch-btn" data-act="lock"></button>
      <button type="button" class="swatch-btn" data-act="copy"></button>
    </div>
    <div class="swatch-info">
      <span class="swatch-index">${String(i + 1).padStart(2, '0')}</span>
      <span class="swatch-hex"></span>
      <span class="swatch-meta swatch-oklch"></span>
      <span class="swatch-meta swatch-rgb"></span>
    </div>
    <span class="swatch-editing" aria-hidden="true">${icons.pen}Editing</span>`;
  els.swatches.append(root);
  const q = <T extends HTMLElement>(sel: string): T => root.querySelector(sel) as T;
  const view: SwatchView = {
    root,
    select: q('.swatch-select'),
    lock: q('[data-act="lock"]'),
    copy: q('[data-act="copy"]'),
    hex: q('.swatch-hex'),
    oklch: q('.swatch-oklch'),
    rgb: q('.swatch-rgb'),
  };
  view.copy.innerHTML = icons.copy;
  view.select.addEventListener('click', () => {
    selectSwatch(i);
    revealEditor();
  });
  view.lock.addEventListener('click', () => toggleLock(i));
  view.copy.addEventListener('click', () => copyHex(i));
  return view;
});

// The palette opens on its own: no colour is marked as being edited until the person picks one or uses the editor.
els.swatches.classList.add('is-idle');
const wake = (): void => els.swatches.classList.remove('is-idle');
els.workbench.addEventListener('input', wake);
els.workbench.addEventListener('pointerdown', wake);

// On a wide window the palette fills the first screen and the editor follows it; a colour clicked brings the editor
// into view when it is below the window.
function revealEditor(always = false): void {
  if (!always && els.editorPanel.getBoundingClientRect().top < window.innerHeight - 120) return;
  els.editorPanel.scrollIntoView({ block: 'start', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
}

// "Edit and check contrast" under the header takes the person to the editor, and keyboard focus with it.
els.jumpEditor.addEventListener('click', (event) => {
  event.preventDefault();
  revealEditor(true);
  els.editorTitle.tabIndex = -1;
  els.editorTitle.focus({ preventScroll: true });
});

function renderSwatches(): void {
  state.colors.forEach((color, i) => {
    const v = swatchViews[i];
    const hex = oklchToHex(color);
    const rgb = hexToRgb(hex) as Rgb;
    const on = readableOn(rgb);
    const locked = state.locks[i];
    v.root.style.setProperty('--sw', hex);
    v.root.style.setProperty('--on', on);
    v.root.classList.toggle('is-dark', on === '#ffffff');
    v.root.classList.toggle('is-selected', state.selected === i);
    v.root.classList.toggle('is-locked', locked);
    v.hex.textContent = hex.slice(1).toUpperCase();
    v.oklch.textContent = formatOklch(toGamut(color));
    v.rgb.textContent = formatRgb(rgb);
    v.select.setAttribute('aria-label', `Edit colour ${i + 1}, ${hex.toUpperCase()}`);
    v.select.setAttribute('aria-pressed', String(state.selected === i));
    v.lock.innerHTML = locked ? icons.lock : icons.unlock;
    v.lock.setAttribute('aria-label', `${locked ? 'Unlock' : 'Lock'} colour ${i + 1}`);
    v.lock.setAttribute('aria-pressed', String(locked));
    v.lock.title = locked ? 'Unlock (L)' : 'Lock (L)';
    v.copy.setAttribute('aria-label', `Copy ${hex.toUpperCase()}`);
    v.copy.title = 'Copy hex (C)';
  });
}

function selectSwatch(i: number): void {
  wake();
  state.selected = i;
  renderSwatches();
  renderEditor(true);
}

function toggleLock(i: number): void {
  state.locks[i] = !state.locks[i];
  commit();
  renderSwatches();
  syncHash();
  toast(state.locks[i] ? `Colour ${i + 1} locked` : `Colour ${i + 1} unlocked`);
}

function copyHex(i: number): void {
  const hex = hexOf(i).toUpperCase();
  void copyText(hex, hex);
}

/* ---------- generation ---------- */

function generate(): void {
  if (state.locks.every(Boolean)) {
    toast('Every colour is locked: unlock one to generate');
    return;
  }
  const harmony = state.harmony === 'auto' ? pickHarmony(Math.random) : state.harmony;
  const seed = Math.floor(Math.random() * 2 ** 32);
  const locked = state.colors.map((c, i) => (state.locks[i] ? c : null));
  state.colors = generatePalette(locked, harmony, mulberry32(seed));
  state.lastHarmony = harmony;
  commit();
  renderAll();
  if (!prefersReducedMotion()) {
    els.swatches.classList.remove('is-fresh');
    void els.swatches.offsetWidth;
    els.swatches.classList.add('is-fresh');
  }
}

/** The brand link starts again from the example palette; Undo brings the previous one back. */
function startOver(): void {
  applyShared({ colors: DEFAULT_PALETTE.map((c) => ({ ...c })), locks: state.locks.map(() => false), harmony: 'auto' });
  state.lastHarmony = null;
  commit();
  renderAll();
  window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  toast('Back to the example palette');
}

const EXAMPLE_HEXES = DEFAULT_PALETTE.map((c) => oklchToHex(c));

/** Names what is on screen: the example palette, the harmony it was generated with, or the person's own palette. */
function renderHarmonyNote(): void {
  const isExample = state.colors.every((c, i) => oklchToHex(c) === EXAMPLE_HEXES[i]);
  const note = isExample
    ? 'Example palette · Dusk, five tones from ink to cream'
    : state.lastHarmony
      ? `${HARMONY_LABELS[state.lastHarmony]} palette`
      : 'Your palette';
  // The note is a live region: only touch it when it changes, so dragging a slider is not read out again and again.
  if (els.harmonyNote.textContent !== note) els.harmonyNote.textContent = note;
}

/* ---------- editing ---------- */

function updateSelected(next: Oklch, syncInputs: boolean): void {
  state.colors[state.selected] = next;
  renderHarmonyNote();
  renderSwatches();
  renderEditor(syncInputs);
  renderContrast();
  renderPreview();
  renderExport();
  scheduleHash();
}

/* ---------- preview ---------- */

/** Styles the example page: each role gets its palette colour and the black or white that reads on it. */
function renderPreview(): void {
  const roles = assignRoles(state.colors);
  for (const [role, i] of Object.entries(roles)) {
    const hex = oklchToHex(state.colors[i]);
    els.mock.style.setProperty(`--${role}`, hex);
    els.mock.style.setProperty(`--on-${role}`, readableOn(hexToRgb(hex) as Rgb));
  }
  state.colors.forEach((c, i) => els.mock.style.setProperty(`--p${i + 1}`, oklchToHex(c)));
}

/* ---------- URL hash and saved palette ---------- */

let hashTimer = 0;
let lastHash = '';

const shared = (): SharedState => ({ colors: state.colors, locks: state.locks, harmony: state.harmony });

/** Writes the palette into the URL hash (so the address is always a share link) and into localStorage. */
function syncHash(): void {
  window.clearTimeout(hashTimer);
  savePalette(shared());
  const hash = encodeHash(shared());
  if (hash === lastHash) return;
  lastHash = hash;
  try {
    window.history.replaceState(null, '', `#${hash}`);
  } catch {
    // Some embedded contexts forbid history changes; sharing still works through the button.
  }
}

function scheduleHash(): void {
  window.clearTimeout(hashTimer);
  hashTimer = window.setTimeout(syncHash, 250);
}

function applyShared(next: SharedState): void {
  state.colors = next.colors;
  state.locks = next.locks;
  state.harmony = next.harmony;
  els.harmony.value = next.harmony;
}

window.addEventListener('hashchange', () => {
  if (window.location.hash.replace(/^#/, '') === lastHash) return;
  const decoded = decodeHash(window.location.hash);
  if (!decoded) return;
  // A grey in the link has no hue; keep the hue that slot had so editing it does not jump to red.
  decoded.colors = decoded.colors.map((c, i) => keepHue(c, state.colors[i]));
  applyShared(decoded);
  lastHash = window.location.hash.replace(/^#/, '');
  state.lastHarmony = null;
  commit();
  renderAll();
});

els.share.innerHTML = icons.link;
els.share.addEventListener('click', () => {
  syncHash();
  const url = `${window.location.origin}${window.location.pathname}#${encodeHash(shared())}`;
  void copyText(url, 'Share link');
});

/* ---------- wiring ---------- */

function renderAll(): void {
  renderHarmonyNote();
  renderSwatches();
  renderEditor(true);
  renderContrast();
  renderPreview();
  renderExport();
  scheduleHash();
}

els.harmony.addEventListener('change', () => {
  state.harmony = els.harmony.value as HarmonyChoice;
  syncHash();
});

els.brandMark.innerHTML = logo;
els.brand.addEventListener('click', (event) => {
  // A plain click starts again here; a modified click still opens the app in a new tab or window.
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  startOver();
});

els.generateIcon.innerHTML = icons.shuffle;
els.generate.addEventListener('click', generate);
els.undo.innerHTML = icons.undo;
els.redo.innerHTML = icons.redo;
els.undo.addEventListener('click', () => restore(undoHistory.undo()));
els.redo.addEventListener('click', () => restore(undoHistory.redo()));

const toggleTheme = initTheme((theme) => {
  els.theme.innerHTML = theme === 'dark' ? icons.sun : icons.moon;
  els.theme.setAttribute('aria-label', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
  const color = theme === 'dark' ? '#131317' : '#f6f4ef';
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) meta.content = color;
});
els.theme.addEventListener('click', toggleTheme);

initEditor({ change: updateSelected, commit });
initContrast();
initExport();
initShortcuts((shortcut) => {
  switch (shortcut.kind) {
    case 'generate':
      generate();
      break;
    case 'undo':
      restore(undoHistory.undo());
      break;
    case 'redo':
      restore(undoHistory.redo());
      break;
    case 'select':
      selectSwatch(shortcut.index);
      break;
    case 'lock':
      toggleLock(state.selected);
      break;
    case 'copy':
      copyHex(state.selected);
      break;
  }
});

/* ---------- start ---------- */

// A link wins; without one, the palette from last time comes back; otherwise the example palette.
const fromLink = decodeHash(window.location.hash);
const saved = fromLink ? null : loadSavedPalette();
if (fromLink) {
  applyShared(fromLink);
  lastHash = window.location.hash.replace(/^#/, '');
} else if (saved) {
  applyShared(saved);
}
commit();
renderAll();
