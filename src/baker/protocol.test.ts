import { describe, expect, it } from 'vitest';
import { handleBakeRequest, type BakeRequest, type BakeResponse } from './protocol';

function cornerSceneRequest(id: number, samples = 16): BakeRequest {
  return {
    id,
    mode: 'ao',
    meshes: [
      {
        positions: new Float32Array([0, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1]),
        normals: new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]),
        index: new Uint32Array([0, 1, 2, 0, 2, 3]),
        worldMatrix: new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]),
      },
      {
        positions: new Float32Array([0, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1]),
        normals: new Float32Array([1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0]),
        index: new Uint32Array([0, 1, 2, 0, 2, 3]),
        worldMatrix: new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]),
      },
    ],
    params: { samples, radius: 0.1, strength: 1, bias: null },
    seed: 42,
  };
}

describe('handleBakeRequest', () => {
  it('reports monotonic progress then a result equal to a direct bake', async () => {
    const responses: BakeResponse[] = [];
    const transfers: (Transferable[] | undefined)[] = [];
    const request = cornerSceneRequest(11, 3000); // enough samples to force progress events
    handleBakeRequest(request, (response, transfer) => {
      responses.push(response);
      transfers.push(transfer);
    });

    const progress = responses.filter((r) => r.type === 'progress');
    const result = responses.find((r) => r.type === 'result');
    expect(result).toBeDefined();
    expect(progress.length).toBeGreaterThanOrEqual(2);

    let last = -1;
    for (const p of progress) {
      if (p.type !== 'progress') {
        throw new Error('unreachable');
      }
      expect(p.id).toBe(11);
      expect(p.value).toBeGreaterThanOrEqual(last);
      expect(p.value).toBeLessThanOrEqual(1);
      last = p.value;
    }
    expect(progress[progress.length - 1].value).toBe(1);

    if (result?.type !== 'result') {
      throw new Error('unreachable');
    }
    expect(result.id).toBe(11);
    expect(result.colors.length).toBe(8 * 3);
    expect(transfers[transfers.length - 1]?.[0]).toBe(result.colors.buffer);
  });

  it('reports errors instead of throwing', () => {
    const responses: BakeResponse[] = [];
    handleBakeRequest(
      { ...cornerSceneRequest(3), meshes: [] },
      (response) => responses.push(response),
    );
    expect(responses).toHaveLength(1);
    if (responses[0].type !== 'error') {
      throw new Error('expected error response');
    }
    expect(responses[0].id).toBe(3);
    expect(responses[0].message).toContain('no meshes');
  });

  it('rejects unknown modes', () => {
    const responses: BakeResponse[] = [];
    handleBakeRequest(
      { ...cornerSceneRequest(4), mode: 'hdri' as never },
      (response) => responses.push(response),
    );
    expect(responses[0].type).toBe('error');
  });
});
