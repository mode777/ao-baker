import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { loadModel } from './loadModel';
import { pairScenePrimitives } from './documentPairs';
import { buildRichFixtureGlb } from '../testing/fixtures';

function toFile(bytes: Uint8Array, name = 'rich.glb'): File {
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  return new File([copy.buffer as ArrayBuffer], name);
}

describe('pairScenePrimitives', () => {
  it('pairs every three.js mesh with its document primitive in order', async () => {
    const bytes = await buildRichFixtureGlb();
    const { scene, document } = await loadModel(toFile(bytes));
    const pairs = pairScenePrimitives(scene, document);
    expect(pairs).toHaveLength(2);

    for (const { mesh, primitive } of pairs) {
      const primitiveCount = primitive.getAttribute('POSITION')!.getCount();
      expect(mesh.geometry.getAttribute('position').count).toBe(primitiveCount);
    }
    expect(pairs.some((p) => p.mesh instanceof THREE.SkinnedMesh)).toBe(true);
  });
});
