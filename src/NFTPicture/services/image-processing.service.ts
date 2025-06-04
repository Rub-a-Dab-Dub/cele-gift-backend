// src/services/image-processing.service.ts
import { Injectable } from '@nestjs/common';
import * as sharp from 'sharp';
import { S3Service } from './s3.service';

@Injectable()
export class ImageProcessingService {
  constructor(private s3Service: S3Service) {}

  async processNftImage(imageUrl: string): Promise<{
    originalUrl: string;
    thumbnailUrl: string;
  }> {
    try {
      // Download image
      const response = await fetch(imageUrl);
      const imageBuffer = Buffer.from(await response.arrayBuffer());

      // Generate thumbnail
      const thumbnailBuffer = await sharp(imageBuffer)
        .resize(300, 300, { fit: 'cover' })
        .jpeg({ quality: 80 })
        .toBuffer();

      // Upload to S3
      const originalKey = `nfts/original/${Date.now()}-original.jpg`;
      const thumbnailKey = `nfts/thumbnails/${Date.now()}-thumb.jpg`;

      const [originalUpload, thumbnailUpload] = await Promise.all([
        this.s3Service.uploadFile(originalKey, imageBuffer, 'image/jpeg'),
        this.s3Service.uploadFile(thumbnailKey, thumbnailBuffer, 'image/jpeg'),
      ]);

      return {
        originalUrl: originalUpload.Location,
        thumbnailUrl: thumbnailUpload.Location,
      };
    } catch (error) {
      console.error('Image processing error:', error);
      return {
        originalUrl: imageUrl,
        thumbnailUrl: imageUrl,
      };
    }
  }

  async generateImageVariants(imageUrl: string): Promise<{
    small: string;
    medium: string;
    large: string;
  }> {
    const response = await fetch(imageUrl);
    const imageBuffer = Buffer.from(await response.arrayBuffer());

    const [smallBuffer, mediumBuffer, largeBuffer] = await Promise.all([
      sharp(imageBuffer).resize(150, 150, { fit: 'cover' }).jpeg({ quality: 70 }).toBuffer(),
      sharp(imageBuffer).resize(500, 500, { fit: 'cover' }).jpeg({ quality: 80 }).toBuffer(),
      sharp(imageBuffer).resize(1000, 1000, { fit: 'cover' }).jpeg({ quality: 90 }).toBuffer(),
    ]);

    const timestamp = Date.now();
    const [smallUpload, mediumUpload, largeUpload] = await Promise.all([
      this.s3Service.uploadFile(`nfts/variants/${timestamp}-small.jpg`, smallBuffer, 'image/jpeg'),
      this.s3Service.uploadFile(`nfts/variants/${timestamp}-medium.jpg`, mediumBuffer, 'image/jpeg'),
      this.s3Service.uploadFile(`nfts/variants/${timestamp}-large.jpg`, largeBuffer, 'image/jpeg'),
    ]);

    return {
      small: smallUpload.Location,
      medium: mediumUpload.Location,
      large: largeUpload.Location,
    };
  }
}