import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { applyViewMode } from './viewModes';

function makeMesh(): THREE.Mesh {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 0, 1], 3));
  return new THREE.Mesh(geometry, new THREE.MeshStandardMaterial());
}

describe('applyViewMode', () => {
  it('toggles vertexColors between original and baked', () => {
    const mesh = makeMesh();
    const original = mesh.material as THREE.MeshStandardMaterial;
    applyViewMode(mesh, 'original');
    expect(original.vertexColors).toBe(false);
    applyViewMode(mesh, 'baked');
    expect(original.vertexColors).toBe(true);
    applyViewMode(mesh, 'original');
    expect(original.vertexColors).toBe(false);
  });

  it('swaps to a shared unlit white vertex-color material for AO-only and restores after', () => {
    const mesh = makeMesh();
    const original = mesh.material as THREE.MeshStandardMaterial;
    applyViewMode(mesh, 'aoOnly');
    expect(mesh.material).not.toBe(original);
    expect((mesh.material as THREE.MeshBasicMaterial).vertexColors).toBe(true);
    expect((mesh.material as THREE.MeshBasicMaterial).isMeshBasicMaterial).toBe(true);
    applyViewMode(mesh, 'baked');
    expect(mesh.material).toBe(original);
    expect(original.vertexColors).toBe(true);
  });

  it('handles material arrays', () => {
    const mesh = makeMesh();
    const materials = [new THREE.MeshStandardMaterial(), new THREE.MeshStandardMaterial()];
    mesh.material = materials;
    applyViewMode(mesh, 'baked');
    expect(materials.every((m) => m.vertexColors)).toBe(true);
    applyViewMode(mesh, 'original');
    expect(materials.every((m) => !m.vertexColors)).toBe(true);
  });
});
