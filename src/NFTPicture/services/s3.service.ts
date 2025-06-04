// src/services/s3.service.ts
import { Injectable } from '@nestjs/common';
import * as AWS from 'aws-sdk';

@Injectable()
export class S3Service {
  private s3: AWS.S3;

  constructor() {
    this.s3 = new AWS.S3({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION,
    });
  }

  async uploadFile(key: string, body: Buffer, contentType: string): Promise<AWS.S3.ManagedUpload.SendData> {
    const params = {
      Bucket: process.env.AWS_S3_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
      ACL: 'public-read',
    };

    return this.s3.upload(params).promise();
  }

  async deleteFile(key: string): Promise<void> {
    const params = {
      Bucket: process.env.AWS_S3_BUCKET,
      Key: key,
    };

    await this.s3.deleteObject(params).promise();
  }
}
