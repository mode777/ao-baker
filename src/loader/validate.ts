import type { SceneBakeData } from '../bake/assembly';

export interface LoadIssue {
  kind: 'error' | 'warning';
  message: string;
}

/** Vertex count above which a non-blocking bake-time warning is shown. */
export const LARGE_SCENE_VERTEX_THRESHOLD = 1_000_000;

/**
 * Post-parse validation: distinguishes "parses but has no renderable meshes"
 * from "above the large-scene threshold" (warning, non-blocking). Input
 * sniffing (GLB / glTF JSON / zip / unsupported) happens during bundle
 * collection in src/loader/bundle.ts.
 */
export function validateScene(
  data: SceneBakeData,
  threshold = LARGE_SCENE_VERTEX_THRESHOLD,
): LoadIssue[] {
  const issues: LoadIssue[] = [];
  const total = data.vertexCounts.reduce((sum, count) => sum + count, 0);
  if (total === 0) {
    issues.push({ kind: 'error', message: 'This model contains no renderable meshes.' });
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
