import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand, DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';

@Injectable()
export class StorageService {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(private readonly config: ConfigService) {
    const endpoint = this.must('S3_ENDPOINT');
    const accessKeyId = this.must('S3_ACCESS_KEY');
    const secretAccessKey = this.must('S3_SECRET_KEY');
    const region = this.config.get<string>('S3_REGION', 'ru-central1');

    this.bucket = this.must('S3_BUCKET');
    this.client = new S3Client({
      region,
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: true,
    });
  }

  private must(name: string): string {
    const v = this.config.get<string>(name, '');
    if (!v) throw new Error(`${name} is not set`);
    return v;
  }

  private buildPublicUrl(key: string): string {
    // For Yandex Object Storage the endpoint is typically https://storage.yandexcloud.net
    const endpoint = this.must('S3_ENDPOINT').replace(/\/+$/, '');
    return `${endpoint}/${this.bucket}/${encodeURIComponent(key).replace(/%2F/g, '/')}`;
  }

  async uploadObjectImage(params: {
    objectId: string;
    bytes: Buffer;
    contentType: string;
    originalName?: string;
  }): Promise<{ key: string; url: string }> {
    const ext = (params.originalName ?? '').split('.').pop()?.toLowerCase();
    const safeExt = ext && /^[a-z0-9]{1,10}$/.test(ext) ? `.${ext}` : '';
    const key = `objects/${params.objectId}/${randomUUID()}${safeExt}`;

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: params.bytes,
        ContentType: params.contentType,
        ACL: 'public-read',
      }),
    );

    return { key, url: this.buildPublicUrl(key) };
  }

  async deleteByKey(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );
  }
}

