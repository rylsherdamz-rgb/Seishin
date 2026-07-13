import { Platform } from "youtubei.js";

function supportsFunctionEval(): boolean {
  try {
    const fn = new Function("return 1+1");
    return fn() === 2;
  } catch { return false; }
}

function runViaFunction(data: any, env: any) {
  const keys = Object.keys(env);
  const vals = Object.values(env);
  const fn = new Function(...keys, data.output);
  return fn(...vals);
}

export function setupPlatformEvaluator(): boolean {
  if (!supportsFunctionEval()) {
    console.warn("[evaluator] Function constructor not available");
    return false;
  }

  try {
    const s = (Platform as any).shim;
    s.eval = (data: any, env: any) => {
      try {
        const r = runViaFunction(data, env);
        if (typeof r !== "object" || r === null) {
          console.warn("[evaluator] eval returned non-object:", typeof r);
        }
        return r;
      } catch (err) {
        console.warn("[evaluator] cipher eval failed:", (err as Error).message);
        throw err;
      }
    };
    return true;
  } catch (err) {
    console.warn("[evaluator] setup failed:", (err as Error).message);
    return false;
  }
}
