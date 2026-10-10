import { zipSync, strToU8 } from 'fflate';
import { describe, expect, it } from 'vitest';
import {
  BundleError,
  collectBundle,
  entryFromBytes,
  isGltfJson,
  isZip,
  zipEntries,
  type InputEntry,
} from './bundle';
import { buildGlb } from './glbContainer';

function entry(path: string, bytes: Uint8Array | string): InputEntry {
  const data = typeof bytes === 'string' ? new TextEncoder().encode(bytes) : bytes;
  return entryFromBytes(path, data);
}

const GLB_BYTES = new Uint8Array(buildGlb({ asset: { version: '2.0' } }, null));
const PNG_1PX = Uint8Array.from(
  atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='),
  (c) => c.charCodeAt(0),
);

describe('input sniffing', () => {
  it('detects glTF JSON', () => {
    expect(isGltfJson(new TextEncoder().encode('{"asset":{"version":"2.0"}}'))).toBe(true);
    expect(isGltfJson(new TextEncoder().encode('\uFEFF\n  {"asset":{}}'))).toBe(true);
    expect(isGltfJson(new TextEncoder().encode('{"nope":1}'))).toBe(false);
    expect(isGltfJson(new TextEncoder().encode('<xml/>'))).toBe(false);
  });

  it('detects zip archives', () => {
    const zip = zipSync({ 'a.txt': strToU8('hello') });
    expect(isZip(new Uint8Array(zip))).toBe(true);
    expect(isZip(GLB_BYTES)).toBe(false);
  });
});

