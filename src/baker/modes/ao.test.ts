import { describe, expect, it } from 'vitest';
import type { BakeMeshInput } from '../types';
import { bakeAO, DEFAULT_AO_PARAMS } from './ao';

function quadY(origin: [number, number], size: number, y: number): BakeMeshInput {
  const [x0, z0] = origin;
  return {
    positions: new Float32Array([
      x0, y, z0,
      x0 + size, y, z0,
      x0 + size, y, z0 + size,
      x0, y, z0 + size,
    ]),
    normals: new Float32Array([
      0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0,
    ]),
    index: new Uint32Array([0, 1, 2, 0, 2, 3]),
    worldMatrix: new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]),
  };
}

function transformMesh(
  mesh: BakeMeshInput,
  matrix: ArrayLike<number>,
): BakeMeshInput {
  return { ...mesh, worldMatrix: matrix };
}

function identityMatrix(): Float32Array {
  return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
}

function translationScaleMatrix(
  tx: number,
  ty: number,
  tz: number,
  scale: number,
): Float32Array {
  return new Float32Array([
    scale, 0, 0, 0,
    0, scale, 0, 0,
    0, 0, scale, 0,
    tx, ty, tz, 1,
  ]);
}

function applyMatrixToPositions(
  positions: Float32Array,
  m: ArrayLike<number>,
): Float32Array {
  const out = new Float32Array(positions.length);
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i];
    const y = positions[i + 1];
    const z = positions[i + 2];
    out[i] = m[0] * x + m[4] * y + m[8] * z + m[12];
    out[i + 1] = m[1] * x + m[5] * y + m[9] * z + m[13];
    out[i + 2] = m[2] * x + m[6] * y + m[10] * z + m[14];
  }
  return out;
}

/** Floor y=0 (x,z in 0..1, normal +Y) plus wall x=0 (y,z in 0..1, normal +X). */
function insideCorner(): BakeMeshInput[] {
  const floor: BakeMeshInput = {
    positions: new Float32Array([
      0, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1,
    ]),
    normals: new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]),
    index: new Uint32Array([0, 1, 2, 0, 2, 3]),
    worldMatrix: identityMatrix(),
  };
  const wall: BakeMeshInput = {
    positions: new Float32Array([
      0, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1,
    ]),
    normals: new Float32Array([1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0]),
    index: new Uint32Array([0, 1, 2, 0, 2, 3]),
    worldMatrix: identityMatrix(),
  };
  return [floor, wall];
}

function box(center: [number, number, number], size: number): BakeMeshInput {
  const [cx, cy, cz] = center;
  const s = size / 2;
  const positions = new Float32Array([
    // -X
    cx - s, cy - s, cz - s, cx - s, cy - s, cz + s, cx - s, cy + s, cz + s,
    cx - s, cy - s, cz - s, cx - s, cy + s, cz + s, cx - s, cy + s, cz - s,
    // +X
    cx + s, cy - s, cz + s, cx + s, cy - s, cz - s, cx + s, cy + s, cz - s,
    cx + s, cy - s, cz + s, cx + s, cy + s, cz - s, cx + s, cy + s, cz + s,
    // -Y
    cx - s, cy - s, cz - s, cx + s, cy - s, cz - s, cx + s, cy - s, cz + s,
    cx - s, cy - s, cz - s, cx + s, cy - s, cz + s, cx - s, cy - s, cz + s,
    // +Y
    cx - s, cy + s, cz + s, cx + s, cy + s, cz + s, cx + s, cy + s, cz - s,
    cx - s, cy + s, cz + s, cx + s, cy + s, cz - s, cx - s, cy + s, cz - s,
    // -Z
    cx - s, cy - s, cz - s, cx - s, cy + s, cz - s, cx + s, cy + s, cz - s,
    cx - s, cy - s, cz - s, cx + s, cy + s, cz - s, cx + s, cy - s, cz - s,
    // +Z
    cx + s, cy - s, cz + s, cx + s, cy + s, cz + s, cx - s, cy + s, cz + s,
    cx + s, cy - s, cz + s, cx - s, cy + s, cz + s, cx - s, cy - s, cz + s,
  ]);
  const normals = new Float32Array(positions.length);
  for (let i = 0; i < 6; i++) {
    const n = [
      [-1, 0, 0],
      [1, 0, 0],
      [0, -1, 0],
      [0, 1, 0],
      [0, 0, -1],
      [0, 0, 1],
    ][i];
    for (let v = 0; v < 6; v++) {
      normals[(i * 6 + v) * 3] = n[0];
      normals[(i * 6 + v) * 3 + 1] = n[1];
      normals[(i * 6 + v) * 3 + 2] = n[2];
    }
  }
  return {
    positions,
    normals,
    index: null,
    worldMatrix: identityMatrix(),
  };
}

