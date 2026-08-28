import { randomUUID } from 'node:crypto';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { MediaStoragePort } from '../../../application/ports/media-storage.port';

const SIGNED_URL_TTL_SECONDS = 300;

export class S3MediaStorage implements MediaStoragePort {
  constructor(
    private readonly client: S3Client,
    private readonly bucketName: string,
  ) {}

  static fromBucketName(bucketName: string): S3MediaStorage {
    return new S3MediaStorage(new S3Client({}), bucketName);
  }

  async store(userId: string, contentType: string, data: Buffer): Promise<string> {
    const key = `users/${userId}/${randomUUID()}`;
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: data,
        ContentType: contentType,
      }),
    );
    return key;
  }

  async getSignedDownloadUrl(key: string): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucketName, Key: key });
    return getSignedUrl(this.client, command, { expiresIn: SIGNED_URL_TTL_SECONDS });
  }
}
