export class ObjectStorageService {
  async uploadFile(_key: string, _buffer: Buffer, _contentType: string): Promise<string> {
    throw new Error("Object storage not configured");
  }
  async deleteFile(_key: string): Promise<void> {}
  async getSignedUrl(_key: string): Promise<string> { return ""; }
}
export async function setObjectAclPolicy(_bucketName: string): Promise<void> {}
