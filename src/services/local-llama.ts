import { initLlama, LlamaContext, releaseAllLlama, installJsi, type ContextParams } from "llama.rn";

export type ModelState = "unloaded" | "loading" | "ready" | "error";

let _context: LlamaContext | null = null;
let _state: ModelState = "unloaded";
let _progress = 0;
let _error: string | null = null;

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

export function onModelStateChange(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getModelState() {
  return { state: _state, progress: _progress, error: _error };
}

export function getModelContext() {
  return _context;
}

export function isModelLoaded() {
  return _state === "ready" && _context !== null;
}

export async function loadModel(modelPath: string, onProgress?: (pct: number) => void) {
  if (_state === "loading") return;
  if (_context) {
    await _context.release();
    _context = null;
  }

  _state = "loading";
  _progress = 0;
  _error = null;
  notify();

  try {
    await installJsi();

    const params: ContextParams = {
      model: modelPath,
      n_ctx: 4096,
      n_batch: 512,
      n_ubatch: 512,
      use_mlock: false,
      use_mmap: true,
      flash_attn_type: "auto",
    };

    _context = await initLlama(params, (pct) => {
      _progress = pct;
      onProgress?.(pct);
      notify();
    });

    _state = "ready";
    _progress = 100;
    _error = null;
    notify();
  } catch (e: any) {
    _state = "error";
    _error = e?.message || "Failed to load model";
    _context = null;
    notify();
    throw e;
  }
}

export async function unloadModel() {
  if (_context) {
    await _context.release();
    _context = null;
  }
  _state = "unloaded";
  _progress = 0;
  _error = null;
  notify();
}

export async function generateResponse(
  prompt: string,
  onToken?: (token: string) => void,
): Promise<string> {
  if (!_context || _state !== "ready") {
    throw new Error("Model not loaded");
  }

  const tokens: string[] = [];
  const result = await _context.completion(
    {
      prompt,
      n_predict: 2048,
      temperature: 0.7,
      top_k: 40,
      top_p: 0.95,
      stop: ["<|eot_id|>", "<|end|>", "User:", "\n\nUser"],
    },
    (data) => {
      if (data.token) {
        tokens.push(data.token);
        onToken?.(data.token);
      }
    },
  );

  return result.text;
}
