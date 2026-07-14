export class File {
  uri: string;
  constructor(_parent: any, name: string) {
    this.uri = `/mock/${name}`;
  }
  static async downloadFileAsync(_url: string, _file: File, _opts?: any) {
    // Simulate progress calls if onProgress is provided
    if (_opts?.onProgress) {
      _opts.onProgress({ bytesWritten: 0, totalBytes: 1000 });
      _opts.onProgress({ bytesWritten: 500, totalBytes: 1000 });
      _opts.onProgress({ bytesWritten: 1000, totalBytes: 1000 });
    }
    return _file;
  }
  static createDownloadTask(_url: string, _file: File, _opts?: any) {
    return {
      uri: _file.uri,
      bytesWritten: 0,
      totalBytes: 0,
      downloadAsync: async () => _file,
    };
  }
}

export class Directory {
  uri: string;
  constructor(...parts: string[]) {
    this.uri = parts.join("/");
  }
  create(_opts?: any) {}
  exists() { return true; }
}

export const Paths = {
  document: "/mock-docs",
  cache: "/mock-cache",
};

const ExpoFileSystem = { File, Directory, Paths };
export default ExpoFileSystem;
