import * as THREE from 'three';
import './style.css';
import { createViewer } from './viewer/viewer';
import { applyViewMode, type ViewMode } from './viewer/viewModes';
import { loadModel } from './loader/loadModel';
import { pairScenePrimitives } from './loader/documentPairs';
import { isGlbBinary, validateScene } from './loader/validate';
import { injectVertexColors, serializeGlb } from './export/exportGlb';
import { downloadBytes } from './export/download';
import { createDropzone } from './ui/dropzone';
import { createSidebar } from './ui/sidebar';
import { BakeStore, DEFAULT_UI_PARAMS } from './bake/bakeState';
import { BakeClient } from './baker/client';
import { DEFAULT_PRESET_ID } from './bake/presets';
import { combineWithExisting, type CombinePolicy } from './bake/combine';
import {
  applyBakedColors,
  collectSceneBakeData,
  type SceneBakeData,
} from './bake/assembly';
import type { Document } from '@gltf-transform/core';

const root = document.querySelector<HTMLDivElement>('#app');
const viewport = document.querySelector<HTMLDivElement>('#viewport');
if (!root || !viewport) {
  throw new Error('app markup missing');
}

// dismissible non-blocking warning banner (e.g. large scenes)
const warningBanner = document.createElement('div');
warningBanner.id = 'warning-banner';
warningBanner.hidden = true;
const warningText = document.createElement('span');
const warningClose = document.createElement('button');
warningClose.textContent = '×';
warningClose.addEventListener('click', () => {
  warningBanner.hidden = true;
});
warningBanner.append(warningText, warningClose);
root.appendChild(warningBanner);

const viewer = createViewer(viewport);
const store = new BakeStore();

let model: THREE.Object3D | null = null;
let bakeData: SceneBakeData | null = null;
let document_: Document | null = null;
let rawBakedColors: Float32Array | null = null;
let bakedColors: Float32Array | null = null;
let currentFileName = 'model.glb';
let combinePolicy: CombinePolicy = 'overwrite';
let viewMode: ViewMode = 'baked';

function applyEffectiveColors(): void {
  if (!bakeData || !rawBakedColors) {
    return;
  }
  bakedColors = combineWithExisting(bakeData, rawBakedColors, combinePolicy);
  applyBakedColors(bakeData, bakedColors);
  if (model) {
    applyViewMode(model, viewMode);
  }
}

const client = new BakeClient({
  onProgress: (value) => store.setProgress(value),
  onResult: (colors) => {
    if (!bakeData) {
      return;
    }
    rawBakedColors = colors;
    applyEffectiveColors();
    store.bakeFinished();
  },
  onError: (message) => {
    store.bakeCancelled();
    dropzone.setError(`Bake failed: ${message}`);
  },
});

const sidebar = createSidebar(root, {
  onBake: () => {
    if (!store.canStartBake() || !bakeData) {
      return;
    }
    store.startBake();
    // fresh seed per bake; engine stays deterministic for a given seed
    const seed = Math.floor(Math.random() * 0x7fffffff);
    client.bake(bakeData.meshes, store.engineParams(), seed);
  },
  onCancel: () => {
    client.cancel();
    store.bakeCancelled();
  },
  onExport: () => {
    exportModel().catch((error: unknown) => {
      dropzone.setError(
        error instanceof Error ? `Export failed: ${error.message}` : 'Export failed',
      );
    });
  },
  onPreset: (params) => {
    for (const [key, value] of Object.entries(params)) {
      store.stageParam(key as keyof typeof DEFAULT_UI_PARAMS, value);
    }
    sidebar.setParams(params);
  },
  onCombinePolicy: (policy) => {
    combinePolicy = policy;
    if (rawBakedColors) {
      applyEffectiveColors();
    }
  },
  onViewMode: (mode) => {
    viewMode = mode;
    sidebar.setViewMode(mode);
    if (model) {
      applyViewMode(model, mode);
    }
  },
});
sidebar.setViewMode(viewMode);
// mark the default preset as active
document
  .querySelector(`#presets button[data-preset="${DEFAULT_PRESET_ID}"]`)
  ?.classList.add('active');

store.subscribe(() => {
  sidebar.setLifecycle(store.lifecycle, store.progress);
});

async function exportModel(): Promise<void> {
  if (!model || !document_ || !bakedColors || !bakeData) {
    return;
  }
  const pairs = pairScenePrimitives(model, document_);
  injectVertexColors(document_, pairs, bakedColors, bakeData.vertexCounts);
  const bytes = await serializeGlb(document_);
  const base = currentFileName.replace(/\.glb$/i, '');
  downloadBytes(bytes, `${base}-baked.glb`);
}

async function loadAndShow(file: File): Promise<void> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!isGlbBinary(bytes)) {
    throw new Error('this file is not a glTF binary (GLB)');
  }
  const loaded = await loadModel(
    new File([bytes.buffer as ArrayBuffer], file.name, { type: file.type }),
  );
  client.cancel();
  model = loaded.scene;
  document_ = loaded.document;
  currentFileName = file.name;
  rawBakedColors = null;
  bakedColors = null;
  viewer.setModel(loaded.scene);
  const data = collectSceneBakeData(loaded.scene);
  const issues = validateScene(data);
  const error = issues.find((issue) => issue.kind === 'error');
  if (error) {
    throw new Error(error.message.toLowerCase());
  }
  bakeData = data;
  const warning = issues.find((issue) => issue.kind === 'warning');
  if (warning) {
    warningText.textContent = warning.message;
    warningBanner.hidden = false;
  } else {
    warningBanner.hidden = true;
  }
  store.resetModel(true);
  sidebar.setParams({ ...DEFAULT_UI_PARAMS });
  document
    .querySelector(`#presets button[data-preset="${DEFAULT_PRESET_ID}"]`)
    ?.classList.add('active');
  applyViewMode(loaded.scene, viewMode);
  sidebar.root.hidden = false;
  dropzone.setEmptyState(false);
}

const dropzone = createDropzone(root, (file) => {
  dropzone.setError(null);
  warningBanner.hidden = true;
  loadAndShow(file).catch((error: unknown) => {
    dropzone.setError(
      error instanceof Error ? `Could not load model: ${error.message}` : 'Could not load model',
    );
  });
});

// Test/debug hook: lets headless verification inspect bake state without
// reaching into three.js internals.
(window as unknown as Record<string, unknown>).__aoBakerDebug = {
  meshCount: () => bakeData?.objects.length ?? 0,
  colorAttributeLengths: () =>
    bakeData?.objects.map((mesh) => mesh.geometry.getAttribute('color')?.count ?? -1) ?? [],
  positionCounts: () =>
    bakeData?.objects.map((mesh) => mesh.geometry.getAttribute('position')?.count ?? -1) ?? [],
  lifecycle: () => store.lifecycle,
  colorSample: (meshIndex: number, vertexIndex: number) => {
    const mesh = bakeData?.objects[meshIndex];
    if (!mesh) {
      return null;
    }
    const color = mesh.geometry.getAttribute('color');
    if (!color || vertexIndex >= color.count) {
      return null;
    }
    return [color.getX(vertexIndex), color.getY(vertexIndex), color.getZ(vertexIndex)];
  },
};
