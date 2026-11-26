import { $, copyText } from './dom';
import { EXPORT_LABELS, exportPalette, type ExportFormat } from './export';
import { icons } from './icons';
import { state } from './state';

const els = {
  tabs: $<HTMLDivElement>('export-tabs'),
  panel: $<HTMLDivElement>('export-panel'),
  code: $<HTMLElement>('export-code'),
  copy: $<HTMLButtonElement>('copy-export'),
};

const formats = Object.keys(EXPORT_LABELS) as ExportFormat[];
let tabButtons: HTMLButtonElement[] = [];

export function renderExport(): void {
  els.code.textContent = exportPalette(state.colors, state.format);
}

/** Shows one format; tabs follow the ARIA pattern (one tab stop, arrows, Home and End move between them). */
function selectFormat(format: ExportFormat, focus = false): void {
  state.format = format;
  for (const tab of tabButtons) {
    const active = tab.dataset.format === format;
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
    if (active && focus) tab.focus();
  }
  els.panel.setAttribute('aria-labelledby', `tab-${format}`);
  renderExport();
}

export function initExport(): void {
  els.tabs.innerHTML = formats
    .map(
      (f) =>
        `<button type="button" role="tab" class="tab" id="tab-${f}" data-format="${f}" aria-controls="export-panel">${EXPORT_LABELS[f]}</button>`,
    )
    .join('');
  tabButtons = [...els.tabs.querySelectorAll<HTMLButtonElement>('[role="tab"]')];

  els.tabs.addEventListener('click', (event) => {
    const tab = (event.target as HTMLElement).closest<HTMLButtonElement>('[role="tab"]');
    if (tab) selectFormat(tab.dataset.format as ExportFormat);
  });
  els.tabs.addEventListener('keydown', (event) => {
    const current = formats.indexOf(state.format);
    let next = -1;
    if (event.key === 'ArrowRight') next = (current + 1) % formats.length;
    else if (event.key === 'ArrowLeft') next = (current - 1 + formats.length) % formats.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = formats.length - 1;
    if (next >= 0) {
      event.preventDefault();
      selectFormat(formats[next], true);
    }
  });

  els.copy.innerHTML = `${icons.copy}<span>Copy</span>`;
  els.copy.addEventListener('click', () => void copyText(els.code.textContent ?? '', EXPORT_LABELS[state.format]));

  selectFormat(state.format);
}
