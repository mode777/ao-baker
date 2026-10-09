import * as THREE from 'three';
import {
  buildSceneTarget,
  buildWeldMap,
  mulberry32,
  sampleCosineHemisphere,
  type WeldMap,
} from '../kernel';
import { meshVertexCount, type BakeMeshInput } from '../types';

export interface AOBakeParams {
  /** Rays cast per unique vertex position. */
  samples: number;
  /** Occlusion radius as a fraction of the scene bounding-box diagonal. */
  radius: number;
  /** Output contrast: 0 = flat white, 1 = linear occlusion, >1 = darker. */
  strength: number;
  /** Ray origin offset along the normal; null = auto from scene size. */
  bias: number | null;
}

export const DEFAULT_AO_PARAMS: AOBakeParams = {
  samples: 32,
  radius: 0.1,
  strength: 1,
  bias: null,
};

export type BakeProgressCallback = (value: number) => void;

const PROGRESS_STRIDE = 2048;

/**
 * Bakes ambient occlusion for every input vertex.
 *
 * Returns a Float32Array with 3 (RGB) components per vertex, meshes
 * concatenated in input order; the scalar occlusion value is broadcast to
 * R = G = B so downstream COLOR_0 paths never need to change.
 */
export function bakeAO(
  meshes: BakeMeshInput[],
  params: AOBakeParams,
  seed: number,
  onProgress?: BakeProgressCallback,
): Float32Array {
  if (meshes.length === 0) {
    throw new Error('no meshes to bake');
  }
  if (!Number.isInteger(params.samples) || params.samples < 1) {
    throw new Error('samples must be a positive integer');
  }
  if (!(params.radius > 0)) {
    throw new Error('radius must be positive');
  }
  if (params.strength < 0) {
    throw new Error('strength must be >= 0');
  }

  const target = buildSceneTarget(meshes);
  if (onProgress) {
    onProgress(0);
  }

  const maxDist = Math.max(params.radius * target.diagonal, Number.EPSILON);
  const bias = params.bias ?? target.diagonal * 1e-3;
  const rng = mulberry32(seed);

  const weldMaps: WeldMap[] = meshes.map((m) => buildWeldMap(m.positions));
  const totalCanonical = weldMaps.reduce((sum, w) => sum + w.canonicalCount, 0);
  const canonicalAO = new Float32Array(totalCanonical);

  const totalVertices = meshes.reduce((sum, m) => sum + meshVertexCount(m), 0);
  const colors = new Float32Array(totalVertices * 3);

  const ray = new THREE.Ray();
  const direction = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const position = new THREE.Vector3();

  let canonicalCursor = 0;
  let vertexCursor = 0;
  let done = 0;

  for (let m = 0; m < meshes.length; m++) {
    const mesh = meshes[m];
    const world = target.worldPositions[m];
    const weld = weldMaps[m];
    const normals = canonicalNormals(mesh, world, weld, target.normalMatrices[m]);
    const meshBase = canonicalCursor;
    const sampled = new Uint8Array(weld.canonicalCount);

    for (let v = 0; v < meshVertexCount(mesh); v++) {
      const c = weld.canonical[v];
      if (sampled[c]) {
        continue; // duplicate of an already-sampled position; fanned out below
      }
      sampled[c] = 1;
      position.set(world[3 * v], world[3 * v + 1], world[3 * v + 2]);
      normal.set(normals[3 * c], normals[3 * c + 1], normals[3 * c + 2]);
      position.addScaledVector(normal, bias);
      let sum = 0;
      for (let s = 0; s < params.samples; s++) {
        sampleCosineHemisphere(normal, rng, direction);
        ray.origin.copy(position);
        ray.direction.copy(direction);
        const hit = target.bvh.raycastFirst(ray, THREE.DoubleSide, 0, maxDist);
        sum += hit ? Math.min(hit.distance / maxDist, 1) : 1;
      }
      const mean = sum / params.samples;
      canonicalAO[meshBase + c] = THREE.MathUtils.clamp(
        1 - params.strength * (1 - mean),
        0,
        1,
      );
      done++;
      if (onProgress && done % PROGRESS_STRIDE === 0) {
        onProgress(Math.min(done / totalCanonical, 0.999));
      }
    }

    for (let v = 0; v < meshVertexCount(mesh); v++) {
      const ao = canonicalAO[meshBase + weld.canonical[v]];
      colors[3 * (vertexCursor + v)] = ao;
      colors[3 * (vertexCursor + v) + 1] = ao;
      colors[3 * (vertexCursor + v) + 2] = ao;
    }

    canonicalCursor += weld.canonicalCount;
    vertexCursor += meshVertexCount(mesh);
  }

  if (onProgress) {
    onProgress(1);
  }
  return colors;
}

/**
 * Canonical normals per mesh, in world space. Uses the NORMAL attribute when
 * present; otherwise derives flat face normals averaged per canonical
 * position.
 */
function canonicalNormals(
  mesh: BakeMeshInput,
  world: Float32Array,
  weld: WeldMap,
  normalMatrix: THREE.Matrix3,
): Float32Array {
  const out = new Float32Array(weld.canonicalCount * 3);
  const v = new THREE.Vector3();

  if (mesh.normals) {
    const seen = new Uint8Array(weld.canonicalCount);
    for (let vert = 0; vert < meshVertexCount(mesh); vert++) {
      const c = weld.canonical[vert];
      if (seen[c]) {
        continue;
      }
      seen[c] = 1;
      v.set(mesh.normals[3 * vert], mesh.normals[3 * vert + 1], mesh.normals[3 * vert + 2]);
      v.applyMatrix3(normalMatrix);
      if (v.lengthSq() === 0) {
        v.set(0, 1, 0);
      }
      v.normalize();
      out[3 * c] = v.x;
      out[3 * c + 1] = v.y;
      out[3 * c + 2] = v.z;
    }
    return out;
  }

  const triCount = mesh.index ? mesh.index.length / 3 : meshVertexCount(mesh) / 3;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const ac = new THREE.Vector3();
  const faceNormal = new THREE.Vector3();
  for (let t = 0; t < triCount; t++) {
    const i0 = mesh.index ? mesh.index[3 * t] : 3 * t;
    const i1 = mesh.index ? mesh.index[3 * t + 1] : 3 * t + 1;
    const i2 = mesh.index ? mesh.index[3 * t + 2] : 3 * t + 2;
    a.set(world[3 * i0], world[3 * i0 + 1], world[3 * i0 + 2]);
    b.set(world[3 * i1], world[3 * i1 + 1], world[3 * i1 + 2]);
    c.set(world[3 * i2], world[3 * i2 + 1], world[3 * i2 + 2]);
    ab.subVectors(b, a);
    ac.subVectors(c, a);
    faceNormal.crossVectors(ab, ac); // unnormalized: area-weighted accumulation
    for (const i of [i0, i1, i2]) {
      const canonical = weld.canonical[i];
      out[3 * canonical] += faceNormal.x;
      out[3 * canonical + 1] += faceNormal.y;
      out[3 * canonical + 2] += faceNormal.z;
    }
  }
  for (let i = 0; i < weld.canonicalCount * 3; i += 3) {
    v.set(out[i], out[i + 1], out[i + 2]);
    if (v.lengthSq() === 0) {
      v.set(0, 1, 0);
    }
    v.normalize();
    out[i] = v.x;
    out[i + 1] = v.y;
    out[i + 2] = v.z;
  }
  return out;
}
