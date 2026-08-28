export interface MediaStoragePort {
  /** Sube el binario y devuelve la key con la que se puede recuperar después. */
  store(userId: string, contentType: string, data: Buffer): Promise<string>;
  getSignedDownloadUrl(key: string): Promise<string>;
}
