/** fetch with a timeout and readable errors for connector APIs. */
export class ConnectorError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
  }
}

export async function http<T>(url: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), init.timeoutMs ?? 15000);
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: ctrl.signal });
  } catch (e) {
    throw new ConnectorError(ctrl.signal.aborted ? "The service took too long to answer" : "No internet connection");
  } finally {
    clearTimeout(timer);
  }
  if (res.status === 401 || res.status === 403) throw new ConnectorError("The token was rejected — reconnect with a new one", res.status);
  if (res.status === 404) throw new ConnectorError("Not found — check the link or that it's shared with the integration", 404);
  if (res.status === 429) throw new ConnectorError("Too many requests — will retry later", 429);
  if (!res.ok) throw new ConnectorError(`Service error (${res.status})`, res.status);
  const type = res.headers.get("content-type") ?? "";
  return (type.includes("json") ? await res.json() : await res.text()) as T;
}
