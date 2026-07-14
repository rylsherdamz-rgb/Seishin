export const cacheDirectory = "/mock-cache/";
export const documentDirectory = "/mock-documents/";

export async function getInfoAsync(_uri: string) {
  return { exists: true, size: 1024, isDirectory: false, modificationTime: Date.now() };
}

export async function downloadAsync(_url: string, _uri: string) {
  return { uri: _uri, status: 200, headers: {} };
}

export async function readAsStringAsync(_uri: string) {
  return "";
}

export async function copyAsync(_opts: any) {}

export async function makeDirectoryAsync(_dir: string, _opts?: any) {}

export function createDownloadResumable(
  _url: string,
  _fileUri: string,
  _options?: any,
  _callback?: (progress: { totalBytesWritten: number; totalBytesExpectedToWrite: number }) => void,
) {
  return {
    downloadAsync: async () => {
      // Simulate progress callbacks
      if (_callback) {
        _callback({ totalBytesWritten: 0, totalBytesExpectedToWrite: 1000 });
        _callback({ totalBytesWritten: 500, totalBytesExpectedToWrite: 1000 });
        _callback({ totalBytesWritten: 1000, totalBytesExpectedToWrite: 1000 });
      }
      return { uri: _fileUri, status: 200, headers: {} };
    },
    pauseAsync: async () => {},
    resumeAsync: async () => ({ uri: _fileUri, status: 200, headers: {} }),
    savable: () => ({}),
  };
}

const FileSystem = {
  cacheDirectory: "/mock-cache/",
  documentDirectory: "/mock-documents/",
  getInfoAsync,
  downloadAsync,
  readAsStringAsync,
  copyAsync,
  makeDirectoryAsync,
  createDownloadResumable,
};

export default FileSystem;
