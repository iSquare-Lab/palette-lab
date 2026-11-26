import {
  MAX_CHROMA,
  formatOklch,
  formatRgb,
  hexToOklch,
  hexToRgb,
  inGamut,
  keepHue,
  maxChromaFor,
  oklchToHex,
  oklchToRgb,
  toGamut,
  type Oklch,
  type Rgb,
} from './color';
import { $, copyText } from './dom';
import { icons } from './icons';
import { state } from './state';

/** How the editor reports edits: `change` on every move, `commit` once an edit is finished (for undo). */
export interface EditorHooks {
  change(next: Oklch, syncInputs: boolean): void;
  commit(): void;
}

const els = {
  title: $<HTMLHeadingElement>('editor-title'),
  chip: $<HTMLSpanElement>('editor-chip'),
  plane: $<HTMLCanvasElement>('plane'),
  marker: $<HTMLSpanElement>('plane-marker'),
  sliderL: $<HTMLInputElement>('slider-l'),
  sliderC: $<HTMLInputElement>('slider-c'),
  sliderH: $<HTMLInputElement>('slider-h'),
  outL: $<HTMLOutputElement>('out-l'),
  outC: $<HTMLOutputElement>('out-c'),
  outH: $<HTMLOutputElement>('out-h'),
  gamutNote: $<HTMLParagraphElement>('gamut-note'),
  hexInput: $<HTMLInputElement>('hex-input'),
  hexError: $<HTMLParagraphElement>('hex-error'),
  rgbText: $<HTMLElement>('rgb-text'),
  oklchText: $<HTMLElement>('oklch-text'),
};

const current = (): Oklch => state.colors[state.selected];

/* ---------- lightness × chroma plane ---------- */

const planeCtx = els.plane.getContext('2d');
let planeHue = -1;

/** Paints every displayable lightness and chroma at one hue; colours outside sRGB stay transparent. */
function drawPlane(h: number): void {
  if (!planeCtx) return;
  const { width, height } = els.plane;
  const image = planeCtx.createImageData(width, height);
  const data = image.data;
  for (let y = 0; y < height; y += 1) {
    const l = 1 - y / (height - 1);
    for (let x = 0; x < width; x += 1) {
      const c = (x / (width - 1)) * MAX_CHROMA;
      const rgb = oklchToRgb({ l, c, h });
      const o = (y * width + x) * 4;
      if (inGamut(rgb, 0.002)) {
        data[o] = Math.round(Math.min(1, Math.max(0, rgb.r)) * 255);
        data[o + 1] = Math.round(Math.min(1, Math.max(0, rgb.g)) * 255);
        data[o + 2] = Math.round(Math.min(1, Math.max(0, rgb.b)) * 255);
        data[o + 3] = 255;
      } else {
        data[o + 3] = 0;
      }
    }
  }
  planeCtx.putImageData(image, 0, 0);
  planeHue = h;
}

function trackGradient(make: (t: number) => Oklch, steps = 12): string {
  const stops: string[] = [];
  for (let i = 0; i <= steps; i += 1) stops.push(oklchToHex(make(i / steps)));
  return `linear-gradient(to right, ${stops.join(', ')})`;
}

