import { bakeAO, DEFAULT_AO_PARAMS, type AOBakeParams } from './modes/ao';
import type { BakeMeshInput } from './types';

/**
 * Identifies the bake mode so future modes (e.g. HDRI lighting) can ride the
 * same protocol without breaking it.
 */
export type BakeModeId = 'ao';

export interface BakeRequest {
  id: number;
  mode: BakeModeId;
  meshes: BakeMeshInput[];
  params: AOBakeParams;
  seed: number;
}

export type BakeResponse =
  | { type: 'progress'; id: number; value: number }
  | { type: 'result'; id: number; colors: Float32Array }
  | { type: 'error'; id: number; message: string };

export const DEFAULT_BAKE_PARAMS: AOBakeParams = DEFAULT_AO_PARAMS;

export type PostResponse = (response: BakeResponse, transfer?: Transferable[]) => void;

/**
 * Executes one bake request and reports progress/result/error through
 * `post`. Runs identically on a worker's message handler and on the main
 * thread (tests).
 */
export function handleBakeRequest(request: BakeRequest, post: PostResponse): void {
  const { id } = request;
  try {
    if (request.mode !== 'ao') {
      throw new Error(`unsupported bake mode: ${request.mode as string}`);
    }
    const colors = bakeAO(request.meshes, request.params, request.seed, (value) => {
      post({ type: 'progress', id, value });
    });
    post({ type: 'result', id, colors }, [colors.buffer]);
  } catch (error) {
    post({
      type: 'error',
      id,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
