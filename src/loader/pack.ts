/**
 * Packs a parsed glTF JSON document plus its external resources into a
 * self-contained GLB: external buffers are concatenated into one BIN chunk,
 * external images are embedded as bufferViews with a mimeType, and existing
 * data URIs are left untouched. The output flows through the regular GLB
 * pipeline (preview, bake, export) unchanged.
 */

export type GltfJson = Record<string, unknown>;
type BufferDef = { uri?: string; byteLength: number; name?: string };
type BufferViewDef = { buffer: number; byteOffset: number; byteLength: number };
type ImageDef = { uri?: string; mimeType?: string; bufferView?: number; name?: string };

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

function imageMimeFromUri(uri: string): string {
  const lower = uri.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.ktx2')) return 'image/ktx2';
  return 'application/octet-stream';
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

  // resolve external images up front
  const imageBytes = new Map<number, Uint8Array>();
  if (images) {
    for (const [index, image] of images.entries()) {
      if (image.uri && !image.uri.startsWith('data:')) {
        const bytes = await resolve(image.uri);
        if (!bytes) {
          throw new Error(`Missing external resource: ${image.uri}`);
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
        continue; // data URI or already bufferView-backed
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
    output.images = images;
  }
  const { buildGlb } = await import('./glbContainer');
  return new Uint8Array(buildGlb(output, bin.length > 0 ? bin : null));
}
