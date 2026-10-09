import * as THREE from 'three';

export type ViewMode = 'original' | 'baked' | 'aoOnly';

const AO_OVERRIDE_MATERIAL = /* @__PURE__ */ new THREE.MeshBasicMaterial({
  color: 0xffffff,
  vertexColors: true,
});

const originalMaterials = new WeakMap<THREE.Mesh, THREE.Material | THREE.Material[]>();

/**
 * View modes:
 * - original: source materials without vertex colors
 * - baked: source materials with vertex colors enabled
 * - aoOnly: unlit white base multiplied by vertex colors (the judge-the-bake view)
 */
export function applyViewMode(root: THREE.Object3D, mode: ViewMode): void {
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) {
      return;
    }
    if (mode === 'aoOnly') {
      if (!originalMaterials.has(mesh) && mesh.material !== AO_OVERRIDE_MATERIAL) {
        originalMaterials.set(mesh, mesh.material);
      }
      mesh.material = AO_OVERRIDE_MATERIAL;
      return;
    }
    const swapped = originalMaterials.get(mesh);
    if (swapped !== undefined) {
      mesh.material = swapped;
      originalMaterials.delete(mesh);
    }
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const useVertexColors = mode === 'baked';
    for (const material of materials) {
      const standard = material as THREE.MeshStandardMaterial;
      if (standard.vertexColors !== useVertexColors) {
        standard.vertexColors = useVertexColors;
        standard.needsUpdate = true;
      }
    }
  });
}
