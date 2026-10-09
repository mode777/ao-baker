import type { BakeLifecycle, BakeUiParams } from '../bake/bakeState';
import { BAKE_PRESETS } from '../bake/presets';
import type { CombinePolicy } from '../bake/combine';
import type { ViewMode } from '../viewer/viewModes';

export interface SidebarCallbacks {
  onBake(): void;
  onCancel(): void;
  onExport(): void;
  onPreset(params: BakeUiParams): void;
  onCombinePolicy(policy: CombinePolicy): void;
  onViewMode(mode: ViewMode): void;
}

export interface Sidebar {
  params(): BakeUiParams;
  setParams(params: BakeUiParams): void;
  setLifecycle(lifecycle: BakeLifecycle, progress: number): void;
  setViewMode(mode: ViewMode): void;
  root: HTMLElement;
}

const VIEW_MODES: { id: ViewMode; label: string }[] = [
  { id: 'original', label: 'Original' },
  { id: 'baked', label: 'Baked' },
  { id: 'aoOnly', label: 'AO only' },
];

function sliderRow(
  label: string,
  min: number,
  max: number,
  step: number,
  onInput: (value: number) => void,
): { row: HTMLDivElement; input: HTMLInputElement; valueLabel: HTMLSpanElement } {
  const row = document.createElement('div');
  row.className = 'param-row';
  const labelEl = document.createElement('label');
  labelEl.textContent = label;
  const input = document.createElement('input');
  input.type = 'range';
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  const valueLabel = document.createElement('span');
  valueLabel.className = 'param-value';
  input.addEventListener('input', () => {
    const value = Number(input.value);
    valueLabel.textContent = String(value);
    onInput(value);
  });
  row.append(labelEl, input, valueLabel);
  return { row, input, valueLabel };
}

