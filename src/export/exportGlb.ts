import type { Document } from '@gltf-transform/core';
import { ensureWriteDependencies } from '../loader/loadModel';
import type { MeshPrimitivePair } from '../loader/documentPairs';

/**
 * Writes baked RGB values into the export document as COLOR_0 (VEC3 FLOAT)
 * per primitive, overwriting any existing COLOR_0 (default combine policy).
 * `vertexCounts` order matches `pairs` (both come from the shared bake data
 * assembly).
 */
export function injectVertexColors(
  document: Document,
  pairs: MeshPrimitivePair[],
  colors: Float32Array,
  vertexCounts: number[],
): void {
  if (pairs.length !== vertexCounts.length) {
    throw new Error('bake result size mismatch');
  }
  let offset = 0;
  for (let i = 0; i < pairs.length; i++) {
    const count = vertexCounts[i];
    const slice = colors.slice(offset * 3, (offset + count) * 3);
    if (slice.length !== count * 3) {
      throw new Error('bake result size mismatch');
    }
    const accessor = document
      .createAccessor(`COLOR_0_${i}`)
      .setType('VEC3')
      .setArray(slice);
    pairs[i].primitive.setAttribute('COLOR_0', accessor);
    offset += count;
  }
  if (offset * 3 !== colors.length) {
    throw new Error('bake result size mismatch');
  }
}

export async function serializeGlb(document: Document): Promise<Uint8Array> {
  const io = await ensureWriteDependencies();
  // Draco re-encoding is not available in the browser build, so draco inputs
  // are exported decompressed - attributes keep exact float32 values, the
  // file just gets larger. Meshopt inputs re-compress (browser-friendly).
  for (const extension of document.getRoot().listExtensionsUsed()) {
    if (extension.extensionName === 'KHR_draco_mesh_compression') {
      extension.dispose();
    }
  }
  return io.writeBinary(document);
}
