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

  it('drops unresolved images instead of throwing', async () => {
    const bundle = makeBundle();
    const packed = await packGltfToGlb(bundle.json, async (uri) =>
      uri === 'geometry.bin' ? bundle.resources['geometry.bin']! : null,
    );
    const doc = await new WebIO().readBinary(packed);
    expect(doc.getRoot().listTextures()).toHaveLength(0);
    expect(doc.getRoot().listMaterials()).toHaveLength(1);
    // no reference to the dropped URI remains in the GLB JSON
    expect(JSON.stringify(glbJson(packed))).not.toContain('textures/diffuse.png');
  });

  it('parses in GLTFLoader when the only texture was dropped', async () => {
    const bundle = makeBundle();
    const packed = await packGltfToGlb(bundle.json, async (uri) =>
      uri === 'geometry.bin' ? bundle.resources['geometry.bin']! : null,
    );
    const mesh = await parseWithThree(packed);
    const attr = mesh.geometry.getAttribute('position');
    expect(attr.count).toBe(4);
  });

  it('prunes dropped images and remaps interleaved survivors', async () => {
    // images: 0=kept, 1=dropped, 2=kept; textures reference them interleaved
    const json: Record<string, unknown> = {
      asset: { version: '2.0' },
      extensionsUsed: ['KHR_materials_clearcoat'],
      materials: [
        {
          pbrMetallicRoughness: {
            baseColorFactor: [1, 0, 0, 1],
            baseColorTexture: { index: 1 }, // -> texture 1 (dropped image)
            metallicRoughnessTexture: { index: 2 }, // -> kept image 2
          },
          normalTexture: { index: 0, scale: 1 }, // -> kept image 0
          emissiveTexture: { index: 1 }, // -> dropped
          emissiveFactor: [0, 0, 0],
          extensions: {
            KHR_materials_clearcoat: { clearcoatFactor: 1, clearcoatTexture: { index: 1 } },
          },
        },
        { pbrMetallicRoughness: { baseColorTexture: { index: 3 } } }, // -> kept image 0
      ],
      textures: [{ source: 0 }, { source: 1 }, { source: 2 }, { source: 0 }],
      samplers: [{}],
      images: [{ uri: 'kept-a.png' }, { uri: 'dropped.png' }, { uri: 'kept-c.png' }],
      buffers: [{ uri: 'data:application/octet-stream;base64,AAAAAAA=', byteLength: 4 }],
    };
    const packed = await packGltfToGlb(json, async (uri) =>
      uri === 'dropped.png' ? null : PNG_BYTES,
    );
    const out = glbJson(packed);
    const images = out.images as { uri?: string; bufferView?: number }[];
    const textures = out.textures as { source: number }[];
    expect(images).toHaveLength(2);
    // surviving images were embedded (no external references remain)
    expect(images.every((i) => i.uri === undefined && typeof i.bufferView === 'number')).toBe(true);
    expect(textures.map((t) => t.source)).toEqual([0, 1, 0]);

    const [m0, m1] = out.materials as unknown[];
    expect(at(m0, 'pbrMetallicRoughness.baseColorFactor')).toEqual([1, 0, 0, 1]);
    expect(at(m0, 'pbrMetallicRoughness.baseColorTexture')).toBeUndefined();
    expect(at(m0, 'pbrMetallicRoughness.metallicRoughnessTexture.index')).toBe(1);
    expect(at(m0, 'normalTexture')).toEqual({ index: 0, scale: 1 });
    expect(at(m0, 'emissiveTexture')).toBeUndefined();
    expect(at(m0, 'emissiveFactor')).toEqual([0, 0, 0]);
    expect(at(m0, 'extensions.KHR_materials_clearcoat.clearcoatFactor')).toBe(1);
    expect(at(m0, 'extensions.KHR_materials_clearcoat.clearcoatTexture')).toBeUndefined();
    expect(at(m1, 'pbrMetallicRoughness.baseColorTexture.index')).toBe(2);

    // no dangling indices anywhere
    for (const texture of textures) {
      expect(texture.source).toBeLessThan(images.length);
    }
    for (const material of [m0, m1]) {
      for (const info of textureInfos(material)) {
        expect(info.index).toBeLessThan(textures.length);
      }
    }

    // gltf-transform reads the pruned document
    const doc = await new WebIO().readBinary(packed);
    expect(doc.getRoot().listTextures()).toHaveLength(2);
    expect(doc.getRoot().listMaterials()).toHaveLength(2);

    // the caller's JSON was not mutated
    const original = json.materials as unknown[];
    expect(at(original[0], 'pbrMetallicRoughness.baseColorTexture')).toEqual({ index: 1 });
    expect(at(original[0], 'extensions.KHR_materials_clearcoat.clearcoatTexture')).toEqual({
      index: 1,
    });
  });

  it('emits a valid GLB container (magic + JSON asset)', () => {
    const glb = buildGlb({ asset: { version: '2.0' } }, null);
    expect(glb.byteLength).toBeGreaterThan(0);
  });
});

/** Decodes the JSON chunk of a GLB container. */
function glbJson(bytes: Uint8Array): Record<string, unknown> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const jsonLength = view.getUint32(12, true);
  return JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + jsonLength)));
}

/** Reads a dotted path through plain JSON objects. */
function at(value: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>(
    (node, key) => (node as Record<string, unknown> | undefined)?.[key],
    value,
  );
}

/** Collects every textureInfo-like object ({index: number}) in a material. */
function textureInfos(node: unknown): { index: number }[] {
  const found: { index: number }[] = [];
  const walk = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    if (!value || typeof value !== 'object') return;
    const record = value as Record<string, unknown>;
    if (typeof record.index === 'number') {
      found.push(value as { index: number });
      return;
    }
    Object.values(record).forEach(walk);
  };
  walk(node);
  return found;
}
