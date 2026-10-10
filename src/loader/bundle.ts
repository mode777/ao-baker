import { unzip } from 'fflate';
import { isGlbContainer } from './glbContainer';
import { packGltfToGlb, stripExternalGlbImages } from './pack';

/** A file handed to the loader: name (with extension) plus full contents. */
export interface LoadedFile {
  name: string;
  bytes: Uint8Array;
}

/** One file of a (potentially multi-file) input bundle; contents are lazy. */
export interface InputEntry {
  /** Relative path inside the bundle, e.g. `textures/diffuse.png`. */
  path: string;
  read(): Promise<Uint8Array>;
}

export class BundleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BundleError';
  }
}

function entryFromBytes(path: string, bytes: Uint8Array): InputEntry {
  return { path, read: () => Promise.resolve(bytes) };
}

function entryFromFile(file: File, path?: string): InputEntry {
  return {
    path: path ?? file.name,
    read: async () => new Uint8Array(await file.arrayBuffer()),
  };
}

/** Creates entries from a zip archive's contents (async, off-thread). */
export async function zipEntries(bytes: Uint8Array): Promise<InputEntry[]> {
  const files = await new Promise<Record<string, Uint8Array>>((resolve, reject) => {
    unzip(bytes, (error, data) => (error ? reject(error) : resolve(data)));
  });
  const entries: InputEntry[] = [];
  for (const [path, data] of Object.entries(files)) {
    if (path.endsWith('/')) {
      continue; // directory entry
    }
    entries.push(entryFromBytes(path, data));
  }
  return entries;
}

/** Wraps plain File objects (from multi-select or a flat drop) as entries. */
export function fileEntries(files: File[]): InputEntry[] {
  return files.map((file) => entryFromFile(file));
}

/** Wraps File objects with their webkitRelativePath (folder picker). */
export function folderFileEntries(files: File[]): InputEntry[] {
  return files.map((file) =>
    entryFromFile(file, file.webkitRelativePath || file.name),
  );
}

/** True if the bytes look like glTF JSON (an object with an `asset` member). */
export function isGltfJson(bytes: Uint8Array): boolean {
  if (bytes.length === 0) {
    return false;
  }
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return false;
  }
  const trimmed = text.replace(/^[\uFEFF\s]+/, '');
  if (!trimmed.startsWith('{')) {
    return false;
  }
  return trimmed.includes('"asset"');
}

/** True for zip archives (PK\x03\x04). */
export function isZip(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

type Resolver = (uri: string) => InputEntry | null;

/**
 * Resolution order for a referenced URI: exact (lowercased, decoded) path,
 * then progressively shorter path suffixes, then the bare basename. First
 * match wins, which makes resolution deterministic.
 */
function makeResolver(entries: InputEntry[]): Resolver {
  const byLower = new Map<string, InputEntry>();
  for (const entry of entries) {
    byLower.set(entry.path.toLowerCase(), entry);
  }
  const lowers = [...byLower.keys()];
  return (uri: string): InputEntry | null => {
    let decoded = uri;
    try {
      decoded = decodeURIComponent(uri);
    } catch {
      // keep raw uri on malformed escapes
    }
    decoded = decoded.toLowerCase();
    const exact = byLower.get(decoded);
    if (exact) {
      return exact;
    }
    let cut = decoded;
    while (cut.includes('/')) {
      cut = cut.slice(cut.indexOf('/') + 1);
      const hit = lowers.find((p) => p.endsWith(`/${cut}`));
      if (hit) {
        return byLower.get(hit) ?? null;
      }
    }
    const base = decoded.split('/').pop() ?? decoded;
    const baseHit = lowers.find((p) => p === base || p.endsWith(`/${base}`));
    return baseHit ? (byLower.get(baseHit) ?? null) : null;
  };
}

interface ModelCandidate {
  entry: InputEntry;
  kind: 'glb' | 'gltf';
}

async function detectPrimary(entries: InputEntry[]): Promise<{ primary: ModelCandidate; expanded: InputEntry[] }> {
  // expand zips into their contents first (nested zips are treated as opaque files)
  const expanded: InputEntry[] = [];
  for (const entry of entries) {
    if (entry.path.toLowerCase().endsWith('.zip')) {
      const bytes = await entry.read();
      if (!isZip(bytes)) {
        throw new BundleError(`Not a valid zip archive: ${entry.path}`);
      }
      expanded.push(...(await zipEntries(bytes)));
    } else {
      expanded.push(entry);
    }
  }

  const candidates: ModelCandidate[] = [];
  for (const entry of expanded) {
    const lower = entry.path.toLowerCase();
    if (lower.endsWith('.glb')) {
      candidates.push({ entry, kind: 'glb' });
    } else if (lower.endsWith('.gltf')) {
      candidates.push({ entry, kind: 'gltf' });
    }
  }
  if (candidates.length === 0) {
    throw new BundleError('No .glb or .gltf model found in the provided files.');
  }
  if (candidates.length > 1) {
    const listed = candidates.map((c) => c.entry.path).join(', ');
    throw new BundleError(
      `Multiple model files found (${listed}). Drop one asset (and its resources) at a time.`,
    );
  }
  return { primary: candidates[0], expanded };
}

function parseGltfJson(bytes: Uint8Array, name: string): Record<string, unknown> {
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
  } catch {
    throw new BundleError(`Not valid glTF JSON: ${name}`);
  }
}

