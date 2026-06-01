export class ObjectNotFoundError extends Error {}
export const objectStorageClient = null;

export class ObjectStorageService {
  async uploadFile(_key: string, _buffer: Buffer, _contentType: string): Promise<string> {
    throw new Error("Object storage not configured");
  }
  async deleteFile(_key: string): Promise<void> {}
  async getSignedUrl(_key: string, _expiry?: number): Promise<string> { return ""; }
  async getObjectEntityUploadURL(): Promise<string> { return ""; }
}
