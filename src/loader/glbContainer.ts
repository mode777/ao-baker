const GLB_MAGIC = 0x46546c67;
const CHUNK_JSON = 0x4e4f534a;
const CHUNK_BIN = 0x004e4942;

/** Wraps a glTF JSON document and optional BIN chunk into a GLB container. */
export function buildGlb(json: object, bin: Uint8Array | null): ArrayBuffer {
  const encoder = new TextEncoder();
  const rawJson = encoder.encode(JSON.stringify(json));
  const jsonPad = (4 - (rawJson.length % 4)) % 4;
  const binPad = bin ? (4 - (bin.length % 4)) % 4 : 0;
  const jsonLength = rawJson.length + jsonPad;
  const binLength = bin ? bin.length + binPad : 0;
  const total = 12 + 8 + jsonLength + (bin ? 8 + binLength : 0);
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
  if (bin) {
    const binHeader = 20 + jsonLength;
    view.setUint32(binHeader, binLength, true);
    view.setUint32(binHeader + 4, CHUNK_BIN, true);
    out.set(bin, binHeader + 8);
  }
  return out.buffer;
}

export function isGlbContainer(bytes: Uint8Array): boolean {
  if (bytes.length < 12) {
    return false;
  }
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0, true) === GLB_MAGIC;
}
