declare module 'draco3dgltf' {
  export function createDecoderModule(): Promise<unknown>;
  export function createEncoderModule(): Promise<unknown>;
  const draco3dgltf: {
    createDecoderModule: typeof createDecoderModule;
    createEncoderModule: typeof createEncoderModule;
  };
  export default draco3dgltf;
}

declare module 'three/examples/jsm/libs/draco/gltf/draco_decoder.js' {
  /** Emscripten factory for the pure-JS Draco decoder used by gltf-transform. */
  function DracoDecoderModule(options?: Record<string, unknown>): Promise<unknown>;
  export default DracoDecoderModule;
}
