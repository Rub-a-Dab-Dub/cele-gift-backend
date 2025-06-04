// src/dto/update-nft-picture.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateNftPictureDto } from './create-nft-picture.dto';

export class UpdateNftPictureDto extends PartialType(CreateNftPictureDto) {}