const GLB_MAGIC = 0x46546c67;
const CHUNK_JSON = 0x4e4f534a;
const CHUNK_BIN = 0x004e4942;

export function buildGlb(json: object, bin: Uint8Array): ArrayBuffer {
  const encoder = new TextEncoder();
  const rawJson = encoder.encode(JSON.stringify(json));
  const jsonPad = (4 - (rawJson.length % 4)) % 4;
  const binPad = (4 - (bin.length % 4)) % 4;
  const jsonLength = rawJson.length + jsonPad;
  const total = 12 + 8 + jsonLength + 8 + bin.length + binPad;
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  view.setUint32(0, GLB_MAGIC, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, total, true);
  view.setUint32(12, jsonLength, true);
  view.setUint32(16, CHUNK_JSON, true);
  out.set(rawJson, 20);
  for (let i = 0; i < jsonPad; i++) {
    out[20 + rawJson.length + i] = 0x20;
  }
  const binHeader = 20 + jsonLength;
  view.setUint32(binHeader, bin.length + binPad, true);
  view.setUint32(binHeader + 4, CHUNK_BIN, true);
  out.set(bin, binHeader + 8);
  return out.buffer;
}

const TRIANGLE_MIN = [-1, 0, -1];
const TRIANGLE_MAX = [1, 0, 1];

function trianglePositions(): Float32Array {
  // CCW when viewed from above (+Y), so the front face points up
  return new Float32Array([-1, 0, -1, 0, 0, 1, 1, 0, -1]);
}

export function buildUncompressedTriangleGlb(): ArrayBuffer {
  const positions = trianglePositions();
  const bin = new Uint8Array(positions.buffer);
  const json = {
    asset: { version: '2.0' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, mode: 4 }] }],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: 3,
        type: 'VEC3',
        min: TRIANGLE_MIN,
        max: TRIANGLE_MAX,
      },
    ],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: bin.length }],
    buffers: [{ byteLength: bin.length }],
  };
  return buildGlb(json, bin);
}

export async function buildMeshoptTriangleGlb(): Promise<ArrayBuffer> {
  const { MeshoptEncoder } = await import('meshoptimizer/encoder');
  await MeshoptEncoder.ready;
  const positions = trianglePositions();
  const compressed = MeshoptEncoder.encodeVertexBuffer(
    new Uint8Array(positions.buffer),
    3,
    12,
  );
  const bin = new Uint8Array(compressed.buffer, compressed.byteOffset, compressed.byteLength);
  const json = {
    asset: { version: '2.0' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, mode: 4 }] }],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: 3,
        type: 'VEC3',
        min: TRIANGLE_MIN,
        max: TRIANGLE_MAX,
      },
    ],
    bufferViews: [
      {
        buffer: 0,
        extensions: {
          EXT_meshopt_compression: {
            buffer: 0,
            byteOffset: 0,
            byteLength: bin.length,
            byteStride: 12,
            count: 3,
            mode: 'ATTRIBUTES',
          },
        },
      },
    ],
    buffers: [{ byteLength: bin.length }],
    extensionsUsed: ['EXT_meshopt_compression'],
  };
  return buildGlb(json, bin);
}
