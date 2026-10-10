export { buildGlb } from '../loader/glbContainer';
import { buildGlb } from '../loader/glbContainer';

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
