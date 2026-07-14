const storages = new Map<string, Map<string, string>>();

export function createMMKV({ id }: { id: string }) {
  if (!storages.has(id)) {
    storages.set(id, new Map());
  }
  const store = storages.get(id)!;
  return {
    set: (key: string, value: string) => store.set(key, value),
    getString: (key: string) => store.get(key) ?? null,
    getAllKeys: () => Array.from(store.keys()),
    remove: (key: string) => store.delete(key),
    clearAll: () => store.clear(),
  };
}

const RNMmkv = { createMMKV };
export default RNMmkv;
