import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { collectSceneBakeData, type SceneBakeData } from './assembly';
import { combineWithExisting } from './combine';

function makeData(existing: (Float32Array | null)[]): SceneBakeData {
  // fake minimal SceneBakeData: one mesh, 2 vertices
  return {
    meshes: [],
    vertexCounts: [2],
    objects: [],
    existingColors: existing,
  };
}

describe('combineWithExisting', () => {
  const baked = new Float32Array([0.5, 0.5, 0.5, 0.25, 0.25, 0.25]);

  it('overwrite returns baked values unchanged', () => {
    const existing = makeData([new Float32Array([1, 0, 0, 0, 1, 0])]);
    const result = combineWithExisting(existing, baked, 'overwrite');
    expect(result).toBe(baked);
  });

  it('multiply composites onto loaded colors', () => {
    const existing = makeData([new Float32Array([0.5, 1, 0.5, 1, 0.5, 1])]);
    const result = combineWithExisting(existing, baked, 'multiply');
    expect(result[0]).toBeCloseTo(0.25);
    expect(result[1]).toBeCloseTo(0.5);
    expect(result[3]).toBeCloseTo(0.25);
    expect(result[4]).toBeCloseTo(0.125);
  });

  it('multiply without existing colors equals overwrite (white base)', () => {
    const clean = makeData([null]);
    const result = combineWithExisting(clean, baked, 'multiply');
    expect(Array.from(result)).toEqual(Array.from(baked));
  });

  it('multiply uses the LOADED colors, not a previous bake output', () => {
    // existing captured at load = 0.5; previous bake would have written 0.25
    const existing = makeData([new Float32Array([0.5, 0.5, 0.5, 0.5, 0.5, 0.5])]);
    const result = combineWithExisting(existing, baked, 'multiply');
    expect(result[0]).toBeCloseTo(0.25);
  });
});

describe('collectSceneBakeData existing colors', () => {
  it('captures colors present at load time', () => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0], 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute([1, 0, 0, 0, 1, 0], 3));
    const scene = new THREE.Group();
    scene.add(new THREE.Mesh(geometry, new THREE.MeshStandardMaterial()));

    const data = collectSceneBakeData(scene);
    expect(data.existingColors).toHaveLength(1);
    expect(Array.from(data.existingColors[0]!)).toEqual([1, 0, 0, 0, 1, 0]);
  });

  it('records null for meshes without colors', () => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0], 3));
    const scene = new THREE.Group();
    scene.add(new THREE.Mesh(geometry, new THREE.MeshStandardMaterial()));
    const data = collectSceneBakeData(scene);
    expect(data.existingColors[0]).toBeNull();
  });
});
