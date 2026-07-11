/**
 * Collision-proof unique ID generation.
 *
 * The old pattern `ai-${Date.now()}` breaks when several items are created in
 * the same millisecond (e.g. the AI planning a whole day in one turn): they all
 * get the SAME id, so they can't be told apart, edited, or deleted individually
 * — and React list keys collide too.
 *
 * `uid(prefix)` guarantees uniqueness by combining the timestamp with a
 * monotonic per-process counter and a short random suffix.
 */
let counter = 0;

export function uid(prefix = "id"): string {
  counter = (counter + 1) % 1_000_000;
  const time = Date.now().toString(36);
  const seq = counter.toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  return `${prefix}-${time}-${seq}${rand}`;
}