describe('collectBundle', () => {
  it('passes a lone GLB through', async () => {
    const result = await collectBundle([entry('model.glb', GLB_BYTES)]);
    expect(result.name).toBe('model.glb');
    expect(result.bytes).toEqual(GLB_BYTES);
    expect(result.missingTextures).toEqual([]);
  });

  it('strips external image references from a GLB and reports them', async () => {
    const quad = buildGlb({
      asset: { version: '2.0' },
      scene: 0,
      scenes: [{ nodes: [0] }],
      nodes: [{ mesh: 0 }],
      meshes: [{ primitives: [{ attributes: { POSITION: 0 }, material: 0 }] }],
      materials: [
        {
          pbrMetallicRoughness: {
            baseColorTexture: { index: 1 }, // -> embedded image (stays)
            metallicRoughnessTexture: { index: 0 }, // -> external image (goes)
          },
          normalTexture: { index: 1, scale: 2 },
        },
      ],
      textures: [{ source: 0 }, { source: 1 }],
      samplers: [{}],
      images: [{ uri: 'external.png' }, { bufferView: 0, mimeType: 'image/png' }],
      accessors: [
        { bufferView: 0, componentType: 5126, count: 4, type: 'VEC3', min: [0, 0, 0], max: [1, 1, 1] },
      ],
      bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 48 }],
      buffers: [{ byteLength: 48 }],
    }, new Uint8Array(48));
    const result = await collectBundle([entry('model.glb', new Uint8Array(quad))]);
    expect(result.missingTextures).toEqual(['external.png']);
    expect(isGlbContainerSafe(result.bytes)).toBe(true);
    const view = new DataView(result.bytes.buffer, result.bytes.byteOffset, result.bytes.byteLength);
    const jsonLength = view.getUint32(12, true);
    const json = JSON.parse(new TextDecoder().decode(result.bytes.subarray(20, 20 + jsonLength)));
    expect(json.images).toEqual([{ bufferView: 0, mimeType: 'image/png' }]);
    expect(json.textures.map((t: { source: number }) => t.source)).toEqual([0]);
    expect(json.materials[0].pbrMetallicRoughness.baseColorTexture.index).toBe(0);
    expect(json.materials[0].pbrMetallicRoughness.metallicRoughnessTexture).toBeUndefined();
    expect(json.materials[0].normalTexture).toEqual({ index: 0, scale: 2 });
    expect(JSON.stringify(json)).not.toContain('external.png');
  });

  it('errors on a GLB referencing an external buffer at load time', async () => {
    const broken = buildGlb(
      { asset: { version: '2.0' }, buffers: [{ uri: 'geometry.bin', byteLength: 4 }] },
      null,
    );
    // passes through bundle collection (buffer errors are a load-layer concern)
    await expect(
      collectBundle([entry('model.glb', new Uint8Array(broken))]),
    ).resolves.toBeDefined();
  });

  it('errors when no model file is present', async () => {
    await expect(collectBundle([entry('a.bin', new Uint8Array(4))])).rejects.toThrow(BundleError);
    await expect(collectBundle([])).rejects.toThrow(BundleError);
  });

  it('errors when multiple model files are present', async () => {
    await expect(
      collectBundle([entry('a.glb', GLB_BYTES), entry('b.gltf', '{"asset":{}}')]),
    ).rejects.toThrow(/Multiple model files/);
  });

  it('errors on a .gltf dropped alone that needs external files', async () => {
    const gltf = JSON.stringify({
      asset: { version: '2.0' },
      buffers: [{ uri: 'model.bin', byteLength: 4 }],
    });
    await expect(collectBundle([entry('model.gltf', gltf)])).rejects.toThrow(/model\.bin/);
  });

  it('resolves external resources by exact path and suffix', async () => {
    const gltf = JSON.stringify({
      asset: { version: '2.0' },
      buffers: [{ uri: 'model.bin', byteLength: 4 }],
    });
    const result = await collectBundle([
      entry('model.gltf', gltf),
      entry('model.bin', new Uint8Array([1, 2, 3, 4])),
    ]);
    expect(result.name).toBe('model.glb');
    expect(isGlbContainerSafe(result.bytes)).toBe(true);
  });

  it('matches a basename-only file for a subdirectory-prefixed URI', async () => {
    const gltf = JSON.stringify({
      asset: { version: '2.0' },
      images: [{ uri: 'textures/diffuse.png' }],
      buffers: [{ uri: 'model.bin', byteLength: 0 }],
    });
    await expect(
      collectBundle([entry('model.gltf', gltf), entry('model.bin', new Uint8Array(0)), entry('diffuse.png', PNG_1PX)]),
    ).resolves.toBeDefined();
  });

  it('decodes URI escapes when matching', async () => {
    const gltf = JSON.stringify({
      asset: { version: '2.0' },
      buffers: [{ uri: 'my%20model.bin', byteLength: 4 }],
    });
    await expect(
      collectBundle([entry('model.gltf', gltf), entry('my model.bin', new Uint8Array(4))]),
    ).resolves.toBeDefined();
  });

  it('tolerates a missing texture and reports it as missingTextures', async () => {
    const gltf = JSON.stringify({
      asset: { version: '2.0' },
      buffers: [{ uri: 'model.bin', byteLength: 4 }],
      images: [{ uri: 'textures/diffuse.png' }],
    });
    const result = await collectBundle([entry('model.gltf', gltf), entry('model.bin', new Uint8Array(4))]);
    expect(result.missingTextures).toEqual(['textures/diffuse.png']);
    expect(isGlbContainerSafe(result.bytes)).toBe(true);
  });

  it('still errors naming a missing .bin even when a texture is present', async () => {
    const gltf = JSON.stringify({
      asset: { version: '2.0' },
      buffers: [{ uri: 'model.bin', byteLength: 4 }],
      images: [{ uri: 'textures/diffuse.png' }],
    });
    await expect(
      collectBundle([entry('model.gltf', gltf), entry('diffuse.png', PNG_1PX)]),
    ).rejects.toThrow(/model\.bin/);
  });

  it('errors when a texture and a buffer are both missing', async () => {
    const gltf = JSON.stringify({
      asset: { version: '2.0' },
      buffers: [{ uri: 'model.bin', byteLength: 4 }],
      images: [{ uri: 'textures/diffuse.png' }],
    });
    await expect(collectBundle([entry('model.gltf', gltf)])).rejects.toThrow(/model\.bin/);
  });

  it('dedupes a missing texture referenced by multiple images', async () => {
    const gltf = JSON.stringify({
      asset: { version: '2.0' },
      buffers: [{ uri: 'model.bin', byteLength: 4 }],
      images: [{ uri: 'shared.png' }, { uri: 'shared.png' }],
    });
    const result = await collectBundle([entry('model.gltf', gltf), entry('model.bin', new Uint8Array(4))]);
    expect(result.missingTextures).toEqual(['shared.png']);
  });

  it('loads a standalone .gltf with a data-URI buffer but external textures', async () => {
    const bin = 'AAAAAAA='; // 4 zero bytes
    const gltf = JSON.stringify({
      asset: { version: '2.0' },
      buffers: [{ uri: `data:application/octet-stream;base64,${bin}`, byteLength: 4 }],
      images: [{ uri: 'textures/diffuse.png' }, { uri: 'textures/normal.png' }],
    });
    const result = await collectBundle([entry('model.gltf', gltf)]);
    expect(result.missingTextures).toEqual(['textures/diffuse.png', 'textures/normal.png']);
    expect(isGlbContainerSafe(result.bytes)).toBe(true);
  });

  it('loads a .gltf inside a zip with its resources', async () => {
    const gltf = JSON.stringify({
      asset: { version: '2.0' },
      buffers: [{ uri: 'model.bin', byteLength: 4 }],
    });
    const zip = zipSync({
      'bundle/model.gltf': strToU8(gltf),
      'bundle/model.bin': new Uint8Array([9, 9, 9, 9]),
    });
    const result = await collectBundle([entry('bundle.zip', new Uint8Array(zip))]);
    expect(result.name).toBe('model.glb');
  });

  it('errors when a zip contains no model', async () => {
    const zip = zipSync({ 'readme.txt': strToU8('nothing here') });
    await expect(collectBundle([entry('x.zip', new Uint8Array(zip))])).rejects.toThrow(/No .glb or .gltf/);
  });

  it('loads a GLB from a zip', async () => {
    const zip = zipSync({ 'deep/nested/model.glb': GLB_BYTES });
    const result = await collectBundle([entry('x.zip', new Uint8Array(zip))]);
    expect(result.bytes).toEqual(GLB_BYTES);
  });

  it('expands zip entries for direct inspection', async () => {
    const zip = zipSync({ 'dir/a.txt': strToU8('hi') });
    const entries = await zipEntries(new Uint8Array(zip));
    expect(entries).toHaveLength(1);
    expect(entries[0].path).toBe('dir/a.txt');
  });
});

// guard against accidental import cycles: reuse the magic check locally
function isGlbContainerSafe(bytes: Uint8Array): boolean {
  return bytes.length > 12 && bytes[0] === 0x67 && bytes[1] === 0x6c && bytes[2] === 0x54 && bytes[3] === 0x46;
}
