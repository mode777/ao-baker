import type { AOBakeParams } from '../baker/modes/ao';

export type BakeLifecycle = 'idle' | 'baking' | 'baked';

/** Sidebar-facing parameters (bias split into auto flag + absolute value). */
export interface BakeUiParams {
  samples: number;
  radius: number;
  strength: number;
  biasAuto: boolean;
  bias: number;
}

export const DEFAULT_UI_PARAMS: BakeUiParams = {
  samples: 32,
  radius: 0.1,
  strength: 1,
  biasAuto: true,
  bias: 0.001,
};

export type BakeStoreListener = () => void;

/**
 * Single source of truth for the bake lifecycle. Guards re-entrancy (double
 * bake, bake without model) and owns the "model changed" reset.
 */
export class BakeStore {
  private listeners = new Set<BakeStoreListener>();
  private hasModel = false;
  private hasResult = false;

  lifecycle: BakeLifecycle = 'idle';
  params: BakeUiParams = { ...DEFAULT_UI_PARAMS };
  progress = 0;

  subscribe(listener: BakeStoreListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  /** Returns the engine params for the staged UI params. */
  engineParams(): AOBakeParams {
    return {
      samples: this.params.samples,
      radius: this.params.radius,
      strength: this.params.strength,
      bias: this.params.biasAuto ? null : this.params.bias,
    };
  }

  /** Called when a new model is loaded; clears results and parameters. */
  resetModel(hasModel: boolean): void {
    this.hasModel = hasModel;
    this.hasResult = false;
    this.progress = 0;
    this.params = { ...DEFAULT_UI_PARAMS };
    this.lifecycle = 'idle';
    this.notify();
  }

  stageParam<K extends keyof BakeUiParams>(key: K, value: BakeUiParams[K]): void {
    this.params = { ...this.params, [key]: value };
    this.notify();
  }

  canStartBake(): boolean {
    return this.hasModel && this.lifecycle !== 'baking';
  }

  startBake(): void {
    if (!this.canStartBake()) {
      return;
    }
    this.lifecycle = 'baking';
    this.progress = 0;
    this.notify();
  }

  setProgress(value: number): void {
    if (this.lifecycle !== 'baking') {
      return;
    }
    this.progress = value;
    this.notify();
  }

  bakeFinished(): void {
    if (this.lifecycle !== 'baking') {
      return;
    }
    this.hasResult = true;
    this.lifecycle = 'baked';
    this.progress = 1;
    this.notify();
  }

  /** Cancel discards partial work; a previous bake's colors remain. */
  bakeCancelled(): void {
    if (this.lifecycle !== 'baking') {
      return;
    }
    this.lifecycle = this.hasResult ? 'baked' : 'idle';
    this.progress = 0;
    this.notify();
  }
}
