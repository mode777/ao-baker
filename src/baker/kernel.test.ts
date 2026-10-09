import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { buildWeldMap, mulberry32, sampleCosineHemisphere } from './kernel';

describe('mulberry32', () => {
  it('is deterministic for a given seed', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 100; i++) {
      expect(a()).toBe(b());
    }
  });
});

describe('sampleCosineHemisphere', () => {
  it('has the expected cosine-weighted distribution', () => {
    const rng = mulberry32(7);
    const normal = new THREE.Vector3(0, 1, 0);
    const dir = new THREE.Vector3();
    let sumCos = 0;
    const n = 20000;
    for (let i = 0; i < n; i++) {
      sampleCosineHemisphere(normal, rng, dir);
      expect(dir.y).toBeGreaterThanOrEqual(0);
      sumCos += dir.y;
    }
    // E[cos] for cosine-weighted hemisphere sampling is 2/3
    expect(Math.abs(sumCos / n - 2 / 3)).toBeLessThan(0.02);
  });
});

describe('buildWeldMap', () => {
  it('maps duplicated vertices to one canonical index', () => {
    // two triangles whose vertices are all duplicated (UV-seam style)
    const positions = new Float32Array([
      0, 0, 0, 1, 0, 0, 0, 0, 1, // copy A
      0, 0, 0, 1, 0, 0, 0, 0, 1, // copy B
    ]);
    const weld = buildWeldMap(positions);
    expect(weld.canonicalCount).toBe(3);
    expect(weld.canonical[0]).toBe(weld.canonical[3]);
    expect(weld.canonical[1]).toBe(weld.canonical[4]);
    expect(weld.canonical[2]).toBe(weld.canonical[5]);
  });

  it('keeps distinct vertices distinct even when very close', () => {
    const eps = 1e-4;
    const positions = new Float32Array([0, 0, 0, eps * 100, 0, 0]);
    const weld = buildWeldMap(positions);
    expect(weld.canonicalCount).toBe(2);
  });
});
