import * as THREE from 'three';
import type { Document, Node, Primitive } from '@gltf-transform/core';

export interface MeshPrimitivePair {
  mesh: THREE.Mesh;
  primitive: Primitive;
}

function collectThreeMeshes(root: THREE.Object3D, out: THREE.Mesh[]): void {
  for (const child of root.children) {
    if ((child as THREE.Mesh).isMesh) {
      out.push(child as THREE.Mesh);
    }
    collectThreeMeshes(child, out);
  }
}

function collectPrimitives(node: Node, out: Primitive[]): void {
  const mesh = node.getMesh();
  if (mesh) {
    out.push(...mesh.listPrimitives());
  }
  for (const child of node.listChildren()) {
    collectPrimitives(child, out);
  }
}

/**
 * Pairs three.js meshes with document primitives in traversal order.
 *
 * GLTFLoader mirrors the document node tree 1:1 (one object per node, child
 * meshes per primitive in primitive order), and both preserve primitive
 * vertex order — so vertex N of `mesh` corresponds to vertex N of
 * `primitive`. This invariant is guarded by round-trip tests; this function
 * refuses to guess if the counts ever disagree.
 */
export function pairScenePrimitives(
  scene: THREE.Object3D,
  document: Document,
): MeshPrimitivePair[] {
  const meshes: THREE.Mesh[] = [];
  collectThreeMeshes(scene, meshes);
  const primitives: Primitive[] = [];
  for (const sceneRoot of document.getRoot().listScenes()) {
    for (const node of sceneRoot.listChildren()) {
      collectPrimitives(node, primitives);
    }
  }
  if (meshes.length !== primitives.length) {
    throw new Error(
      `scene/primitive correspondence broken: ${meshes.length} meshes vs ${primitives.length} primitives`,
    );
  }
  return meshes.map((mesh, i) => ({ mesh, primitive: primitives[i] }));
}
