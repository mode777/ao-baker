export interface BakeMeshInput {
  /** Local-space positions, xyz per vertex. */
  positions: Float32Array;
  /** Local-space normals, xyz per vertex, or null if the source has none. */
  normals: Float32Array | null;
  /** Triangle indices, or null for non-indexed geometry. */
  index: ArrayLike<number> | null;
  /** World matrix (column-major, 16 elements) of the mesh's node. */
  worldMatrix: ArrayLike<number>;
}

export function meshVertexCount(mesh: BakeMeshInput): number {
  return mesh.positions.length / 3;
}

export function meshTriangleCount(mesh: BakeMeshInput): number {
  return mesh.index ? mesh.index.length / 3 : meshVertexCount(mesh) / 3;
}