export function createSidebar(parent: HTMLElement, callbacks: SidebarCallbacks): Sidebar {
  const root = document.createElement('div');
  root.id = 'sidebar';
  root.hidden = true;

  const title = document.createElement('h2');
  title.textContent = 'Ambient occlusion';
  root.appendChild(title);

  const staged: BakeUiParams = {
    samples: 32,
    radius: 0.1,
    strength: 1,
    biasAuto: true,
    bias: 0.001,
  };

  // presets: parameter snapshots, tweakable after applying
  const presetRow = document.createElement('div');
  presetRow.id = 'presets';
  const presetButtons = BAKE_PRESETS.map((preset) => {
    const button = document.createElement('button');
    button.textContent = preset.label;
    button.title = preset.description;
    button.dataset.preset = preset.id;
    button.addEventListener('click', () => {
      for (const other of presetButtons) {
        other.classList.toggle('active', other === button);
      }
      callbacks.onPreset({ ...preset.params });
    });
    presetRow.appendChild(button);
    return button;
  });
  root.appendChild(presetRow);

  const samples = sliderRow('Samples', 8, 256, 1, (v) => (staged.samples = v));
  const radius = sliderRow('Radius', 0.01, 1, 0.01, (v) => (staged.radius = v));
  const strength = sliderRow('Strength', 0, 2, 0.05, (v) => (staged.strength = v));

  const biasRow = document.createElement('div');
  biasRow.className = 'param-row';
  const biasLabel = document.createElement('label');
  biasLabel.textContent = 'Bias';
  const biasAuto = document.createElement('label');
  biasAuto.className = 'checkbox';
  const biasAutoInput = document.createElement('input');
  biasAutoInput.type = 'checkbox';
  biasAutoInput.checked = true;
  biasAutoInput.addEventListener('change', () => {
    staged.biasAuto = biasAutoInput.checked;
    biasInput.disabled = biasAutoInput.checked;
  });
  biasAuto.append(biasAutoInput, document.createTextNode('auto'));
  const biasInput = document.createElement('input');
  biasInput.type = 'number';
  biasInput.min = '0';
  biasInput.step = '0.0005';
  biasInput.value = '0.001';
  biasInput.disabled = true;
  biasInput.addEventListener('change', () => {
    staged.bias = Math.max(0, Number(biasInput.value) || 0);
  });
  biasRow.append(biasLabel, biasAuto, biasInput);

  const combineRow = document.createElement('div');
  combineRow.className = 'param-row';
  const combineLabel = document.createElement('label');
  combineLabel.textContent = 'Existing colors';
  const combineSelect = document.createElement('select');
  combineSelect.title =
    'Overwrite: replace any existing vertex colors. Multiply: composite baked AO onto the loaded colors.';
  for (const [value, label] of [
    ['overwrite', 'Overwrite'],
    ['multiply', 'Multiply'],
  ] as const) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    combineSelect.appendChild(option);
  }
  combineSelect.addEventListener('change', () => {
    callbacks.onCombinePolicy(combineSelect.value as CombinePolicy);
  });
  combineRow.append(combineLabel, combineSelect);

  const paramsSection = document.createElement('div');
  paramsSection.className = 'params';
  paramsSection.append(samples.row, radius.row, strength.row, biasRow, combineRow);
  root.appendChild(paramsSection);

  const bakeButton = document.createElement('button');
  bakeButton.id = 'bake-button';
  bakeButton.textContent = 'Bake AO';
  bakeButton.addEventListener('click', () => callbacks.onBake());

  const cancelButton = document.createElement('button');
  cancelButton.id = 'cancel-button';
  cancelButton.textContent = 'Cancel';
  cancelButton.hidden = true;
  cancelButton.addEventListener('click', () => callbacks.onCancel());

  const exportButton = document.createElement('button');
  exportButton.id = 'export-button';
  exportButton.textContent = 'Export GLB';
  exportButton.disabled = true;
  exportButton.addEventListener('click', () => callbacks.onExport());

  const progressWrap = document.createElement('div');
  progressWrap.id = 'progress';
  progressWrap.hidden = true;
  const progressBar = document.createElement('div');
  progressBar.id = 'progress-bar';
  progressWrap.appendChild(progressBar);

  const controls = document.createElement('div');
  controls.className = 'controls';
  controls.append(bakeButton, cancelButton, exportButton, progressWrap);
  root.appendChild(controls);

  const modeLabel = document.createElement('h3');
  modeLabel.textContent = 'View';
  const modeGroup = document.createElement('div');
  modeGroup.id = 'view-modes';
  const modeButtons = VIEW_MODES.map(({ id, label }) => {
    const button = document.createElement('button');
    button.textContent = label;
    button.dataset.mode = id;
    button.addEventListener('click', () => callbacks.onViewMode(id));
    modeGroup.appendChild(button);
    return button;
  });
  root.append(modeLabel, modeGroup);

  parent.appendChild(root);

  return {
    root,
    params: () => ({ ...staged }),
    setParams(params: BakeUiParams): void {
      Object.assign(staged, params);
      samples.input.value = String(params.samples);
      samples.valueLabel.textContent = String(params.samples);
      radius.input.value = String(params.radius);
      radius.valueLabel.textContent = String(params.radius);
      strength.input.value = String(params.strength);
      strength.valueLabel.textContent = String(params.strength);
      biasAutoInput.checked = params.biasAuto;
      biasInput.disabled = params.biasAuto;
      biasInput.value = String(params.bias);
    },
    setLifecycle(lifecycle: BakeLifecycle, progress: number): void {
      bakeButton.disabled = lifecycle === 'baking';
      cancelButton.hidden = lifecycle !== 'baking';
      exportButton.disabled = lifecycle !== 'baked';
      progressWrap.hidden = lifecycle !== 'baking';
      // indeterminate until the first sampling progress arrives (BVH build)
      progressBar.classList.toggle('indeterminate', lifecycle === 'baking' && progress <= 0);
      progressBar.style.width = `${Math.round(progress * 100)}%`;
    },
    setViewMode(mode: ViewMode): void {
      for (const button of modeButtons) {
        button.classList.toggle('active', button.dataset.mode === mode);
      }
    },
  };
}
