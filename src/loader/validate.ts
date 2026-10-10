import type { SceneBakeData } from '../bake/assembly';

export interface LoadIssue {
  kind: 'error' | 'warning';
  message: string;
}

/** Vertex count above which a non-blocking bake-time warning is shown. */
export const LARGE_SCENE_VERTEX_THRESHOLD = 1_000_000;

/** Filenames shown in the missing-texture warning before the "and N more" tail. */
export const MISSING_TEXTURE_NAME_LIMIT = 3;

/**
 * Warning issue for external textures that could not be resolved and were
 * dropped at load time (the model loads untextured). Empty when none.
 */
export function missingTexturesIssue(missing: string[]): LoadIssue[] {
  if (missing.length === 0) {
    return [];
  }
  const shown = missing.slice(0, MISSING_TEXTURE_NAME_LIMIT).join(', ');
  const extra =
    missing.length > MISSING_TEXTURE_NAME_LIMIT
      ? ` … and ${missing.length - MISSING_TEXTURE_NAME_LIMIT} more`
      : '';
  return [
    { kind: 'warning', message: `Loaded without textures — missing: ${shown}${extra}` },
  ];
}

/** Joins warning messages into a single banner line; null when there are none. */
export function warningMessage(issues: LoadIssue[]): string | null {
  const messages = issues
    .filter((issue) => issue.kind === 'warning')
    .map((issue) => issue.message);
  return messages.length > 0 ? messages.join(' ') : null;
}

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
