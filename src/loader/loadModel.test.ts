import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { buildMeshoptTriangleGlb, buildUncompressedTriangleGlb } from '../testing/glb';
import { loadModel, ModelLoadError, type LoadedFile } from './loadModel';

function loadedFromBytes(bytes: ArrayBuffer | Uint8Array, name = 'model.glb'): LoadedFile {
  if (bytes instanceof Uint8Array) {
    const copy = new Uint8Array(bytes.length);
    copy.set(bytes);
    return { name, bytes: copy };
  }
  return { name, bytes: new Uint8Array(bytes.slice(0)) };
}

function collectMeshes(root: THREE.Object3D): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = [];
  root.traverse((object) => {
    if ((object as THREE.Mesh).isMesh) {
      meshes.push(object as THREE.Mesh);
    }
  });
  return meshes;
}

describe('loadModel', () => {
  it('loads an uncompressed GLB (scene + document)', async () => {
    const { scene, document } = await loadModel(loadedFromBytes(buildUncompressedTriangleGlb()));
    const meshes = collectMeshes(scene);
    expect(meshes).toHaveLength(1);
    expect(meshes[0].geometry.getAttribute('position').count).toBe(3);
    expect(document.getRoot().listMeshes()).toHaveLength(1);
    expect(document.getRoot().listScenes()).toHaveLength(1);
  });

  it('loads a meshopt-compressed GLB (scene + document)', async () => {
    const { scene, document } = await loadModel(loadedFromBytes(await buildMeshoptTriangleGlb()));
    const meshes = collectMeshes(scene);
    expect(meshes).toHaveLength(1);
    expect(meshes[0].geometry.getAttribute('position').count).toBe(3);
    expect(document.getRoot().listMeshes()).toHaveLength(1);
  });

  it('rejects non-GLB bytes with ModelLoadError', async () => {
    const bytes = new TextEncoder().encode('definitely not a glb');
    await expect(
      loadModel(loadedFromBytes(bytes, 'junk.glb')),
    ).rejects.toBeInstanceOf(ModelLoadError);
  });

  it('returns the model name', async () => {
    const model = await loadModel(loadedFromBytes(buildUncompressedTriangleGlb(), 'thing.glb'));
    expect(model.name).toBe('thing.glb');
  });
});
