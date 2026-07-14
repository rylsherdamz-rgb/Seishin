export async function initLlama(_params: any, _onProgress?: (pct: number) => void) {
  const mockContext = {
    completion: async (_opts: any, _onToken?: (data: any) => void) => {
      return { text: "mock response" };
    },
    release: async () => {},
  };
  return mockContext;
}

export async function releaseAllLlama() {}

export async function installJsi() {}

export type LlamaContext = any;
export type ContextParams = any;
