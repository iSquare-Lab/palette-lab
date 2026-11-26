import { contrastLevel, contrastRatio, formatRatio, wcagLevels, type WcagResult } from './color';
import { $ } from './dom';
import { icons } from './icons';
import { BLACK, WHITE, hexOf, nameOf, rgbOf, state } from './state';

const els = {
  fg: $<HTMLSelectElement>('fg'),
  bg: $<HTMLSelectElement>('bg'),
  swap: $<HTMLButtonElement>('swap'),
  sample: $<HTMLDivElement>('sample'),
  ratio: $<HTMLSpanElement>('ratio-value'),
  badges: $<HTMLUListElement>('badges'),
  matrix: $<HTMLDivElement>('matrix'),
};

const badgeDefs: { key: keyof WcagResult; label: string; detail: string }[] = [
  { key: 'aaNormal', label: 'AA', detail: 'body text, 4.5:1' },
  { key: 'aaLarge', label: 'AA Large', detail: 'large text, 3:1' },
  { key: 'aaaNormal', label: 'AAA', detail: 'body text, 7:1' },
  { key: 'aaaLarge', label: 'AAA Large', detail: 'large text, 4.5:1' },
];

function fillPairSelect(select: HTMLSelectElement, value: number): void {
  const options = [0, 1, 2, 3, 4, WHITE, BLACK].map((i) => {
    const label = i === WHITE || i === BLACK ? nameOf(i) : `${i + 1} · ${hexOf(i).slice(1).toUpperCase()}`;
    return `<option value="${i}">${label}</option>`;
  });
  select.innerHTML = options.join('');
  select.value = String(value);
}

/** Draws the chosen pair, its WCAG badges and the matrix of every pair. */
export function renderContrast(): void {
  fillPairSelect(els.fg, state.fg);
  fillPairSelect(els.bg, state.bg);
  const ratio = contrastRatio(rgbOf(state.fg), rgbOf(state.bg));
  const levels = wcagLevels(ratio);
  els.sample.style.setProperty('--fg', hexOf(state.fg));
  els.sample.style.setProperty('--bg', hexOf(state.bg));
  els.ratio.textContent = formatRatio(ratio, 2);
  els.badges.innerHTML = badgeDefs
    .map(({ key, label, detail }) => {
      const pass = levels[key];
      return `<li class="badge ${pass ? 'is-pass' : 'is-fail'}" title="${detail}">${pass ? icons.check : icons.cross}<span>${label}</span><span class="sr-only">${pass ? 'passes' : 'fails'} (${detail})</span></li>`;
    })
    .join('');
  renderMatrix();
}

function renderMatrix(): void {
  const idx = [0, 1, 2, 3, 4];
  const head = idx
    .map(
      (i) =>
        `<th scope="col"><span class="dot" style="--dot:${hexOf(i)}"></span><span class="sr-only">Background ${nameOf(i)}</span></th>`,
    )
    .join('');
  const rows = idx
    .map((r) => {
      const cells = idx
        .map((c) => {
          if (r === c) return '<td><span class="cell cell-self" aria-label="Same colour">·</span></td>';
          const ratio = contrastRatio(rgbOf(r), rgbOf(c));
          // The cell shows one decimal, cut down like the big ratio, so its colour and its number always agree.
          const shown = formatRatio(ratio, 1);
          const active = state.fg === r && state.bg === c ? ' is-active' : '';
          return `<td><button type="button" class="cell cell-${contrastLevel(ratio)}${active}" data-fg="${r}" data-bg="${c}" aria-label="${nameOf(r)} text on ${nameOf(c)}: ${shown} to 1">${shown}</button></td>`;
        })
        .join('');
      return `<tr><th scope="row"><span class="dot" style="--dot:${hexOf(r)}"></span><span class="sr-only">Text ${nameOf(r)}</span></th>${cells}</tr>`;
    })
    .join('');
  els.matrix.innerHTML = `<table class="matrix-table"><caption class="sr-only">Contrast ratio of each palette colour as text (rows) on each as background (columns)</caption><thead><tr><td></td>${head}</tr></thead><tbody>${rows}</tbody></table>`;
}

export function initContrast(): void {
  els.matrix.addEventListener('click', (event) => {
    const target = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-fg]');
    if (!target) return;
    state.fg = Number(target.dataset.fg);
    state.bg = Number(target.dataset.bg);
    renderContrast();
    els.matrix.querySelector<HTMLButtonElement>(`button[data-fg="${state.fg}"][data-bg="${state.bg}"]`)?.focus();
  });
  els.fg.addEventListener('change', () => {
    state.fg = Number(els.fg.value);
    renderContrast();
  });
  els.bg.addEventListener('change', () => {
    state.bg = Number(els.bg.value);
    renderContrast();
  });
  els.swap.innerHTML = icons.swap;
  els.swap.addEventListener('click', () => {
    [state.fg, state.bg] = [state.bg, state.fg];
    renderContrast();
  });
}
