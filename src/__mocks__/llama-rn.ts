export async function initLlama(_params: unknown, _onProgress?: (pct: number) => void) {
  const mockContext = {
    completion: async (_opts: unknown, _onToken?: (data: unknown) => void) => {
      return { text: "mock response" };
    },
    stopCompletion: async () => {},
    release: async () => {},
  };
  return mockContext;
}

export async function releaseAllLlama() {}

export async function installJsi() {}

export type LlamaContext = Awaited<ReturnType<typeof initLlama>>;
export type ContextParams = Record<string, unknown>;
