import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { meshTriangleCount, meshVertexCount, type BakeMeshInput } from './types';

export interface WeldMap {
  /** canonicalIndex[vertexIndex] for every vertex of one mesh. */
  canonical: Int32Array;
  canonicalCount: number;
}

/** Deterministic, seedable PRNG (mulberry32). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TANGENT_HELPER = new THREE.Vector3();
const TANGENT = new THREE.Vector3();
const BITANGENT = new THREE.Vector3();

/** Cosine-weighted direction in the hemisphere around `normal`, written into `out`. */
export function sampleCosineHemisphere(
  normal: THREE.Vector3,
  rng: () => number,
  out: THREE.Vector3,
): THREE.Vector3 {
  const r = Math.sqrt(rng());
  const phi = 2 * Math.PI * rng();
  TANGENT_HELPER.set(normal.z, normal.x, normal.y);
  if (Math.abs(normal.x) > 0.9) {
    TANGENT_HELPER.set(0, 1, 0);
  }
  TANGENT.crossVectors(TANGENT_HELPER, normal).normalize();
  BITANGENT.crossVectors(normal, TANGENT);
  const cosTheta = Math.sqrt(1 - r * r);
  out.copy(TANGENT).multiplyScalar(r * Math.cos(phi));
  out.addScaledVector(BITANGENT, r * Math.sin(phi));
  out.addScaledVector(normal, cosTheta);
  return out.normalize();
}

/**
 * Maps vertices that share a position (UV seams, normal splits) to a common
 * canonical index so baked values have no seams.
 */
export function buildWeldMap(positions: Float32Array): WeldMap {
  const vertexCount = positions.length / 3;
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i < positions.length; i += 3) {
    minX = Math.min(minX, positions[i]);
    minY = Math.min(minY, positions[i + 1]);
    minZ = Math.min(minZ, positions[i + 2]);
    maxX = Math.max(maxX, positions[i]);
    maxY = Math.max(maxY, positions[i + 1]);
    maxZ = Math.max(maxZ, positions[i + 2]);
  }
  const extent = Math.max(maxX - minX, maxY - minY, maxZ - minZ);
  const eps = Math.max(extent * 1e-6, 1e-9);

  const canonical = new Int32Array(vertexCount).fill(-1);
  const cells = new Map<string, number>();
  const reps: number[] = [];

  for (let v = 0; v < vertexCount; v++) {
    const x = positions[3 * v];
    const y = positions[3 * v + 1];
    const z = positions[3 * v + 2];
    const cx = Math.floor(x / eps);
    const cy = Math.floor(y / eps);
    const cz = Math.floor(z / eps);
    let found = -1;
    for (let dx = -1; dx <= 1 && found === -1; dx++) {
      for (let dy = -1; dy <= 1 && found === -1; dy++) {
        for (let dz = -1; dz <= 1 && found === -1; dz++) {
          const neighbor = cells.get(`${cx + dx},${cy + dy},${cz + dz}`);
          if (neighbor === undefined) {
            continue;
          }
          const rx = positions[3 * reps[neighbor]];
          const ry = positions[3 * reps[neighbor] + 1];
          const rz = positions[3 * reps[neighbor] + 2];
          if (
            Math.abs(rx - x) <= eps &&
            Math.abs(ry - y) <= eps &&
            Math.abs(rz - z) <= eps
          ) {
            found = neighbor;
          }
        }
      }
    }
    if (found >= 0) {
      canonical[v] = found;
    } else {
      const id = reps.length;
      reps.push(v);
      canonical[v] = id;
      cells.set(`${cx},${cy},${cz}`, id);
    }
  }
  return { canonical, canonicalCount: reps.length };
}

export interface SceneTarget {
  bvh: MeshBVH;
  /** World-space diagonal of the whole scene's bounding box. */
  diagonal: number;
  /** World-space positions per mesh, in input order. */
  worldPositions: Float32Array[];
  normalMatrices: THREE.Matrix3[];
}

/**
 * Assembles one combined world-space triangle proxy over all meshes (rest
 * pose) and builds a single acceleration structure over it, so occlusion is
 * evaluated against the whole scene.
 */
export function buildSceneTarget(meshes: BakeMeshInput[]): SceneTarget {
  if (meshes.length === 0) {
    throw new Error('no meshes to bake');
  }

  const worldPositions: Float32Array[] = [];
  const normalMatrices: THREE.Matrix3[] = [];
  const matrix = new THREE.Matrix4();
  const v = new THREE.Vector3();

  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  let triangleCount = 0;

  for (const mesh of meshes) {
    matrix.fromArray(Array.from(mesh.worldMatrix));
    const count = meshVertexCount(mesh);
    const world = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      v.set(mesh.positions[3 * i], mesh.positions[3 * i + 1], mesh.positions[3 * i + 2]);
      v.applyMatrix4(matrix);
      world[3 * i] = v.x;
      world[3 * i + 1] = v.y;
      world[3 * i + 2] = v.z;
      minX = Math.min(minX, v.x);
      minY = Math.min(minY, v.y);
      minZ = Math.min(minZ, v.z);
      maxX = Math.max(maxX, v.x);
      maxY = Math.max(maxY, v.y);
      maxZ = Math.max(maxZ, v.z);
    }
    worldPositions.push(world);
    normalMatrices.push(new THREE.Matrix3().getNormalMatrix(matrix));
    triangleCount += meshTriangleCount(mesh);
  }

  const diagonal = new THREE.Vector3(maxX - minX, maxY - minY, maxZ - minZ).length();
  if (!Number.isFinite(diagonal) || diagonal <= 0) {
    throw new Error('scene has no measurable extent');
  }

  const soup = new Float32Array(triangleCount * 9);
  let cursor = 0;
  for (let m = 0; m < meshes.length; m++) {
    const mesh = meshes[m];
    const world = worldPositions[m];
    const triCount = meshTriangleCount(mesh);
    for (let t = 0; t < triCount; t++) {
      for (let c = 0; c < 3; c++) {
        const vertex = mesh.index ? mesh.index[3 * t + c] : 3 * t + c;
        soup[cursor++] = world[3 * vertex];
        soup[cursor++] = world[3 * vertex + 1];
        soup[cursor++] = world[3 * vertex + 2];
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(soup, 3));
  const bvh = new MeshBVH(geometry);

  return { bvh, diagonal, worldPositions, normalMatrices };
}
