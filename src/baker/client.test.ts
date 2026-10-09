import { describe, expect, it, vi } from 'vitest';
import { BakeClient, type WorkerLike } from './client';
import type { BakeRequest, BakeResponse } from './protocol';

class FakeWorker implements WorkerLike {
  sent: BakeRequest[] = [];
  terminated = false;
  onmessage: ((event: MessageEvent<BakeResponse>) => void) | null = null;

  postMessage(message: BakeRequest): void {
    this.sent.push(message);
  }

  terminate(): void {
    this.terminated = true;
  }

  respond(response: BakeResponse): void {
    this.onmessage?.(new MessageEvent('message', { data: response }));
  }
}

function quietMesh(): Parameters<BakeClient['bake']>[0] {
  return [
    {
      positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 0, 1]),
      normals: new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0]),
      index: null,
      worldMatrix: new Float32Array(16).fill(0),
    },
  ];
}

describe('BakeClient', () => {
  it('lazily spawns, correlates progress and result', () => {
    const factory = vi.fn(() => new FakeWorker());
    const progress = vi.fn();
    const result = vi.fn();
    const client = new BakeClient({ onProgress: progress, onResult: result }, factory);

    client.bake(quietMesh(), { samples: 8, radius: 0.1, strength: 1, bias: null }, 1);
    expect(factory).toHaveBeenCalledTimes(1);
    const worker = factory.mock.results[0].value as FakeWorker;
    expect(worker.sent).toHaveLength(1);
    const id = worker.sent[0].id;

    worker.respond({ type: 'progress', id, value: 0.5 });
    expect(progress).toHaveBeenCalledWith(0.5);
    worker.respond({ type: 'progress', id: id + 100, value: 0.9 }); // stale -> ignored
    expect(progress).toHaveBeenCalledTimes(1);

    const colors = new Float32Array(9).fill(1);
    worker.respond({ type: 'result', id, colors });
    expect(result).toHaveBeenCalledWith(colors);
    expect(client.busy).toBe(false);
  });

  it('cancel terminates the worker and respawns on next bake', () => {
    const factory = vi.fn(() => new FakeWorker());
    const result = vi.fn();
    const client = new BakeClient({ onResult: result }, factory);

    client.bake(quietMesh(), { samples: 8, radius: 0.1, strength: 1, bias: null }, 1);
    const first = factory.mock.results[0].value as FakeWorker;
    client.cancel();
    expect(first.terminated).toBe(true);
    expect(client.busy).toBe(false);

    // a late result from the terminated worker must be ignored
    first.respond({ type: 'result', id: first.sent[0].id, colors: new Float32Array(3) });
    expect(result).not.toHaveBeenCalled();

    client.bake(quietMesh(), { samples: 8, radius: 0.1, strength: 1, bias: null }, 2);
    expect(factory).toHaveBeenCalledTimes(2);
    const second = factory.mock.results[1].value as FakeWorker;
    second.respond({ type: 'result', id: second.sent[0].id, colors: new Float32Array(9) });
    expect(result).toHaveBeenCalledTimes(1);
  });

  it('surfaces worker errors', () => {
    const onError = vi.fn();
    const client = new BakeClient({ onError }, () => new FakeWorker());
    client.bake(quietMesh(), { samples: 0, radius: 0.1, strength: 1, bias: null }, 1);
    // engine rejects samples=0; simulate the worker error response
    const worker = (client as unknown as { worker: FakeWorker }).worker;
    worker.respond({ type: 'error', id: worker.sent[0].id, message: 'samples must be a positive integer' });
    expect(onError).toHaveBeenCalledWith('samples must be a positive integer');
    expect(client.busy).toBe(false);
  });
});