function externalUris(json: Record<string, unknown>): { buffers: string[]; images: string[] } {
  const bufferUris: string[] = [];
  for (const uri of (((json.buffers as { uri?: string }[] | undefined) ?? []).map((r) => r.uri ?? ''))) {
    if (uri && !uri.startsWith('data:')) {
      bufferUris.push(uri);
    }
  }
  const imageUris: string[] = [];
  for (const uri of (((json.images as { uri?: string }[] | undefined) ?? []).map((r) => r.uri ?? ''))) {
    if (uri && !uri.startsWith('data:')) {
      imageUris.push(uri);
    }
  }
  return { buffers: bufferUris, images: imageUris };
}

/** The loader's input: a self-contained GLB plus which textures were dropped. */
export interface CollectedBundle extends LoadedFile {
  /** External texture URIs that could not be resolved; the model loads untextured. */
  missingTextures: string[];
}

/**
 * Turns a set of provided files into the single GLB (or embedded .gltf
 * converted to GLB) the loader consumes. Throws BundleError with a
 * user-presentable message when the input is unusable. Missing external
 * textures are tolerated (the model loads untextured) and reported via
 * missingTextures; missing external buffers remain fatal.
 */
export async function collectBundle(entries: InputEntry[]): Promise<CollectedBundle> {
  if (entries.length === 0) {
    throw new BundleError('No files provided.');
  }
  const { primary, expanded } = await detectPrimary(entries);

  if (primary.kind === 'glb') {
    const bytes = await primary.entry.read();
    if (!isGlbContainer(bytes)) {
      throw new BundleError(`Not a valid GLB file: ${primary.entry.path}`);
    }
    const name = primary.entry.path.split('/').pop() ?? primary.entry.path;
    // a GLB can still reference external texture URIs; drop those like a
    // .gltf bundle with missing textures, keeping the model loadable
    const stripped = stripExternalGlbImages(bytes);
    if (stripped) {
      return { name, bytes: stripped.bytes, missingTextures: stripped.missingTextures };
    }
    return { name, bytes, missingTextures: [] };
  }

  const json = parseGltfJson(await primary.entry.read(), primary.entry.path);
  const externals = externalUris(json);
  const others = expanded.filter((e) => e !== primary.entry);
  if (others.length === 0 && externals.buffers.length > 0) {
    throw new BundleError(
      `Missing external resources: ${externals.buffers.join(', ')}. Drop them together with the .gltf file (or use a zip / folder).`,
    );
  }
  const resolve = makeResolver(others.length > 0 ? others : entries);
  const bufferSet = new Set(externals.buffers);
  const missingBuffers: string[] = [];
  const missingTextures = new Set<string>();
  const resolved = new Map<string, Uint8Array>();
  for (const uri of [...externals.buffers, ...externals.images]) {
    const entry = resolve(uri);
    if (!entry) {
      if (bufferSet.has(uri)) {
        missingBuffers.push(uri);
      } else {
        missingTextures.add(uri);
      }
      continue;
    }
    resolved.set(uri, await entry.read());
  }
  if (missingBuffers.length > 0) {
    throw new BundleError(
      `Missing external resources: ${missingBuffers.join(', ')}. Drop them together with the .gltf file (or use a zip / folder).`,
    );
  }
  const bytes = await packGltfToGlb(json, async (uri) => resolved.get(uri) ?? null);
  const name = (primary.entry.path.split('/').pop() ?? 'model.gltf').replace(/\.gltf$/i, '.glb');
  return { name, bytes, missingTextures: [...missingTextures] };
}

// re-exported for convenience so callers share one import site
export { entryFromFile, entryFromBytes };
