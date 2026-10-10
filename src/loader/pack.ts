/**
 * Packs a parsed glTF JSON document plus its external resources into a
 * self-contained GLB: external buffers are concatenated into one BIN chunk,
 * external images are embedded as bufferViews with a mimeType, and existing
 * data URIs are left untouched. The output flows through the regular GLB
 * pipeline (preview, bake, export) unchanged.
 */

import { buildGlb, parseGlb } from './glbContainer';

export type GltfJson = Record<string, unknown>;
type BufferDef = { uri?: string; byteLength: number; name?: string };
type BufferViewDef = { buffer: number; byteOffset: number; byteLength: number };
type ImageDef = { uri?: string; mimeType?: string; bufferView?: number; name?: string };
type TextureDef = { source?: number; sampler?: number; name?: string };
type TextureInfo = { index: number; texCoord?: number; extensions?: Record<string, unknown> };

function pad4(n: number): number {
  return (4 - (n % 4)) % 4;
}

function decodeDataUriBytes(uri: string): Uint8Array | null {
  const match = /^data:[^;,]*;base64,(.*)$/s.exec(uri);
  if (!match) {
    return null;
  }
  const raw = atob(match[1]);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    bytes[i] = raw.charCodeAt(i);
  }
  return bytes;
}

/** Material texture slots defined by core glTF 2.0 (parent key, slot key). */
const CORE_TEXTURE_SLOTS: [string, string][] = [
  ['pbrMetallicRoughness', 'baseColorTexture'],
  ['pbrMetallicRoughness', 'metallicRoughnessTexture'],
  ['', 'normalTexture'],
  ['', 'occlusionTexture'],
  ['', 'emissiveTexture'],
];

/**
 * Removes texture defs whose source image was dropped, strips material
 * texture references to the removed textures (core slots explicitly,
 * extension textureInfo slots via a walk over each material's extensions),
 * and remaps surviving texture/image indices. Works on deep copies and
 * returns them, so the caller's JSON is left untouched.
 */
function pruneDroppedTextures(
  json: GltfJson,
  droppedImages: Set<number>,
): { textures: TextureDef[]; materials: Record<string, unknown>[] } {
  const materials = structuredClone(
    (json.materials as Record<string, unknown>[] | undefined) ?? [],
  ) as Record<string, unknown>[];
  const textures = (json.textures as TextureDef[] | undefined) ?? [];
  const imageCount = (json.images as unknown[] | undefined)?.length ?? 0;
  const newImageIndex = new Map<number, number>();
  let nextImage = 0;
  for (let i = 0; i < imageCount; i++) {
    if (!droppedImages.has(i)) {
      newImageIndex.set(i, nextImage++);
    }
  }
  const kept: TextureDef[] = [];
  const newTextureIndex = new Map<number, number>();
  for (const [index, texture] of textures.entries()) {
    const source = texture.source ?? 0;
    const mappedImage = newImageIndex.get(source);
    if (mappedImage === undefined) {
      continue; // source image dropped (or invalid) -> texture goes away
    }
    newTextureIndex.set(index, kept.length);
    kept.push({ ...texture, source: mappedImage });
  }

  /** Remaps a textureInfo in place; false when its texture was removed. */
  const remapInfo = (info: TextureInfo): boolean => {
    const mapped = newTextureIndex.get(info.index);
    if (mapped === undefined) {
      return false;
    }
    info.index = mapped;
    return true;
  };

  // strips extension textureInfo refs: any object with a numeric `index`
  const walkExtensions = (node: unknown): void => {
    if (Array.isArray(node)) {
      node.forEach(walkExtensions);
      return;
    }
    if (!node || typeof node !== 'object') {
      return;
    }
    const record = node as Record<string, unknown>;
    for (const [key, value] of Object.entries(record)) {
      if (
        value &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        typeof (value as TextureInfo).index === 'number'
      ) {
        if (!remapInfo(value as TextureInfo)) {
          delete record[key];
        }
      } else {
        walkExtensions(value);
      }
    }
  };

  for (const material of materials) {
    for (const [parentKey, slotKey] of CORE_TEXTURE_SLOTS) {
      const parent = (
        parentKey ? (material[parentKey] as Record<string, unknown> | undefined) : material
      ) as Record<string, unknown> | undefined;
      const info = parent?.[slotKey] as TextureInfo | undefined;
      if (info && typeof info.index === 'number' && !remapInfo(info)) {
        delete parent![slotKey];
      }
    }
    for (const extension of Object.values(
      (material.extensions as Record<string, unknown> | undefined) ?? {},
    )) {
      walkExtensions(extension);
    }
  }
  return { textures: kept, materials };
}

function imageMimeFromUri(uri: string): string {
  const lower = uri.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.ktx2')) return 'image/ktx2';
  return 'application/octet-stream';
}

/**
 * Strips externally-referenced images from a GLB container: real-world GLBs
 * sometimes reference external texture URIs despite being single files,
 * which makes them unparseable downstream. Drops those images (and their
 * textures/material references) and rebuilds the container with the
 * original BIN chunk. Returns null when there is nothing external to strip
 * (the input bytes are used as-is).
 */
