import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { MeshoptDecoder as ThreeMeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import {
  EXTMeshGPUInstancing,
  EXTMeshoptCompression,
  EXTStructuralMetadata,
  EXTTextureAVIF,
  EXTTextureWebP,
  KHRAccessorFloat16,
  KHRAccessorFloat64,
  KHRDracoMeshCompression,
  KHRLightsPunctual,
  KHRMaterialsAnisotropy,
  KHRMaterialsClearcoat,
  KHRMaterialsDiffuseTransmission,
  KHRMaterialsDispersion,
  KHRMaterialsEmissiveStrength,
  KHRMaterialsIOR,
  KHRMaterialsIridescence,
  KHRMaterialsPBRSpecularGlossiness,
  KHRMaterialsSheen,
  KHRMaterialsSpecular,
  KHRMaterialsTransmission,
  KHRMaterialsUnlit,
  KHRMaterialsVariants,
  KHRMaterialsVolume,
  KHRMeshPrimitiveRestart,
  KHRMeshQuantization,
  KHRNodeVisibility,
  KHRTextureBasisu,
  KHRTextureTransform,
  KHRXMP,
} from '@gltf-transform/extensions';
import { WebIO, type Document } from '@gltf-transform/core';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';

/**
 * Extensions preserved on read/write. Broad on purpose: the export contract
 * is that everything except COLOR_0 survives, so the document layer must
 * know about every extension it should carry through untouched. Texture
 * transcoders are not needed - texture binaries pass through as-is.
 */
const PRESERVED_EXTENSIONS = [
  EXTMeshGPUInstancing,
  EXTMeshoptCompression,
  EXTStructuralMetadata,
  EXTTextureAVIF,
  EXTTextureWebP,
  KHRAccessorFloat16,
  KHRAccessorFloat64,
  KHRDracoMeshCompression,
  KHRLightsPunctual,
  KHRMaterialsAnisotropy,
  KHRMaterialsClearcoat,
  KHRMaterialsDiffuseTransmission,
  KHRMaterialsDispersion,
  KHRMaterialsEmissiveStrength,
  KHRMaterialsIOR,
  KHRMaterialsIridescence,
  KHRMaterialsPBRSpecularGlossiness,
  KHRMaterialsSheen,
  KHRMaterialsSpecular,
  KHRMaterialsTransmission,
  KHRMaterialsUnlit,
  KHRMaterialsVariants,
  KHRMaterialsVolume,
  KHRMeshPrimitiveRestart,
  KHRMeshQuantization,
  KHRNodeVisibility,
  KHRTextureBasisu,
  KHRTextureTransform,
  KHRXMP,
];
export interface LoadedModel {
  scene: THREE.Object3D;
  /** gltf-transform Document: the export source of truth (edited surgically). */
  document: Document;
}

export class ModelLoadError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'ModelLoadError';
  }
}

let documentIO: Promise<WebIO> | null = null;
let writeDepsReady = false;
let dracoDecoderReady = false;

/**
 * The gltf-transform IO shared by load and export. Extensions and the
 * meshopt decode dependency are registered up front; heavier dependencies
 * are added lazily (draco decode when a draco file is read, encode deps
 * before the first export).
 */
function getDocumentIO(): Promise<WebIO> {
  if (!documentIO) {
    documentIO = (async () => {
      const io = new WebIO();
      io.registerExtensions(PRESERVED_EXTENSIONS);
      await MeshoptDecoder.ready;
      io.registerDependencies({
        'meshopt.decoder': MeshoptDecoder,
      });
      return io;
    })();
  }
  return documentIO;
}

/** True if the GLB's JSON chunk references the given extension. */
function glbUsesExtension(bytes: Uint8Array, name: string): boolean {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length < 20 || view.getUint32(0, true) !== 0x46546c67) {
    return false;
  }
  const jsonLength = view.getUint32(12, true);
  const json = new TextDecoder().decode(bytes.subarray(20, 20 + jsonLength));
  return json.includes(name);
}

/**
 * Document-side draco decoder: pure JS (no wasm fetch) so it works
 * everywhere; the preview uses DRACOLoader's wasm decoder instead. It is a
 * CJS emscripten bundle whose interop shape varies by pipeline (fn,
 * { default: fn }, { DracoDecoderModule: fn }), so resolve at runtime.
 */
async function ensureDracoDecoder(io: WebIO): Promise<void> {
  if (dracoDecoderReady) {
    return;
  }
  const mod = (await import(
    'three/examples/jsm/libs/draco/gltf/draco_decoder.js'
  )) as unknown as Record<string, unknown>;
  const factory = (mod.default ?? mod.DracoDecoderModule ?? mod) as (
    options?: Record<string, unknown>,
  ) => Promise<unknown>;
  io.registerDependencies({ 'draco3d.decoder': await factory() });
  dracoDecoderReady = true;
}

export async function ensureWriteDependencies(): Promise<WebIO> {
  const io = await getDocumentIO();
  if (!writeDepsReady) {
    await MeshoptEncoder.ready;
    io.registerDependencies({
      'meshopt.encoder': MeshoptEncoder,
    });
    writeDepsReady = true;
  }
  return io;
}

const dracoLoader = /* @__PURE__ */ new DRACOLoader();
dracoLoader.setDecoderPath(`${import.meta.env?.BASE_URL ?? '/'}draco/`);

function parseScene(buffer: ArrayBuffer): Promise<THREE.Object3D> {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(ThreeMeshoptDecoder);
  loader.setDRACOLoader(dracoLoader);
  return new Promise((resolve, reject) => {
    try {
      loader.parse(
        buffer,
        '',
        (gltf) => resolve(gltf.scene),
        (error) =>
          reject(
            new ModelLoadError(
              error instanceof Error ? error.message : 'Failed to parse GLB file',
              { cause: error },
            ),
          ),
      );
    } catch (error) {
      reject(new ModelLoadError('Failed to parse GLB file', { cause: error }));
    }
  });
}

export async function loadModel(file: File): Promise<LoadedModel> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const [scene, document] = await Promise.all([
    parseScene(buffer),
    getDocumentIO()
      .then(async (io) => {
        if (glbUsesExtension(bytes, 'KHR_draco_mesh_compression')) {
          await ensureDracoDecoder(io);
        }
        return io.readBinary(bytes);
      })
      .catch((error: unknown) => {
        throw new ModelLoadError(error instanceof Error ? error.message : 'Failed to parse GLB', {
          cause: error,
        });
      }),
  ]);
  return { scene, document };
}
