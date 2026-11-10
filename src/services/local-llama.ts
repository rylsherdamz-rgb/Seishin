import { Platform } from "react-native";
import { initLlama, LlamaContext, releaseAllLlama, installJsi, type ContextParams } from "llama.rn";
import { createLogger } from "@/utils/logger";

const log = createLogger("local-llama");

export type ModelState = "unloaded" | "loading" | "ready" | "error";

let _context: LlamaContext | null = null;
let _state: ModelState = "unloaded";
let _progress = 0;
let _error: string | null = null;
/** A vision projector (mmproj) is loaded, so chat messages may carry images. */
let _vision = false;
/** Images cost ~1 token per 32×32 px; the vision fine-tune (training/) is trained at ≤256. */
const IMAGE_MAX_TOKENS = 256;

const listeners = new Set<() => void>();

/**
 * One llama.rn context can only run one job at a time. Chat, Smart capture and
 * summaries all share it, and (re)loading must not release a context that is
 * mid-completion — so every use goes through this queue.
 */
let _queue: Promise<unknown> = Promise.resolve();
function exclusive<T>(job: () => Promise<T>): Promise<T> {
  const run = _queue.then(job, job);
  _queue = run.catch(() => undefined);
  return run;
}

async function releaseContext() {
  const ctx = _context;
  if (!ctx) return;
  _context = null;
  _vision = false;
  await ctx.stopCompletion().catch(() => {});
  await exclusive(() => ctx.release());
}

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

/** True when the loaded model can see images (a multimodal GGUF + its mmproj file). */
export function isVisionReady() {
  return _vision && isModelLoaded();
}

/** llama.rn reads local files only; content:// and remote URIs can't be passed to the model. */
export function isLocalImageUri(uri: string) {
  return uri.startsWith("file://") || uri.startsWith("/");
}

/**
 * Load a GGUF. With `mmprojPath` (the model's vision projector) the model can
 * also see images; if the projector fails to load the model still runs text-only.
 */
export async function loadModel(modelPath: string, onProgress?: (pct: number) => void, mmprojPath?: string | null) {
  if (_state === "loading") return;
  _state = "loading";
  _progress = 0;
  _error = null;
  notify();

  try {
    await releaseContext();
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

    if (mmprojPath) {
      try {
        // GPU offload helps on iOS (Metal); most Android GPUs are slower than the CPU here.
        _vision = await _context.initMultimodal({ path: mmprojPath, use_gpu: Platform.OS === "ios", image_max_tokens: IMAGE_MAX_TOKENS });
      } catch (e) {
        _vision = false;
        log.warn("vision projector failed to load; running text-only", e);
      }
    }

    _state = "ready";
    _progress = 100;
    _error = null;
    notify();
  } catch (e) {
    _state = "error";
    _error = e instanceof Error && e.message ? e.message : "Failed to load model";
    _context = null;
    notify();
    throw e;
  }
}

export async function unloadModel() {
  await releaseContext();
  _state = "unloaded";
  _progress = 0;
  _error = null;
  notify();
}

let _aborted = false;

export const generationAborted = () => _aborted;

export function abortGeneration() {
  _aborted = true;
  // The flag only mutes the token callback; this actually stops the model.
  _context?.stopCompletion().catch(() => {});
}

export async function generateResponse(
  prompt: string,
  onToken?: (token: string) => void,
): Promise<string> {
  return exclusive(async () => {
    const ctx = _context;
    if (!ctx || _state !== "ready") {
      throw new Error("Model not loaded");
    }

    _aborted = false;
    const result = await ctx.completion(
      {
        prompt,
        n_predict: 2048,
        temperature: 0.7,
        top_k: 40,
        top_p: 0.95,
        stop: ["<|eot_id|>", "<|end|>", "User:", "\n\nUser"],
      },
      (data) => {
        if (_aborted || data.token === undefined) return;
        onToken?.(data.token);
      },
    );

    return result.text;
  });
}

/** One part of a multimodal user turn (OpenAI format, as llama.rn expects). */
export type LocalContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

/** OpenAI-style chat turn; tool fields pass through to the model's jinja template. */
export interface LocalChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  /** Plain text, or image + text parts when the model has a vision projector loaded. */
  content: string | LocalContentPart[];
  tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[];
  tool_call_id?: string;
}

export interface LocalToolCall {
  id: string;
  name: string;
  arguments: string;
}

/**
 * Chat with on-device tool calling. llama.rn renders the model's own chat
 * template (jinja) with the tool schemas and parses tool calls back out, so
 * the same tools the cloud agent uses run fully offline. `onContent` receives
 * the reply text so far (tool-call JSON already stripped).
 */
export async function chatWithTools(
  messages: LocalChatMessage[],
  tools: object[] | undefined,
  onContent?: (text: string) => void,
): Promise<{ content: string; toolCalls: LocalToolCall[] }> {
  return exclusive(async () => {
    const ctx = _context;
    if (!ctx || _state !== "ready") throw new Error("Model not loaded");
    _aborted = false;
    const result = await ctx.completion(
      {
        messages: messages as unknown as { role: string; content?: string }[],
        tools,
        tool_choice: tools ? "auto" : undefined,
        jinja: true,
        n_predict: 1024,
        temperature: 0.3,
        top_k: 40,
        top_p: 0.95,
      },
      (data) => {
        if (_aborted || data.content === undefined) return;
        onContent?.(data.content);
      },
    );
    const toolCalls = (result.tool_calls ?? [])
      .filter((c) => c.function?.name)
      .map((c, i) => ({ id: c.id || `local-call-${Date.now()}-${i}`, name: c.function.name, arguments: c.function.arguments || "{}" }));
    return { content: (result.content ?? result.text ?? "").trim(), toolCalls };
  });
}
