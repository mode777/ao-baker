import type { SceneBakeData } from '../bake/assembly';

export interface LoadIssue {
  kind: 'error' | 'warning';
  message: string;
}

/** glTF binary magic ("glTF" as uint32 little-endian). */
const GLB_MAGIC = 0x46546c67;
/** Vertex count above which a non-blocking bake-time warning is shown. */
export const LARGE_SCENE_VERTEX_THRESHOLD = 1_000_000;

export function isGlbBinary(bytes: Uint8Array): boolean {
  if (bytes.length < 12) {
    return false;
  }
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0, true) === GLB_MAGIC;
}

/**
 * Post-parse validation: distinguishes "parses but has no renderable meshes"
 * from "above the large-scene threshold" (warning, non-blocking).
 */
export function validateScene(
  data: SceneBakeData,
  threshold = LARGE_SCENE_VERTEX_THRESHOLD,
): LoadIssue[] {
  const issues: LoadIssue[] = [];
  const total = data.vertexCounts.reduce((a, b) => a + b, 0);
  if (total === 0) {
    issues.push({ kind: 'error', message: 'This GLB contains no renderable meshes.' });
    return issues;
  }
  if (total >= threshold) {
    issues.push({
      kind: 'warning',
      message: `Large scene (${total.toLocaleString()} vertices): baking may take a while.`,
    });
  }
  return issues;
}