/** Draws the selected colour; `syncInputs` also moves the sliders and resets the HEX field to it. */
export function renderEditor(syncInputs: boolean): void {
  const i = state.selected;
  const color = current();
  const mapped = toGamut(color);
  const hex = oklchToHex(color);
  const rgb = hexToRgb(hex) as Rgb;

  els.title.textContent = `Edit colour ${i + 1}`;
  els.chip.textContent = hex.toUpperCase();
  els.chip.style.setProperty('--chip', hex);

  if (Math.abs(planeHue - color.h) > 0.01) drawPlane(color.h);
  els.marker.style.left = `${(Math.min(color.c, MAX_CHROMA) / MAX_CHROMA) * 100}%`;
  els.marker.style.top = `${(1 - color.l) * 100}%`;
  els.marker.style.background = hex;

  if (syncInputs) {
    els.sliderL.value = String(+(color.l * 100).toFixed(1));
    els.sliderC.value = String(+color.c.toFixed(3));
    els.sliderH.value = String(+color.h.toFixed(1));
    resetHexInput();
  }
  els.outL.textContent = `${(color.l * 100).toFixed(1)}%`;
  els.outC.textContent = color.c.toFixed(3);
  els.outH.textContent = `${color.h.toFixed(1)}°`;
  els.sliderL.setAttribute('aria-valuetext', `${(color.l * 100).toFixed(1)} percent`);
  els.sliderH.setAttribute('aria-valuetext', `${color.h.toFixed(1)} degrees`);

  els.sliderL.style.setProperty('--track', trackGradient((t) => ({ l: t, c: color.c, h: color.h })));
  els.sliderC.style.setProperty('--track', trackGradient((t) => ({ l: color.l, c: t * MAX_CHROMA, h: color.h })));
  els.sliderH.style.setProperty('--track', trackGradient((t) => ({ l: color.l, c: color.c, h: t * 360 }), 18));

  els.gamutNote.hidden = mapped.c >= color.c - 1e-4;
  els.rgbText.textContent = formatRgb(rgb);
  els.oklchText.textContent = formatOklch(mapped);
}

/** Puts the selected colour back in the HEX field and clears any error. */
function resetHexInput(): void {
  els.hexInput.value = oklchToHex(current()).toUpperCase();
  els.hexInput.removeAttribute('aria-invalid');
  els.hexError.hidden = true;
}

export function initEditor(hooks: EditorHooks): void {
  /* sliders */
  const sliderValues = (): Oklch => ({
    l: Number(els.sliderL.value) / 100,
    c: Number(els.sliderC.value),
    h: Number(els.sliderH.value),
  });
  for (const slider of [els.sliderL, els.sliderC, els.sliderH]) {
    slider.addEventListener('input', () => hooks.change(sliderValues(), false));
    slider.addEventListener('change', () => {
      resetHexInput();
      hooks.commit();
    });
  }

  /* HEX field */
  const commitHex = (): void => {
    const parsed = hexToOklch(els.hexInput.value);
    if (!parsed) {
      els.hexInput.setAttribute('aria-invalid', 'true');
      els.hexError.hidden = false;
      return;
    }
    // The same colour typed again (or Enter followed by blur) is not an edit.
    if (oklchToHex(parsed) === oklchToHex(current())) {
      resetHexInput();
      return;
    }
    hooks.change(keepHue(parsed, current()), true);
    hooks.commit();
  };
  els.hexInput.addEventListener('change', commitHex);
  els.hexInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') commitHex();
    else if (event.key === 'Escape') resetHexInput();
  });
  // Leaving the field with text that is not a colour puts the current colour back instead of keeping the error.
  els.hexInput.addEventListener('blur', () => {
    if (!hexToRgb(els.hexInput.value)) resetHexInput();
  });

  /* plane: drag to pick lightness and chroma at the current hue */
  const pickFromPlane = (event: PointerEvent): void => {
    const rect = els.plane.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));
    const l = 1 - y;
    const h = current().h;
    const c = Math.min(x * MAX_CHROMA, maxChromaFor(l, h));
    hooks.change({ l, c, h }, true);
  };
  let dragging = false;
  els.plane.addEventListener('pointerdown', (event) => {
    dragging = true;
    els.plane.setPointerCapture(event.pointerId);
    pickFromPlane(event);
  });
  els.plane.addEventListener('pointermove', (event) => {
    if (dragging) pickFromPlane(event);
  });
  const endDrag = (): void => {
    if (!dragging) return;
    dragging = false;
    hooks.commit();
  };
  els.plane.addEventListener('pointerup', endDrag);
  els.plane.addEventListener('pointercancel', endDrag);

  /* copy buttons */
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-copy]')) {
    button.innerHTML = icons.copy;
    button.addEventListener('click', () => {
      const color = current();
      const hex = oklchToHex(color);
      const kind = button.dataset.copy;
      if (kind === 'hex') void copyText(hex.toUpperCase(), 'HEX');
      else if (kind === 'rgb') void copyText(formatRgb(hexToRgb(hex) as Rgb), 'RGB');
      else void copyText(formatOklch(toGamut(color)), 'OKLCH');
    });
  }
}
