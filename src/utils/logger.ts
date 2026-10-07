/**
 * Leveled logger. Production builds only emit warnings and errors; debug/info
 * are dev-only. Never log secrets or full user content.
 */
export type LogLevel = "debug" | "info" | "warn" | "error" | "silent";

const ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40, silent: 99 };
const isDev = typeof __DEV__ !== "undefined" ? __DEV__ : process.env.NODE_ENV !== "production";

let threshold: LogLevel = isDev ? "debug" : "warn";

export function setLogLevel(level: LogLevel): void {
  threshold = level;
}

function emit(level: Exclude<LogLevel, "silent">, scope: string, args: unknown[]): void {
  if (ORDER[level] < ORDER[threshold]) return;
  const prefix = `[${scope}]`;
  /* eslint-disable no-console */
  if (level === "error") console.error(prefix, ...args);
  else if (level === "warn") console.warn(prefix, ...args);
  else if (level === "info") console.info(prefix, ...args);
  else console.debug(prefix, ...args);
  /* eslint-enable no-console */
}

export interface Logger {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

/** Scoped logger, e.g. `const log = createLogger("calendar")`. */
export function createLogger(scope: string): Logger {
  return {
    debug: (...a) => emit("debug", scope, a),
    info: (...a) => emit("info", scope, a),
    warn: (...a) => emit("warn", scope, a),
    error: (...a) => emit("error", scope, a),
  };
}
