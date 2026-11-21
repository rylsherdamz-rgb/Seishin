/**
 * What saving the on-device model should do (pure — unit-tested). GGUF files
 * are gigabytes: never re-copy the one already in place, and delete the model
 * it replaces so app storage doesn't grow with every switch.
 */
export type ModelSavePlan =
  | { kind: "clear"; remove: string | null }
  | { kind: "unchanged" }
  | { kind: "copy"; from: string; dest: string; remove: string | null };

/** The previous file is ours to delete only if Seishin copied it into its Models/ folder. */
const ownedBy = (path: string | null, modelDir: string) => (path && path.startsWith(modelDir) ? path : null);

export function planModelSave(picked: string, saved: string | null, fileName: string, modelDir: string, now = Date.now()): ModelSavePlan {
  if (!picked) return { kind: "clear", remove: ownedBy(saved, modelDir) };
  if (picked === saved) return { kind: "unchanged" };
  const safe = (fileName || `model-${now}.gguf`).replace(/[\\/]/g, "_");
  const dest = `${modelDir}${safe}`;
  const old = ownedBy(saved, modelDir);
  return { kind: "copy", from: picked, dest, remove: old && old !== dest ? old : null };
}
