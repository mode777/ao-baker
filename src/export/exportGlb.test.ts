import { describe, expect, it } from 'vitest';
import { loadModel } from '../loader/loadModel';
import { pairScenePrimitives } from '../loader/documentPairs';
import { injectVertexColors, serializeGlb } from './exportGlb';
import { buildDracoFixtureGlb, buildRichFixtureGlb, createTestIO } from '../testing/fixtures';
import type { Document } from '@gltf-transform/core';

function asFile(bytes: Uint8Array, name = 'rich.glb'): File {
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  return new File([copy.buffer as ArrayBuffer], name);
}

function gradientColors(total: number): Float32Array {
  const colors = new Float32Array(total * 3);
  for (let v = 0; v < total; v++) {
    const value = v / Math.max(total - 1, 1);
    colors[3 * v] = value;
    colors[3 * v + 1] = value * 0.5;
    colors[3 * v + 2] = 1 - value;
  }
  return colors;
}

function listPrimitives(document: Document) {
  return document.getRoot().listMeshes().flatMap((m) => m.listPrimitives());
}

function structureSnapshot(document: Document) {
  const root = document.getRoot();
  return {
    scenes: root.listScenes().length,
    nodes: root.listNodes().length,
    meshes: root.listMeshes().length,
    materials: root.listMaterials().length,
    animations: root.listAnimations().length,
    skins: root.listSkins().length,
    materialExtensions: root
      .listMaterials()
      .flatMap((m) => m.listExtensions().map((e) => e.extensionName)),
    nodeExtras: root.listNodes().filter((n) => Object.keys(n.getExtras() ?? {}).length > 0)
      .length,
    animationTargetPaths: root
      .listAnimations()
      .flatMap((a) => a.listChannels().map((c) => c.getTargetPath())),
    primitiveCounts: listPrimitives(document).map((p) => p.getAttribute('POSITION')!.getCount()),
  };
}

describe('injectVertexColors + serializeGlb', () => {
  it('round-trips COLOR_0 through save and re-read', async () => {
    const bytes = await buildRichFixtureGlb();
    const { scene, document } = await loadModel(asFile(bytes));
    const pairs = pairScenePrimitives(scene, document);
    const vertexCounts = pairs.map((p) => p.primitive.getAttribute('POSITION')!.getCount());
    const total = vertexCounts.reduce((a, b) => a + b, 0);
    const colors = gradientColors(total);

    injectVertexColors(document, pairs, colors, vertexCounts);
    const out = await serializeGlb(document);

    const io = await createTestIO();
    const reread = await io.readBinary(out);
    const rereadPrims = listPrimitives(reread);
    expect(rereadPrims).toHaveLength(pairs.length);
    let offset = 0;
    for (let i = 0; i < rereadPrims.length; i++) {
      const count = vertexCounts[i];
      const accessor = rereadPrims[i].getAttribute('COLOR_0');
      expect(accessor, `COLOR_0 on primitive ${i}`).toBeDefined();
      expect(accessor!.getType()).toBe('VEC3');
      expect(accessor!.getArray()).toEqual(colors.slice(offset * 3, (offset + count) * 3));
      offset += count;
    }
  });

  it('preserves everything except COLOR_0', async () => {
    const bytes = await buildRichFixtureGlb();
    const { scene, document } = await loadModel(asFile(bytes));
    const pairs = pairScenePrimitives(scene, document);
    const vertexCounts = pairs.map((p) => p.primitive.getAttribute('POSITION')!.getCount());
    const before = structureSnapshot(document);
    // non-vacuous: the fixture must actually carry an extension through
    expect(before.materialExtensions).toContain('KHR_materials_unlit');

    injectVertexColors(document, pairs, gradientColors(vertexCounts.reduce((a, b) => a + b, 0)), vertexCounts);
    const out = await serializeGlb(document);

    const io = await createTestIO();
    const reread = await io.readBinary(out);
    const after = structureSnapshot(reread);
    expect(after).toEqual(before);
  });

  it('overwrites existing COLOR_0 with baked values', async () => {
    const bytes = await buildRichFixtureGlb();
    const { scene, document } = await loadModel(asFile(bytes));
    const pairs = pairScenePrimitives(scene, document);
    const vertexCounts = pairs.map((p) => p.primitive.getAttribute('POSITION')!.getCount());
    // pre-color everything white
    injectVertexColors(
      document,
      pairs,
      new Float32Array(vertexCounts.reduce((a, b) => a + b, 0) * 3).fill(1),
      vertexCounts,
    );
    // bake gradient on top (overwrite policy)
    const colors = gradientColors(vertexCounts.reduce((a, b) => a + b, 0));
    injectVertexColors(document, pairs, colors, vertexCounts);
    const out = await serializeGlb(document);

    const io = await createTestIO();
    const reread = await io.readBinary(out);
    const first = listPrimitives(reread)[0].getAttribute('COLOR_0')!.getArray() as Float32Array;
    expect(first[0]).toBeCloseTo(0);
    expect(first[first.length - 1]).not.toBe(1); // gradient, not the old white
  });

  it('handles Draco-compressed input end to end', async () => {
    const bytes = await buildDracoFixtureGlb();
    const io = await createTestIO();
    const document = await io.readBinary(bytes);
    expect(document.getRoot().listMeshes()).toHaveLength(1);
    const prim = listPrimitives(document)[0];
    const count = prim.getAttribute('POSITION')!.getCount();

    const pairs = [
      {
        mesh: null as never,
        primitive: prim,
      },
    ];
    const colors = gradientColors(count);
    injectVertexColors(document, pairs, colors, [count]);
    const out = await serializeGlb(document);

    const reread = await io.readBinary(out);
    const rereadPrim = listPrimitives(reread)[0];
    expect(rereadPrim.getAttribute('POSITION')!.getCount()).toBe(count);
    // draco input is exported DECOMPRESSED (no browser-side re-encoder), so
    // colors keep exact float32 values and the draco extension is stripped
    expect(rereadPrim.listExtensions().map((e) => e.extensionName)).not.toContain(
      'KHR_draco_mesh_compression',
    );
    const colorArray = rereadPrim.getAttribute('COLOR_0')!.getArray() as Float32Array;
    expect(colorArray.length).toBe(count * 3);
    expect(Array.from(colorArray)).toEqual(Array.from(colors));
  });
});
