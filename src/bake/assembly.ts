import * as THREE from 'three';
import type { BakeMeshInput } from '../baker/types';

export interface SceneBakeData {
  meshes: BakeMeshInput[];
  /** Vertex count per mesh, in the same order as `meshes` / scene traversal. */
  vertexCounts: number[];
  /** The three.js meshes, in the same order (used for writeback). */
  objects: THREE.Mesh[];
  /**
   * Vertex colors as LOADED (before any bake), per mesh; null when the mesh
   * had none. Captured once so combine policies never multiply onto a
   * previous bake's output.
   */
  existingColors: (Float32Array | null)[];
}

/**
 * Collects per-mesh bake inputs from a scene in a stable order. Attribute
 * values are read through the attribute accessors so interleaved or
 * normalized attributes are handled by three.js itself.
 */
export function collectSceneBakeData(root: THREE.Object3D): SceneBakeData {
  root.updateMatrixWorld(true);
  const meshes: BakeMeshInput[] = [];
  const vertexCounts: number[] = [];
  const objects: THREE.Mesh[] = [];
  const existingColors: (Float32Array | null)[] = [];

  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) {
      return;
    }
    const geometry = mesh.geometry;
    const position = geometry.getAttribute('position');
    if (!position) {
      return;
    }
    const count = position.count;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[3 * i] = position.getX(i);
      positions[3 * i + 1] = position.getY(i);
      positions[3 * i + 2] = position.getZ(i);
    }
    const normalAttr = geometry.getAttribute('normal');
    let normals: Float32Array | null = null;
    if (normalAttr) {
      normals = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        normals[3 * i] = normalAttr.getX(i);
        normals[3 * i + 1] = normalAttr.getY(i);
        normals[3 * i + 2] = normalAttr.getZ(i);
      }
    }
    const index = geometry.getIndex();
    meshes.push({
      positions,
      normals,
      index: index ? new Uint32Array(index.array as ArrayLike<number>) : null,
      worldMatrix: mesh.matrixWorld.toArray(),
    });
    vertexCounts.push(count);
    objects.push(mesh);
    const existing = geometry.getAttribute('color');
    if (existing && existing.count === count && existing.itemSize === 3) {
      const colors = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        colors[3 * i] = existing.getX(i);
        colors[3 * i + 1] = existing.getY(i);
        colors[3 * i + 2] = existing.getZ(i);
      }
      existingColors.push(colors);
    } else {
      existingColors.push(null);
    }
  });

  return { meshes, vertexCounts, objects, existingColors };
}

/**
 * Writes baked RGB values into each mesh's `color` attribute. Slice order
 * matches `collectSceneBakeData` (and therefore the bake request).
 */
export function applyBakedColors(data: SceneBakeData, colors: Float32Array): void {
  let offset = 0;
  for (let m = 0; m < data.objects.length; m++) {
    const count = data.vertexCounts[m];
    const slice = colors.subarray(offset * 3, (offset + count) * 3);
    if (slice.length !== count * 3) {
      throw new Error(`bake result too short for mesh ${m}`);
    }
    const attribute = new THREE.Float32BufferAttribute(new Float32Array(slice), 3);
    data.objects[m].geometry.setAttribute('color', attribute);
    offset += count;
  }
  if (offset * 3 !== colors.length) {
    throw new Error('bake result size mismatch');
  }
}
