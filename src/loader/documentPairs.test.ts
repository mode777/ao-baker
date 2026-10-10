import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { loadModel } from './loadModel';
import { pairScenePrimitives } from './documentPairs';
import { buildRichFixtureGlb } from '../testing/fixtures';


describe('pairScenePrimitives', () => {
  it('pairs every three.js mesh with its document primitive in order', async () => {
    const bytes = await buildRichFixtureGlb();
    const { scene, document } = await loadModel({ name: 'rich.glb', bytes });
    const pairs = pairScenePrimitives(scene, document);
    expect(pairs).toHaveLength(2);

    for (const { mesh, primitive } of pairs) {
      const primitiveCount = primitive.getAttribute('POSITION')!.getCount();
      expect(mesh.geometry.getAttribute('position').count).toBe(primitiveCount);
    }
    expect(pairs.some((p) => p.mesh instanceof THREE.SkinnedMesh)).toBe(true);
  });
});
