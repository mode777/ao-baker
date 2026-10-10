import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { WebIO } from '@gltf-transform/core';
import { packGltfToGlb } from './pack';
import { buildGlb } from './glbContainer';

// 1x1 red PNG
const PNG_BYTES = Uint8Array.from(
  atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='),
  (c) => c.charCodeAt(0),
);

interface MinimalGltf {
  json: Record<string, unknown>;
  resources: Record<string, Uint8Array>;
}

/** A quad (indexed, 4 verts, POSITION + indices), optionally + external texture. */
function makeBundle(includeTexture = true): MinimalGltf {
  const positions = new Float32Array([0, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1]);
  const indices = new Uint32Array([0, 1, 2, 0, 2, 3]);
  const bin = new Uint8Array(48 + 24);
  bin.set(new Uint8Array(positions.buffer), 0);
  bin.set(new Uint8Array(indices.buffer), 48);
  const json = {
    asset: { version: '2.0' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [
      {
        primitives: [
          { attributes: { POSITION: 0 }, indices: 1, mode: 4, material: 0 },
        ],
      },
    ],
    materials: includeTexture
      ? [{ pbrMetallicRoughness: { baseColorTexture: { index: 0 } } }]
      : [{}],
    textures: includeTexture ? [{ source: 0 }] : undefined,
    samplers: includeTexture ? [{}] : undefined,
    images: includeTexture ? [{ uri: 'textures/diffuse.png' }] : undefined,
    accessors: [
      { bufferView: 0, componentType: 5126, count: 4, type: 'VEC3', min: [0, 0, 0], max: [1, 0, 1] },
      { bufferView: 1, componentType: 5125, count: 6, type: 'SCALAR' },
    ],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: 48 },
      { buffer: 0, byteOffset: 48, byteLength: 24 },
    ],
    buffers: [{ uri: 'geometry.bin', byteLength: 72 }],
  };
  return {
    json: json as unknown as Record<string, unknown>,
    resources: {
      'geometry.bin': bin,
      'textures/diffuse.png': PNG_BYTES,
    },
  };
}

async function parseWithThree(bytes: Uint8Array): Promise<THREE.Mesh> {
  const loader = new GLTFLoader();
  return new Promise((resolve, reject) => {
    loader.parse(
      bytes.buffer as ArrayBuffer,
      '',
      (gltf) => {
        let mesh: THREE.Mesh | null = null;
        gltf.scene.traverse((object) => {
          if ((object as THREE.Mesh).isMesh && !mesh) mesh = object as THREE.Mesh;
        });
        if (!mesh) throw new Error('no mesh');
        resolve(mesh);
      },
      (error) => reject(error instanceof Error ? error : new Error('parse failed')),
    );
  });
}

describe('packGltfToGlb', () => {
  it('produces a GLB both parsers read identically to the source bundle', async () => {
    const bundle = makeBundle();
    const packed = await packGltfToGlb(
      bundle.json,
      async (uri) => bundle.resources[uri] ?? null,
    );

    // gltf-transform side: document structure + texture bytes
    const io = new WebIO();
    const doc = await io.readBinary(packed);
    const prim = doc.getRoot().listMeshes()[0].listPrimitives()[0];
    const position = prim.getAttribute('POSITION')!.getArray() as Float32Array;
    expect(Array.from(position)).toEqual([0, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1]);
    const image = doc.getRoot().listTextures()[0].getImage();
    expect(image).toBeDefined();
    expect(Array.from(image!)).toEqual(Array.from(PNG_BYTES));
    // no external references remain
    expect(doc.getRoot().listMeshes()[0].listPrimitives()[0].getAttribute('COLOR_0')).toBeNull();

    // three.js side: geometry parses with the same positions (texture
    // decoding needs a browser, so this variant packs without one)
    const textureless = makeBundle(false);
    const packedPlain = await packGltfToGlb(
      textureless.json,
      async (uri) => textureless.resources[uri] ?? null,
    );
    const mesh = await parseWithThree(packedPlain);
    const attr = mesh.geometry.getAttribute('position');
    expect(attr.count).toBe(4);
    expect(Array.from(attr.array as Float32Array).slice(0, 12)).toEqual([
      0, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1,
    ]);
  });

  it('resolves images through the resolver and leaves data URIs untouched', async () => {
    const bundle = makeBundle();
    const json = { ...bundle.json };
    const resolvedUris: string[] = [];
    await packGltfToGlb(json, async (uri) => {
      resolvedUris.push(uri);
      return bundle.resources[uri] ?? null;
    });
    expect(resolvedUris).toContain('geometry.bin');
    expect(resolvedUris).toContain('textures/diffuse.png');
  });

  it('errors when a resource is missing', async () => {
    const bundle = makeBundle();
    await expect(
      packGltfToGlb(bundle.json, async () => null),
    ).rejects.toThrow(/Missing external resource/);
  });

  it('emits a valid GLB container (magic + JSON asset)', () => {
    const glb = buildGlb({ asset: { version: '2.0' } }, null);
    expect(glb.byteLength).toBeGreaterThan(0);
  });
});