function triangle(): BakeMeshInput {
  return {
    positions: new Float32Array([-1, 0, -1, 0, 0, 1, 1, 0, -1]),
    normals: new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0]),
    index: null,
    worldMatrix: identityMatrix(),
  };
}

describe('bakeAO', () => {
  it('returns fully lit values for an unoccluded plane and never self-hits', () => {
    const colors = bakeAO([quadY([0, 0], 1, 0)], DEFAULT_AO_PARAMS, 1);
    expect(colors.length).toBe(4 * 3);
    for (let i = 0; i < colors.length; i++) {
      expect(colors[i]).toBe(1);
    }
  });

  it('makes concave corners darker than flat geometry', () => {
    const colors = bakeAO(insideCorner(), DEFAULT_AO_PARAMS, 1);
    // floor vertices: [0]=(0,0,0) corner, [1]=(1,0,0), [2]=(1,0,1) far, [3]=(0,0,1)
    const cornerAO = colors[0];
    const farAO = colors[2 * 3];
    expect(cornerAO).toBeLessThan(0.9);
    expect(cornerAO).toBeLessThan(farAO);
    expect(farAO).toBeLessThanOrEqual(1);
  });

  it('ignores geometry beyond the occlusion radius', () => {
    // a "lid" 0.5 above the floor; scene diagonal ~1.5 -> radius 0.1 is far too small
    const floor = quadY([0, 0], 1, 0);
    const lid = quadY([0, 0], 1, 0.5);
    const withoutEffect = bakeAO([floor, lid], { ...DEFAULT_AO_PARAMS, radius: 0.1 }, 1);
    for (let i = 0; i < 4; i++) {
      expect(withoutEffect[i * 3]).toBe(1);
    }
    // with a large radius the lid occludes the floor
    const withEffect = bakeAO([floor, lid], { ...DEFAULT_AO_PARAMS, radius: 0.5 }, 1);
    const floorMean =
      (withEffect[0] + withEffect[3] + withEffect[6] + withEffect[9]) / 4;
    expect(floorMean).toBeLessThan(1);
  });

  it('evaluates occlusion across meshes (facing box sides darken each other)', () => {
    const params = { ...DEFAULT_AO_PARAMS, radius: 0.3, samples: 64 };
    const colors = bakeAO([box([0, 0, 0], 1), box([1.3, 0, 0], 1)], params, 1);
    // box 1 is non-indexed: -X face verts 0..5, +X face verts 6..11
    const mean = (from: number, to: number) => {
      let sum = 0;
      for (let i = from; i < to; i++) {
        sum += colors[i * 3];
      }
      return sum / (to - from);
    };
    const facing = mean(6, 12);
    const outer = mean(0, 6);
    expect(facing).toBeLessThan(outer);
    // box 2 starts at vertex 36; its -X face (towards box 1) is darkened
    expect(colors[36 * 3]).toBeLessThan(1);
  });

  it('gives duplicated vertices (UV seams) identical values', () => {
    // quad whose four corners each exist twice; a small box above part of it
    const positions = new Float32Array([
      0, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, // originals
      0, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, // duplicates
    ]);
    const seamQuad: BakeMeshInput = {
      positions,
      normals: null, // also exercises the normal fallback
      index: new Uint32Array([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]),
      worldMatrix: identityMatrix(),
    };
    const colors = bakeAO([seamQuad, box([0.9, 0.8, 0.9], 0.5)], { ...DEFAULT_AO_PARAMS, radius: 0.3 }, 3);
    for (let c = 0; c < 4; c++) {
      expect(colors[c * 3]).toBe(colors[(c + 4) * 3]);
    }
  });

  it('samples canonicals whose id differs from their vertex index', () => {
    // regression: one mesh where a duplicated vertex appears BEFORE new
    // unique vertices (weld ids shift) - every canonical must still get AO
    const cornerMesh: BakeMeshInput = {
      positions: new Float32Array([
        0, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, // floor
        0, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, // wall (shares two positions)
      ]),
      normals: new Float32Array([
        0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0,
        1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0,
      ]),
      index: new Uint32Array([0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7]),
      worldMatrix: identityMatrix(),
    };
    const colors = bakeAO([cornerMesh], { ...DEFAULT_AO_PARAMS, samples: 16 }, 7);
    const wallTops = [colors[5 * 3], colors[6 * 3]];
    for (const value of wallTops) {
      expect(value).toBeGreaterThan(0.95); // open sky, must be sampled (not zero-initialized)
    }
    // welding: shared corners across floor/wall must agree (RGB-expanded index!)
    expect(colors[0]).toBe(colors[4 * 3]);
    expect(colors[3 * 3]).toBe(colors[7 * 3]);
    // corner darker than far vertices
    expect(colors[0]).toBeLessThan(0.9);
  });

  it('bakes transformed nodes as if the transform were pre-applied', () => {
    const matrix = translationScaleMatrix(3, 0, 0, 2);
    const viaMatrix = bakeAO(
      [transformMesh(triangle(), matrix)],
      DEFAULT_AO_PARAMS,
      5,
    );
    const preTransformed = bakeAO(
      [
        {
          ...triangle(),
          positions: applyMatrixToPositions(triangle().positions, matrix),
        },
      ],
      DEFAULT_AO_PARAMS,
      5,
    );
    expect(viaMatrix).toEqual(preTransformed);
  });

  it('bakes primitives without NORMAL attributes', () => {
    // winding flipped vs insideCorner's floor so the derived face normal points +Y
    const floorNoNormals: BakeMeshInput = {
      ...insideCorner()[0],
      normals: null,
      index: new Uint32Array([0, 2, 1, 0, 3, 2]),
    };
    const colors = bakeAO([floorNoNormals, insideCorner()[1]], DEFAULT_AO_PARAMS, 2);
    expect(colors[0]).toBeLessThan(0.95); // corner still occluded
    expect(colors.every((c) => c >= 0 && c <= 1)).toBe(true);
  });

  it('is deterministic for identical input and seed', () => {
    const a = bakeAO(insideCorner(), { ...DEFAULT_AO_PARAMS, samples: 16 }, 42);
    const b = bakeAO(insideCorner(), { ...DEFAULT_AO_PARAMS, samples: 16 }, 42);
    expect(a).toEqual(b);
  });

  it('returns RGB per vertex with R = G = B', () => {
    const colors = bakeAO(insideCorner(), DEFAULT_AO_PARAMS, 9);
    expect(colors.length).toBe(8 * 3);
    for (let v = 0; v < 8; v++) {
      expect(colors[3 * v]).toBe(colors[3 * v + 1]);
      expect(colors[3 * v + 1]).toBe(colors[3 * v + 2]);
    }
  });

  it('rejects invalid input', () => {
    expect(() => bakeAO([], DEFAULT_AO_PARAMS, 1)).toThrow();
    expect(() =>
      bakeAO([triangle()], { ...DEFAULT_AO_PARAMS, samples: 0 }, 1),
    ).toThrow();
  });
});
