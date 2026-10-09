import type { AOBakeParams } from './modes/ao';
import type { BakeMeshInput } from './types';
import type { BakeRequest, BakeResponse } from './protocol';

export interface WorkerLike {
  postMessage(message: BakeRequest, transfer?: Transferable[]): void;
  terminate(): void;
  onmessage: ((event: MessageEvent<BakeResponse>) => void) | null;
}

export type WorkerFactory = () => WorkerLike;

export interface BakeClientHandlers {
  onProgress?: (value: number) => void;
  onResult?: (colors: Float32Array) => void;
  onError?: (message: string) => void;
}

function defaultWorkerFactory(): WorkerLike {
  const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  return {
    postMessage: (message, transfer) => worker.postMessage(message, transfer ?? []),
    terminate: () => worker.terminate(),
    set onmessage(handler: ((event: MessageEvent<BakeResponse>) => void) | null) {
      worker.onmessage = handler;
    },
    get onmessage() {
      return worker.onmessage;
    },
  };
}

/**
 * Main-thread handle for the bake worker. One worker at a time; cancel
 * terminates and the next bake respawns (BVH rebuild cost accepted).
 */
export class BakeClient {
  private worker: WorkerLike | null = null;
  private nextId = 1;
  private activeId: number | null = null;

  constructor(
    private handlers: BakeClientHandlers,
    private workerFactory: WorkerFactory = defaultWorkerFactory,
  ) {}

  get busy(): boolean {
    return this.activeId !== null;
  }

  bake(meshes: BakeMeshInput[], params: AOBakeParams, seed: number): void {
    if (this.busy) {
      return;
    }
    if (!this.worker) {
      this.worker = this.workerFactory();
      this.worker.onmessage = (event) => this.handleResponse(event.data);
    }
    const id = this.nextId++;
    this.activeId = id;
    // Request buffers are structured-cloned (NOT transferred): the app keeps
    // the collected bake data alive for re-bakes. Only the worker's freshly
    // created result buffer is transferred back.
    this.worker.postMessage({ id, mode: 'ao', meshes, params, seed });
  }

  /** Cancels any in-flight bake. Results of previous bakes are untouched. */
  cancel(): void {
    if (!this.worker) {
      return;
    }
    this.worker.terminate();
    this.worker = null;
    this.activeId = null;
  }

  dispose(): void {
    this.cancel();
  }

  private handleResponse(response: BakeResponse): void {
    if (response.id !== this.activeId) {
      return; // stale response (e.g. after cancel raced a respawn)
    }
    if (response.type === 'progress') {
      this.handlers.onProgress?.(response.value);
    } else if (response.type === 'result') {
      this.activeId = null;
      this.handlers.onResult?.(response.colors);
    } else {
      this.activeId = null;
      this.handlers.onError?.(response.message);
    }
  }
}
