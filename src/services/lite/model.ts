/**
 * Seishin Lite: a small trained intent model (ml/seishin-lite/train.py) that
 * runs in plain TypeScript — 1024 hashed features → 32 hidden units → intents,
 * int8 weights, ~50 KB. No native code, no download, a few microseconds a call.
 */
import raw from "./model.json";
import { DIM, featurize, isCommand } from "./features";

export type Intent =
  | "agenda" | "next_event" | "free_time" | "tasks_due" | "overdue" | "find_event"
  | "greeting" | "thanks" | "help" | "other";

interface ModelFile {
  dim: number; hidden: number; labels: Intent[]; threshold: number;
  w1: string; s1: number; b1: number[]; w2: string; s2: number; b2: number[];
}

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** base64 → signed bytes, without relying on atob/Buffer being present. */
export function decodeInt8(b64: string): Int8Array {
  const clean = b64.replace(/=+$/, "");
  const out = new Int8Array(Math.floor((clean.length * 3) / 4));
  let bits = 0, acc = 0, o = 0;
  for (let i = 0; i < clean.length; i++) {
    acc = (acc << 6) | B64.indexOf(clean[i]);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      const byte = (acc >> bits) & 0xff;
      out[o++] = byte > 127 ? byte - 256 : byte;
    }
  }
  return out;
}

const file = raw as unknown as ModelFile;
let weights: { w1: Int8Array; w2: Int8Array } | null = null;
const load = () => (weights ??= { w1: decodeInt8(file.w1), w2: decodeInt8(file.w2) });

if (file.dim !== DIM) throw new Error(`Seishin Lite: model dim ${file.dim} != features ${DIM}`);

export const LABELS = file.labels;
export const THRESHOLD = file.threshold;

/** Intent probabilities for a message, in LABELS order. */
export function predict(text: string): number[] {
  const { w1, w2 } = load();
  const { hidden: H, labels } = file;
  const x = featurize(text);
  const h = new Float64Array(H);
  for (let j = 0; j < H; j++) {
    let sum = 0;
    x.forEach((v, i) => { sum += w1[j * DIM + i] * v; });
    h[j] = Math.max(0, sum * file.s1 + file.b1[j]);
  }
  const z = labels.map((_, k) => {
    let sum = 0;
    for (let j = 0; j < H; j++) sum += w2[k * H + j] * h[j];
    return sum * file.s2 + file.b2[k];
  });
  const max = Math.max(...z);
  const e = z.map((v) => Math.exp(v - max));
  const total = e.reduce((a, b) => a + b, 0);
  return e.map((v) => v / total);
}

export interface Classification { intent: Intent; confidence: number; command: boolean }

/** Best intent; commands ("add …", "remind me to …") are always "other". */
export function classify(text: string): Classification {
  if (isCommand(text)) return { intent: "other", confidence: 1, command: true };
  const p = predict(text);
  let k = 0;
  for (let i = 1; i < p.length; i++) if (p[i] > p[k]) k = i;
  return { intent: LABELS[k], confidence: p[k], command: false };
}
