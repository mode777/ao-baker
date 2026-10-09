import {
  Document,
  WebIO,
  type TypedArray,
} from '@gltf-transform/core';
import { KHRDracoMeshCompression, KHRMaterialsUnlit } from '@gltf-transform/extensions';
import { draco } from '@gltf-transform/functions';
import draco3dgltf from 'draco3dgltf';

/**
 * Builds a GLB containing: a scene with two meshes (one with a skin and one
 * animated), an unlit material (KHR_materials_unlit), custom extras, and both
 * indexed and non-indexed primitives. Used to prove the export pipeline
 * preserves everything except COLOR_0.
 */
export async function buildRichFixtureGlb(): Promise<Uint8Array> {
  const doc = new Document();
  doc.createBuffer('default');

  const makePrimitive = (
    doc: Document,
    name: string,
    positions: TypedArray,
    indices: TypedArray | null,
  ) => {
    const prim = doc.createPrimitive();
    prim.setAttribute(
      'POSITION',
      doc
        .createAccessor(`${name}-pos`)
        .setType('VEC3')
        .setArray(positions),
    );
    if (indices) {
      prim.setIndices(
        doc
          .createAccessor(`${name}-idx`)
          .setType('SCALAR')
          .setArray(indices),
      );
    }
    // JOINTS_0/WEIGHTS_0 so the primitive is valid under a skin
    const vertexCount = positions.length / 3;
    prim.setAttribute(
      'JOINTS_0',
      doc
        .createAccessor(`${name}-joints`)
        .setType('VEC4')
        .setArray(new Uint16Array(new Array(vertexCount * 4).fill(0))),
    );
    prim.setAttribute(
      'WEIGHTS_0',
      doc
        .createAccessor(`${name}-weights`)
        .setType('VEC4')
        .setArray(new Float32Array(new Array(vertexCount * 4).fill(0).map((_, i) => (i % 4 === 0 ? 1 : 0)))),
    );
    return prim;
  };

  const quadPositions = new Float32Array([0, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1]);
  const triPositions = new Float32Array([2, 0, 0, 4, 0, 0, 3, 0, 2]);

  const material = doc.createMaterial('unlit');
  material.setExtension('KHR_materials_unlit', doc.createExtension(KHRMaterialsUnlit).createUnlit());

  const skinnedMesh = doc
    .createMesh('skinned')
    .addPrimitive(makePrimitive(doc, 'p1', quadPositions, new Uint32Array([0, 1, 2, 0, 2, 3])));
  const plainMesh = doc
    .createMesh('plain')
    .addPrimitive(makePrimitive(doc, 'p2', triPositions, null));

  const joint = doc.createNode('joint');
  const skin = doc
    .createSkin('skin')
    .addJoint(joint)
    .setInverseBindMatrices(
      doc
        .createAccessor('ibm')
        .setType('MAT4')
        .setArray(new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1])),
    );

  const animatedNode = doc
    .createNode('animated')
    .setMesh(skinnedMesh)
    .setSkin(skin)
    .setExtras({ authored: 'test' });
  animatedNode.addChild(joint);
  const staticNode = doc.createNode('static').setMesh(plainMesh).setExtras({ other: 7 });

  const scene = doc.createScene('Scene');
  scene.addChild(animatedNode);
  scene.addChild(staticNode);

  const times = doc
    .createAccessor('anim-times')
    .setType('SCALAR')
    .setArray(new Float32Array([0, 1]));
  const values = doc
    .createAccessor('anim-values')
    .setType('VEC4')
    .setArray(new Float32Array([0, 0, 0, 1, 0, 0.7, 0, 0.7]));
  const sampler = doc
    .createAnimationSampler('spin-sampler')
    .setInput(times)
    .setOutput(values)
    .setInterpolation('LINEAR');
  const channel = doc
    .createAnimationChannel('spin-channel')
    .setTargetPath('rotation')
    .setTargetNode(animatedNode)
    .setSampler(sampler);
  const animation = doc.createAnimation('spin').addSampler(sampler);
  animation.addChannel(channel);

  const io = new WebIO().registerExtensions([KHRMaterialsUnlit]);
  return io.writeBinary(doc);
}

/** Builds a GLB whose primitive is Draco-compressed (edgebreaker). */
export async function buildDracoFixtureGlb(): Promise<Uint8Array> {
  const doc = new Document();
  doc.createBuffer('default');
  const prim = doc
    .createPrimitive()
    .setAttribute(
      'POSITION',
      doc
        .createAccessor('pos')
        .setType('VEC3')
        .setArray(new Float32Array([0, 0, 0, 1, 0, 0, 0, 0, 1])),
    );
  doc
    .createMesh('m')
    .addPrimitive(prim);
  const node = doc.createNode('n').setMesh(doc.getRoot().listMeshes()[0]);
  doc.createScene('Scene').addChild(node);

  await doc.transform(draco());

  const io = new WebIO()
    .registerExtensions([KHRDracoMeshCompression])
    .registerDependencies({
      'draco3d.encoder': await draco3dgltf.createEncoderModule(),
      'draco3d.decoder': await draco3dgltf.createDecoderModule(),
    });
  return io.writeBinary(doc);
}

/** Test IO with full extension + dependency support for reading and writing. */
export async function createTestIO() {
  const [encoder, decoder] = await Promise.all([
    draco3dgltf.createEncoderModule(),
    draco3dgltf.createDecoderModule(),
  ]);
  return new WebIO()
    .registerExtensions([KHRMaterialsUnlit, KHRDracoMeshCompression])
    .registerDependencies({ 'draco3d.encoder': encoder, 'draco3d.decoder': decoder });
}