export function stripExternalGlbImages(bytes: Uint8Array): {
  bytes: Uint8Array;
  missingTextures: string[];
} | null {
  const { json, bin } = parseGlb(bytes);
  const images = (json.images as ImageDef[] | undefined) ?? [];
  const external = new Set<number>();
  const uris = new Set<string>();
  for (const [index, image] of images.entries()) {
    if (image.uri && !image.uri.startsWith('data:')) {
      external.add(index);
      uris.add(image.uri);
    }
  }
  if (external.size === 0) {
    return null;
  }
  const pruned = pruneDroppedTextures(json, external);
  const imagesOut = images.filter((_, index) => !external.has(index));
  const output: GltfJson = { ...json };
  if (imagesOut.length > 0) {
    output.images = imagesOut;
  } else {
    delete output.images;
  }
  if (pruned.textures.length > 0) {
    output.textures = pruned.textures;
  } else {
    delete output.textures;
  }
  if (pruned.materials.length > 0) {
    output.materials = pruned.materials;
  } else {
    delete output.materials;
  }
  return { bytes: new Uint8Array(buildGlb(output, bin)), missingTextures: [...uris] };
}

export async function packGltfToGlb(
  json: GltfJson,
  resolve: (uri: string) => Promise<Uint8Array | null>,
): Promise<Uint8Array> {
  const buffers = (json.buffers as BufferDef[] | undefined) ?? [];
  const bufferViews = ((json.bufferViews as BufferViewDef[] | undefined) ?? []).map((bv) => ({
    ...bv,
  }));
  const images = (json.images as ImageDef[] | undefined)?.map((i) => ({ ...i }));

  // resolve every buffer payload up front
  const bufferBytes: Uint8Array[] = [];
  for (const [index, buffer] of buffers.entries()) {
    let bytes: Uint8Array | null = null;
    if (buffer.uri && !buffer.uri.startsWith('data:')) {
      bytes = await resolve(buffer.uri);
    } else if (buffer.uri) {
      bytes = decodeDataUriBytes(buffer.uri);
    }
    if (!bytes) {
      throw new Error(`Missing external resource: ${buffer.uri ?? `buffer ${index}`}`);
    }
    bufferBytes.push(bytes);
  }

  // resolve external images up front; unresolvable ones are dropped (the
  // model loads untextured), matching the bundle layer's tolerance
  const imageBytes = new Map<number, Uint8Array>();
  const droppedImages = new Set<number>();
  if (images) {
    for (const [index, image] of images.entries()) {
      if (image.uri && !image.uri.startsWith('data:')) {
        const bytes = await resolve(image.uri);
        if (!bytes) {
          droppedImages.add(index);
          continue;
        }
        imageBytes.set(index, bytes);
      }
    }
  }

  // lay out the single packed BIN: buffers first (so existing bufferViews
  // keep relative order), then embedded images; everything 4-aligned
  const bufferOffsets = bufferBytes.map((bytes) => bytes.length);
  let cursor = 0;
  for (let i = 0; i < bufferBytes.length; i++) {
    cursor += pad4(cursor);
    bufferOffsets[i] = cursor;
    cursor += bufferBytes[i].length;
  }
  const imageOffsets = new Map<number, number>();
  for (const [index, bytes] of imageBytes) {
    cursor += pad4(cursor);
    imageOffsets.set(index, cursor);
    cursor += bytes.length;
  }

  const bin = new Uint8Array(cursor);
  bufferBytes.forEach((bytes, i) => bin.set(bytes, bufferOffsets[i]));
  for (const [index, bytes] of imageBytes) {
    bin.set(bytes, imageOffsets.get(index)!);
  }

  // retarget existing bufferViews at the packed buffer
  for (const bufferView of bufferViews) {
    const oldBuffer = bufferView.buffer ?? 0;
    bufferView.buffer = 0;
    bufferView.byteOffset = (bufferView.byteOffset ?? 0) + (bufferOffsets[oldBuffer] ?? 0);
  }

  // embed images as bufferViews
  if (images) {
    for (const [index, image] of images.entries()) {
      const offset = imageOffsets.get(index);
      if (offset === undefined) {
        continue; // dropped, data URI, or already bufferView-backed
      }
      const bytes = imageBytes.get(index)!;
      bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: bytes.length });
      image.bufferView = bufferViews.length - 1;
      image.mimeType = image.mimeType ?? imageMimeFromUri(image.uri ?? '');
      delete image.uri;
    }
  }

  const output: GltfJson = {
    ...json,
    asset: json.asset ?? { version: '2.0' },
    buffers: [{ byteLength: bin.length }],
    bufferViews,
  };
  if (images) {
    const imagesOut = images.filter((_, index) => !droppedImages.has(index));
    if (imagesOut.length > 0) {
      output.images = imagesOut;
    } else {
      delete output.images;
    }
    if (droppedImages.size > 0) {
      const pruned = pruneDroppedTextures(json, droppedImages);
      if (pruned.textures.length > 0) {
        output.textures = pruned.textures;
      } else {
        delete output.textures;
      }
      if (pruned.materials.length > 0) {
        output.materials = pruned.materials;
      } else {
        delete output.materials;
      }
    }
  }
  return new Uint8Array(buildGlb(output, bin.length > 0 ? bin : null));
}
