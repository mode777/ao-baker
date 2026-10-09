import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { applyBakedColors, collectSceneBakeData } from './assembly';

function makeScene(): {
  root: THREE.Group;
  indexedMesh: THREE.Mesh;
  plainMesh: THREE.Mesh;
} {
  const geometryA = new THREE.BufferGeometry();
  geometryA.setAttribute(
    'position',
    new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 0, 1, 1, 0, 1], 3),
  );
  geometryA.setAttribute(
    'normal',
    new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3),
  );
  geometryA.setIndex([0, 1, 2, 0, 2, 3]);
  const indexedMesh = new THREE.Mesh(geometryA, new THREE.MeshStandardMaterial());

  const geometryB = new THREE.BufferGeometry();
  geometryB.setAttribute(
    'position',
    new THREE.Float32BufferAttribute([0, 0, 0, 2, 0, 0, 0, 0, 2], 3),
  );
  const plainMesh = new THREE.Mesh(geometryB, new THREE.MeshStandardMaterial());
  plainMesh.position.set(5, 0, 0);

  const root = new THREE.Group();
  root.add(indexedMesh, plainMesh);
  return { root, indexedMesh, plainMesh };
}

describe('collectSceneBakeData', () => {
  it('collects meshes in traversal order with local positions and world matrices', () => {
    const { root, plainMesh } = makeScene();
    const data = collectSceneBakeData(root);
    expect(data.objects).toHaveLength(2);
    expect(data.vertexCounts).toEqual([4, 3]);
    expect(data.meshes[0].index).toBeInstanceOf(Uint32Array);
    expect(data.meshes[1].index).toBeNull();

    // positions stay local; the world transform travels alongside them
    const local = data.meshes[1].positions;
    expect(local[0]).toBe(0);
    expect(data.meshes[1].worldMatrix[12]).toBeCloseTo(plainMesh.position.x);
  });
});

describe('applyBakedColors', () => {
  it('writes color attributes sliced per mesh', () => {
    const { root, indexedMesh, plainMesh } = makeScene();
    const data = collectSceneBakeData(root);
    const colors = new Float32Array([0.1, 0.1, 0.1, 0.2, 0.2, 0.2, 0.3, 0.3, 0.3, 0.4, 0.4, 0.4, 0.5, 0.5, 0.5, 0.6, 0.6, 0.6, 0.7, 0.7, 0.7]);
    applyBakedColors(data, colors);

    const colorA = indexedMesh.geometry.getAttribute('color');
    expect(colorA.count).toBe(4);
    expect(colorA.getX(0)).toBeCloseTo(0.1);
    expect(colorA.getX(3)).toBeCloseTo(0.4);

    const colorB = plainMesh.geometry.getAttribute('color');
    expect(colorB.count).toBe(3);
    expect(colorB.getX(0)).toBeCloseTo(0.5);
    expect(colorB.getX(2)).toBeCloseTo(0.7);
  });

  it('rejects mismatched result sizes', () => {
    const { root } = makeScene();
    const data = collectSceneBakeData(root);
    expect(() => applyBakedColors(data, new Float32Array(3))).toThrow();
  });
});
